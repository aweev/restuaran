import {
  AggregateSnapshot,
  AttributeBag,
  DomainEvent,
  kernelError,
  StoredEvent,
  TenantContext,
} from "@/kernel/types"
import { AppendOptions, EventQuery, EventStore } from "./event-store"

class ConflictError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ConflictError"
  }
}

function sameTenant(a: TenantContext, b: TenantContext): boolean {
  return a.orgId === b.orgId && a.venueId === b.venueId
}

function keyOf(tenant: TenantContext, aggregateType: string, aggregateId: string): string {
  return `${tenant.orgId}::${tenant.venueId}::${aggregateType}::${aggregateId}`
}

export class InMemoryEventStore implements EventStore {
  private events: StoredEvent[] = []
  /** Cold tier: events moved out of `events` by compaction. Reads merge both. */
  private archive: StoredEvent[] = []
  private snapshots = new Map<string, AggregateSnapshot>()
  private position = 0
  private listeners = new Set<(event: StoredEvent) => void>()

  async append<TPayload extends AttributeBag>(
    event: Omit<DomainEvent<TPayload>, "globalPosition">,
    options?: AppendOptions
  ): Promise<StoredEvent<TPayload>> {
    const stored = await this.appendMany([event as Omit<DomainEvent, "globalPosition">], options)
    return stored[0] as StoredEvent<TPayload>
  }

  async appendMany(
    events: Array<Omit<DomainEvent, "globalPosition">>,
    options?: AppendOptions
  ): Promise<StoredEvent[]> {
    if (events.length === 0) return []

    const first = events[0]
    const k = keyOf(first.tenant, first.aggregateType, first.aggregateId)

    for (const e of events) {
      if (keyOf(e.tenant, e.aggregateType, e.aggregateId) !== k) {
        throw kernelError("BATCH_MIXED_AGGREGATE", "A single appendMany batch must target one aggregate")
      }
    }

    const existing = [...this.events, ...this.archive].filter(
      (e) => keyOf(e.tenant, e.aggregateType, e.aggregateId) === k
    )
    // Version comes from live ∪ archive: after compaction the newest events may
    // be cold, but optimistic concurrency must still see their versions.
    const currentVersion = existing.reduce((max, e) => Math.max(max, e.aggregateVersion), 0)

    if (options?.expectedVersion !== undefined && options.expectedVersion !== currentVersion) {
      throw new ConflictError(
        `Optimistic concurrency conflict: expected v${options.expectedVersion}, current v${currentVersion}`
      )
    }

    const stored: StoredEvent[] = events.map((e, i) => {
      const record: StoredEvent = {
        ...e,
        eventId: e.eventId ?? crypto.randomUUID(),
        globalPosition: ++this.position,
        aggregateVersion: currentVersion + i + 1,
      }
      return record
    })

    this.events.push(...stored)
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
    // Archived (cold) events merge back in so projections/rebuilds stay correct.
    let result = [...this.events, ...this.archive].filter((e) => sameTenant(e.tenant, q.tenant))
    if (q.aggregateType) result = result.filter((e) => e.aggregateType === q.aggregateType)
    if (q.aggregateId) result = result.filter((e) => e.aggregateId === q.aggregateId)
    if (q.eventTypes?.length) result = result.filter((e) => q.eventTypes!.includes(e.eventType))
    if (q.fromGlobalPosition !== undefined) result = result.filter((e) => e.globalPosition > q.fromGlobalPosition!)
    result.sort((a, b) => a.globalPosition - b.globalPosition)
    if (q.limit) result = result.slice(0, q.limit)
    return result
  }

  async readAggregate(
    tenant: TenantContext,
    aggregateType: string,
    aggregateId: string,
    fromVersion?: number,
    limit?: number
  ): Promise<StoredEvent[]> {
    const events = [...this.events, ...this.archive].filter(
      (e) =>
        sameTenant(e.tenant, tenant) &&
        e.aggregateType === aggregateType &&
        e.aggregateId === aggregateId
    )
    events.sort((a, b) => a.aggregateVersion - b.aggregateVersion)
    const tail = fromVersion === undefined ? events : events.filter((e) => e.aggregateVersion > fromVersion)
    return limit ? tail.slice(0, limit) : tail
  }

  async saveSnapshot(snapshot: AggregateSnapshot): Promise<void> {
    this.snapshots.set(keyOf(snapshot.tenant, snapshot.aggregateType, snapshot.aggregateId), snapshot)
  }

  async loadSnapshot(tenant: TenantContext, aggregateType: string, aggregateId: string) {
    return this.snapshots.get(keyOf(tenant, aggregateType, aggregateId)) ?? null
  }

  subscribe(listener: (event: StoredEvent) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /** Move events at/below `throughVersion` for this stream into the cold archive. */
  async compactAggregate(
    tenant: TenantContext,
    aggregateType: string,
    aggregateId: string,
    throughVersion: number
  ): Promise<StoredEvent[]> {
    const moved: StoredEvent[] = []
    const kept: StoredEvent[] = []
    for (const e of this.events) {
      const match =
        sameTenant(e.tenant, tenant) &&
        e.aggregateType === aggregateType &&
        e.aggregateId === aggregateId &&
        e.aggregateVersion <= throughVersion
      if (match) moved.push(e)
      else kept.push(e)
    }
    this.events = kept
    this.archive.push(...moved)
    return moved
  }

  /** Explicit read of the cold archive (audit / compaction bookkeeping). */
  async archivedEvents(q: EventQuery): Promise<StoredEvent[]> {
    let result = this.archive.filter((e) => sameTenant(e.tenant, q.tenant))
    if (q.aggregateType) result = result.filter((e) => e.aggregateType === q.aggregateType)
    if (q.aggregateId) result = result.filter((e) => e.aggregateId === q.aggregateId)
    if (q.eventTypes?.length) result = result.filter((e) => q.eventTypes!.includes(e.eventType))
    if (q.fromGlobalPosition !== undefined) result = result.filter((e) => e.globalPosition > q.fromGlobalPosition!)
    result.sort((a, b) => a.globalPosition - b.globalPosition)
    if (q.limit) result = result.slice(0, q.limit)
    return result
  }
}
