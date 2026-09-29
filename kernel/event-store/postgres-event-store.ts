import {
  AggregateSnapshot,
  AttributeBag,
  DomainEvent,
  kernelError,
  StoredEvent,
  TenantContext,
} from "@/kernel/types"
import { AppendOptions, EventQuery, EventStore } from "./event-store"

type SqlClient = {
  unsafe: (query: string, params?: unknown[]) => Promise<Array<Record<string, unknown>>>
}

const EVENT_COLUMNS = `global_position, event_id, org_id, venue_id, zone_id, aggregate_type,
            aggregate_id, aggregate_version, event_type, occurred_at, actor, payload, metadata`

function rowToEvent(row: Record<string, unknown>): StoredEvent {
  const tenant: TenantContext =
    (row.tenant as TenantContext | undefined) ??
    {
      orgId: String(row.org_id),
      venueId: String(row.venue_id),
      ...(row.zone_id ? { zoneId: String(row.zone_id) } : {}),
    }
  return {
    eventId: String(row.event_id),
    eventType: String(row.event_type),
    aggregateType: String(row.aggregate_type),
    aggregateId: String(row.aggregate_id),
    aggregateVersion: Number(row.aggregate_version),
    tenant,
    actor: (row.actor as DomainEvent["actor"]) ?? undefined,
    occurredAt: String(row.occurred_at),
    payload: row.payload as AttributeBag,
    metadata: row.metadata as DomainEvent["metadata"],
    globalPosition: Number(row.global_position),
  }
}

export class PostgresEventStore implements EventStore {
  private listeners = new Set<(event: StoredEvent) => void>()

  constructor(private db: SqlClient) {}

  async append<TPayload extends AttributeBag>(
    event: Omit<DomainEvent<TPayload>, "globalPosition">,
    options?: AppendOptions
  ): Promise<StoredEvent<TPayload>> {
    const [stored] = await this.appendMany([event as Omit<DomainEvent, "globalPosition">], options)
    return stored as StoredEvent<TPayload>
  }

  /**
   * Guard + inserts run as ONE statement (CTE), so a batch commits fully or not
   * at all — no partial streams, no version gaps, one round trip. The UNIQUE
   * (org, venue, type, id, version) constraint closes the race window between
   * concurrent writers: the loser gets 23505, mapped to VERSION_CONFLICT.
   */
  async appendMany(
    events: Array<Omit<DomainEvent, "globalPosition">>,
    options?: AppendOptions
  ): Promise<StoredEvent[]> {
    if (events.length === 0) return []
    const first = events[0]
    // expected < 0 only happens for "must be empty" callers; current_version of
    // an empty stream is 0, so clamp for the guard comparison.
    const expected = Math.max(options?.expectedVersion ?? first.aggregateVersion - 1, 0)

    const placeholders: string[] = []
    const params: unknown[] = [first.tenant.orgId, first.tenant.venueId, first.aggregateType, first.aggregateId, expected]
    for (const e of events) {
      const base = params.length + 1
      params.push(
        e.eventId,
        e.tenant.orgId,
        e.tenant.venueId,
        e.tenant.zoneId ?? null,
        e.aggregateType,
        e.aggregateId,
        e.aggregateVersion,
        e.eventType,
        e.occurredAt,
        JSON.stringify(e.actor ?? null),
        JSON.stringify(e.payload),
        JSON.stringify(e.metadata)
      )
      placeholders.push(`($${base},${base + 1},${base + 2},${base + 3},${base + 4},${base + 5},${base + 6},${base + 7},${base + 8},${base + 9},${base + 10},${base + 11})`)
    }

    const sql = `WITH guard AS (
  SELECT GREATEST(
    COALESCE((SELECT MAX(aggregate_version) FROM ros_events
              WHERE org_id = $1 AND venue_id = $2 AND aggregate_type = $3 AND aggregate_id = $4), 0),
    COALESCE((SELECT MAX(aggregate_version) FROM ros_events_archive
              WHERE org_id = $1 AND venue_id = $2 AND aggregate_type = $3 AND aggregate_id = $4), 0)
  ) AS current_version
),
ins AS (
  INSERT INTO ros_events
    (event_id, org_id, venue_id, zone_id, aggregate_type, aggregate_id, aggregate_version,
     event_type, occurred_at, actor, payload, metadata)
  SELECT v.* FROM (VALUES ${placeholders.join(", ")}) AS v(
    event_id, org_id, venue_id, zone_id, aggregate_type, aggregate_id, aggregate_version,
    event_type, occurred_at, actor, payload, metadata)
  WHERE (SELECT current_version FROM guard) = $5
  RETURNING global_position, aggregate_version
)
SELECT global_position, aggregate_version FROM ins`

    let rows: Array<Record<string, unknown>>
    try {
      rows = await this.db.unsafe(sql, params)
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw kernelError(
          "VERSION_CONFLICT",
          `Concurrent append conflict on ${first.aggregateType}/${first.aggregateId} expected v${expected}`
        )
      }
      throw err
    }

