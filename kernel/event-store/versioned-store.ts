import {
  AggregateSnapshot,
  AttributeBag,
  DomainEvent,
  kernelError,
  StoredEvent,
  TenantContext,
} from "@/kernel/types"
import { AppendOptions, EventQuery, EventStore } from "./event-store"
import type { CompactableEventStore } from "./compaction"

export const CURRENT_SCHEMA_VERSION = 1
export const SCHEMA_VERSION_KEY = "schemaVersion"

export function schemaVersionOf(event: Pick<DomainEvent, "metadata">): number {
  const v = event.metadata?.[SCHEMA_VERSION_KEY]
  return typeof v === "number" ? v : 1
}

export type Upcaster = (
  payload: AttributeBag,
  meta: AttributeBag
) => { payload: AttributeBag; meta: AttributeBag }

export interface UpcasterRegistration {
  eventType: string
  fromVersion: number
  toVersion: number
  upcast: Upcaster
}

/**
 * Registry of forward-only payload transformers, one per (eventType, version step).
 * Legacy event payloads are upgraded on read so aggregates only ever see the
 * current schema — no destructive migrations, replay stays correct.
 */
export class UpcastRegistry {
  private steps = new Map<string, Map<number, UpcasterRegistration>>()

  register(reg: UpcasterRegistration): this {
    const byVersion = this.steps.get(reg.eventType) ?? new Map()
    byVersion.set(reg.fromVersion, reg)
    this.steps.set(reg.eventType, byVersion)
    return this
  }

  upcast<T extends Pick<StoredEvent, "eventType" | "payload" | "metadata">>(event: T): T {
    const chain = this.steps.get(event.eventType)
    if (!chain) return event
    let version = schemaVersionOf(event)
    let payload = event.payload
    let meta: AttributeBag = { ...event.metadata }
    let guard = 0
    while (chain.has(version) && guard++ < 100) {
      const reg = chain.get(version)!
      const result = reg.upcast(payload, meta)
      payload = result.payload
      const stamped = result.meta[SCHEMA_VERSION_KEY]
      meta = { ...result.meta, [SCHEMA_VERSION_KEY]: typeof stamped === "number" ? stamped : reg.toVersion }
      version = reg.toVersion
    }
    return { ...event, payload, metadata: meta as StoredEvent["metadata"] }
  }
}

/**
 * Decorator EventStore that stamps the current schema version on append and
 * upcasts on read/subscribe. Snapshots are version-tagged and rejected when
 * stale (forcing a full replay through the upcast chain).
 */
export class VersionedEventStore implements EventStore {
  constructor(
    private inner: EventStore,
    private upcasts: UpcastRegistry,
    private schemaVersion: number = CURRENT_SCHEMA_VERSION
  ) {}

  get version(): number {
    return this.schemaVersion
  }

  async append<TPayload extends AttributeBag>(
    event: Omit<DomainEvent<TPayload>, "globalPosition">,
    options?: AppendOptions
  ): Promise<StoredEvent<TPayload>> {
    const [stored] = await this.inner.appendMany(this.stamp([event]), options)
    return stored as StoredEvent<TPayload>
  }

  async appendMany(
    events: Array<Omit<DomainEvent, "globalPosition">>,
    options?: AppendOptions
  ): Promise<StoredEvent[]> {
    return this.inner.appendMany(this.stamp(events), options)
  }

  async query(q: EventQuery): Promise<StoredEvent[]> {
    const rows = await this.inner.query(q)
    return rows.map((e) => this.upcasts.upcast(e))
  }

  async readAggregate(
    tenant: TenantContext,
    aggregateType: string,
    aggregateId: string,
    fromVersion?: number,
    limit?: number
  ): Promise<StoredEvent[]> {
    const rows = await this.inner.readAggregate(tenant, aggregateType, aggregateId, fromVersion, limit)
    return rows.map((e) => this.upcasts.upcast(e))
  }

  async saveSnapshot(snapshot: AggregateSnapshot): Promise<void> {
    return this.inner.saveSnapshot({ ...snapshot, snapshotSchemaVersion: this.schemaVersion })
  }

  async loadSnapshot(
    tenant: TenantContext,
    aggregateType: string,
    aggregateId: string
  ): Promise<AggregateSnapshot | null> {
    const snap = await this.inner.loadSnapshot(tenant, aggregateType, aggregateId)
    if (!snap) return null
    const snapVersion = snap.snapshotSchemaVersion ?? 1
    if (snapVersion !== this.schemaVersion) return null
    return snap
  }

  subscribe(listener: (event: StoredEvent) => void): () => void {
    return this.inner.subscribe((event) => listener(this.upcasts.upcast(event)))
  }

  // ---- Compaction delegation (Phase 3): moves raw rows, upcasts on read ----

  async compactAggregate(
    tenant: TenantContext,
    aggregateType: string,
    aggregateId: string,
    throughVersion: number
  ): Promise<StoredEvent[]> {
    const inner = this.inner as Partial<CompactableEventStore>
    if (typeof inner.compactAggregate !== "function") {
      throw kernelError("NOT_COMPACTABLE", "The underlying event store does not support compaction")
    }
    return inner.compactAggregate(tenant, aggregateType, aggregateId, throughVersion)
  }

  async archivedEvents(q: EventQuery): Promise<StoredEvent[]> {
    const inner = this.inner as Partial<CompactableEventStore>
    if (typeof inner.archivedEvents !== "function") return []
    const rows = await inner.archivedEvents(q)
    return rows.map((e) => this.upcasts.upcast(e))
  }

  private stamp<T extends Pick<DomainEvent, "metadata">>(events: T[]): T[] {
    return events.map((e) => ({
      ...e,
      metadata: { ...e.metadata, [SCHEMA_VERSION_KEY]: e.metadata?.[SCHEMA_VERSION_KEY] ?? this.schemaVersion },
    }))
  }
}

/** Upcasters shared by every kernel instance. Extend in later phases. */
export function defaultUpcasters(): UpcastRegistry {
  return new UpcastRegistry()
}
