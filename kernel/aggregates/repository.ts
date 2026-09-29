import { AttributeBag, StoredEvent, TenantContext } from "@/kernel/types"
import { EventStore } from "@/kernel/event-store/event-store"
import { Aggregate } from "./aggregate"

interface Stateful {
  version: number
  state: AttributeBag
}

export interface SnapshotPolicy {
  /** take a snapshot whenever the aggregate version lands on a multiple of N (0 disables) */
  every: number
  shouldSnapshot(committedEvents: StoredEvent[], currentVersion: number): boolean
}

export const defaultSnapshotPolicy = (every = 50): SnapshotPolicy => ({
  every,
  shouldSnapshot: (_committed, version) => every > 0 && version % every === 0,
})

export interface RepositoryDeps {
  events: EventStore
  snapshot?: SnapshotPolicy
  /** guarded load (rejects unknown ids) */
  load: <T extends Aggregate>(store: EventStore, type: string, tenant: TenantContext, id: string) => Promise<T>
  /** unguarded read (may return a v0 aggregate) */
  read: <T extends Aggregate>(store: EventStore, type: string, tenant: TenantContext, id: string) => Promise<T>
  saveAggregate: (store: EventStore, agg: Aggregate) => Promise<StoredEvent[]>
}

/**
 * The single write path for every command (core + modules): loads with the
 * existence guard, persists, then applies the snapshot policy. Centralizing
 * this means snapshots and AGGREGATE_NOT_FOUND enforcement can never be
 * skipped by a handler that forgets to route through saveAggregate.
 */
export class AggregateRepository {
  constructor(private deps: RepositoryDeps) {}

  /** Load an aggregate for mutation. Throws AGGREGATE_NOT_FOUND for unknown ids. */
  load<T extends Aggregate>(type: string, tenant: TenantContext, id: string): Promise<T> {
    return this.deps.load<T>(this.deps.events, type, tenant, id)
  }

  /** Load without the existence guard â€” for cross-module checks on possibly-absent ids. */
  read<T extends Aggregate>(type: string, tenant: TenantContext, id: string): Promise<T> {
    return this.deps.read<T>(this.deps.events, type, tenant, id)
  }

  async save(agg: Aggregate): Promise<StoredEvent[]> {
    const committed = await this.deps.saveAggregate(this.deps.events, agg)
    await this.maybeSnapshot(agg, committed)
    return committed
  }

  /** Load-with-guard, run a behavior, commit, publish. The handler happy path. */
  async mutate<T extends Aggregate>(
    type: string,
    tenant: TenantContext,
    id: string,
    behavior: (agg: T) => void
  ): Promise<StoredEvent[]> {
    const agg = await this.load<T>(type, tenant, id)
    behavior(agg)
    return this.save(agg)
  }

  private async maybeSnapshot(agg: Aggregate, committed: StoredEvent[]): Promise<void> {
    if (committed.length === 0) return
    const view = agg as unknown as Stateful
    const policy = this.deps.snapshot ?? defaultSnapshotPolicy()
    if (!policy.shouldSnapshot(committed, view.version)) return
    try {
      await this.deps.events.saveSnapshot({
        aggregateType: agg.aggregateType,
        aggregateId: agg.id,
        tenant: agg.tenant,
        version: view.version,
        state: view.state,
        takenAt: new Date().toISOString(),
      })
    } catch (err) {
      // The write is already committed; a failed snapshot is non-fatal and the
      // next save (or a compaction job) retries it. Never break the command path.
      console.error("[kernel:snapshot] failed:", err)
    }
  }
}