    if (rows.length !== events.length) {
      throw kernelError(
        "VERSION_CONFLICT",
        `Optimistic concurrency conflict on ${first.aggregateType}/${first.aggregateId} expected v${expected}`
      )
    }

    const positionByVersion = new Map<number, number>()
    for (const r of rows) positionByVersion.set(Number(r.aggregate_version), Number(r.global_position))
    const stored: StoredEvent[] = events.map((e) => ({
      ...e,
      globalPosition: positionByVersion.get(e.aggregateVersion) ?? 0,
    })) as StoredEvent[]

    for (const s of stored) {
      for (const listener of this.listeners) {
        try {
          listener(s)
        } catch {
          // listener failures must not break the append
        }
      }
    }
    return stored
  }

  async query(q: EventQuery): Promise<StoredEvent[]> {
    const where = ["org_id = $1", "venue_id = $2"]
    const params: unknown[] = [q.tenant.orgId, q.tenant.venueId]
    let i = 3

    if (q.aggregateType) {
      where.push(`aggregate_type = $${i++}`)
      params.push(q.aggregateType)
    }
    if (q.aggregateId) {
      where.push(`aggregate_id = $${i++}`)
      params.push(q.aggregateId)
    }
    if (q.eventTypes?.length) {
      where.push(`event_type = ANY($${i++})`)
      params.push(q.eventTypes)
    }
    if (q.fromGlobalPosition !== undefined) {
      where.push(`global_position > $${i++}`)
      params.push(q.fromGlobalPosition)
    }
    const filter = where.join(" AND ")
    // Hot ∪ cold: archived events keep their positions and merge back transparently.
    let sql = `(SELECT ${EVENT_COLUMNS} FROM ros_events WHERE ${filter}
                UNION ALL
                SELECT ${EVENT_COLUMNS} FROM ros_events_archive WHERE ${filter})
               ORDER BY global_position ASC`
    if (q.limit) {
      sql += ` LIMIT $${i++}`
      params.push(q.limit)
    }
    const rows = await this.db.unsafe(sql, params)
    return rows.map(rowToEvent)
  }

  async readAggregate(
    tenant: TenantContext,
    aggregateType: string,
    aggregateId: string,
    fromVersion?: number,
    limit?: number
  ): Promise<StoredEvent[]> {
    const params: unknown[] = [tenant.orgId, tenant.venueId, aggregateType, aggregateId, fromVersion ?? 0]
    let sql = `(SELECT ${EVENT_COLUMNS} FROM ros_events
         WHERE org_id = $1 AND venue_id = $2 AND aggregate_type = $3 AND aggregate_id = $4
           AND aggregate_version > $5
        UNION ALL
        SELECT ${EVENT_COLUMNS} FROM ros_events_archive
         WHERE org_id = $1 AND venue_id = $2 AND aggregate_type = $3 AND aggregate_id = $4
           AND aggregate_version > $5)
       ORDER BY aggregate_version ASC`
    if (limit) {
      sql += ` LIMIT $6`
      params.push(limit)
    }
    const rows = await this.db.unsafe(sql, params)
    return rows.map(rowToEvent)
  }

  /** Atomic hot→cold move: DELETE + archive INSERT in one data-modifying CTE. */
  async compactAggregate(
    tenant: TenantContext,
    aggregateType: string,
    aggregateId: string,
    throughVersion: number
  ): Promise<StoredEvent[]> {
    const rows = await this.db.unsafe(
      `WITH moved AS (
         DELETE FROM ros_events
          WHERE org_id = $1 AND venue_id = $2 AND aggregate_type = $3 AND aggregate_id = $4
            AND aggregate_version <= $5
          RETURNING ${EVENT_COLUMNS}
       )
       INSERT INTO ros_events_archive (${EVENT_COLUMNS})
       SELECT ${EVENT_COLUMNS} FROM moved
       ON CONFLICT (global_position) DO NOTHING
       RETURNING ${EVENT_COLUMNS}`,
      [tenant.orgId, tenant.venueId, aggregateType, aggregateId, throughVersion]
    )
    return rows.map(rowToEvent)
  }

  async archivedEvents(q: EventQuery): Promise<StoredEvent[]> {
    const where = ["org_id = $1", "venue_id = $2"]
    const params: unknown[] = [q.tenant.orgId, q.tenant.venueId]
    let i = 3
    if (q.aggregateType) {
      where.push(`aggregate_type = $${i++}`)
      params.push(q.aggregateType)
    }
    if (q.aggregateId) {
      where.push(`aggregate_id = $${i++}`)
      params.push(q.aggregateId)
    }
    if (q.eventTypes?.length) {
      where.push(`event_type = ANY($${i++})`)
      params.push(q.eventTypes)
    }
    if (q.fromGlobalPosition !== undefined) {
      where.push(`global_position > $${i++}`)
      params.push(q.fromGlobalPosition)
    }
    let sql = `SELECT ${EVENT_COLUMNS} FROM ros_events_archive WHERE ${where.join(" AND ")}
               ORDER BY global_position ASC`
    if (q.limit) {
      sql += ` LIMIT $${i++}`
      params.push(q.limit)
    }
    const rows = await this.db.unsafe(sql, params)
    return rows.map(rowToEvent)
  }

  async saveSnapshot(snapshot: AggregateSnapshot): Promise<void> {
    await this.db.unsafe(
      `INSERT INTO ros_snapshots
         (org_id, venue_id, aggregate_type, aggregate_id, version, snapshot_schema_version, state, taken_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (org_id, venue_id, aggregate_type, aggregate_id)
       DO UPDATE SET version = EXCLUDED.version, snapshot_schema_version = EXCLUDED.snapshot_schema_version,
                     state = EXCLUDED.state, taken_at = EXCLUDED.taken_at`,
      [
        snapshot.tenant.orgId,
        snapshot.tenant.venueId,
        snapshot.aggregateType,
        snapshot.aggregateId,
        snapshot.version,
        snapshot.snapshotSchemaVersion ?? 1,
        JSON.stringify(snapshot.state),
        snapshot.takenAt,
      ]
    )
  }

  async loadSnapshot(tenant: TenantContext, aggregateType: string, aggregateId: string) {
    const rows = await this.db.unsafe(
      `SELECT * FROM ros_snapshots
       WHERE org_id = $1 AND venue_id = $2 AND aggregate_type = $3 AND aggregate_id = $4`,
      [tenant.orgId, tenant.venueId, aggregateType, aggregateId]
    )
    if (rows.length === 0) return null
    const row = rows[0]
    return {
      aggregateType,
      aggregateId,
      tenant,
      version: Number(row.version),
      snapshotSchemaVersion: Number(row.snapshot_schema_version ?? 1),
      state: row.state as AttributeBag,
      takenAt: String(row.taken_at),
    } satisfies AggregateSnapshot
  }

  subscribe(listener: (event: StoredEvent) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }
}

function isUniqueViolation(err: unknown): boolean {
  if (!err || typeof err !== "object") return false
  const e = err as Record<string, unknown>
  const code = (e.code ?? (e.sourceError as Record<string, unknown> | undefined)?.code) as string | undefined
  return code === "23505"
}
