import { EventQuery, EventStore } from "@/kernel/event-store/event-store"
import { StoredEvent, TenantContext } from "@/kernel/types"
import { loadAggregate } from "@/kernel/aggregates/registry"

/**
 * Stores that can move superseded events into a cold archive. Reads stay
 * transparent — archived events are merged back into query()/readAggregate() —
 * so replay, projections and audit queries behave exactly as before; only the
 * hot set shrinks. Implemented by the in-memory and Postgres backends.
 */
export interface CompactableEventStore extends EventStore {
  /** Move events with aggregateVersion <= throughVersion to the archive. Returns the moved rows. */
  compactAggregate(
    tenant: TenantContext,
    aggregateType: string,
    aggregateId: string,
    throughVersion: number
  ): Promise<StoredEvent[]>
  /** Explicit read of the cold archive (audit / compaction bookkeeping). */
  archivedEvents(q: EventQuery): Promise<StoredEvent[]>
}

export interface CompactionOptions {
  /** Streams shorter than this are left alone (default 50 — the default snapshot cadence). */
  minEventsPerAggregate?: number
  /** Also move events at or below the snapshot version into the cold archive. */
  prune?: boolean
  /** Report what would happen without writing. */
  dryRun?: boolean
}

export interface CompactionReport {
  dryRun: boolean
  streamsConsidered: number
  snapshotsTaken: number
  streamsCompacted: number
  eventsPruned: number
  streamsSkipped: number
  pruneSupported: boolean
  tookMs: number
}

/**
 * The Phase 3 event compaction job. Two safe, idempotent passes per tenant:
 *
 *  1. **Snapshot backfill** — any stream at/over the threshold gets a fresh
 *     snapshot (even if no write has happened recently), so replay cost is
 *     bounded by `snapshot + tail` instead of the full history.
 *  2. **Prune (opt-in)** — events at or below the snapshot version move to the
 *     cold archive. Replay never needs them (the snapshot covers that range)
 *     and reads merge the archive back, so projections and audit queries are
 *     unaffected.
 *
 * Run it from a scheduler (bootKernel({ compaction: { intervalMs } })) or
 * manually; every run converges, so overlapping runs are harmless.
 */
export class EventCompactor {
  private readonly minEvents: number

  constructor(
    private store: EventStore,
    private opts: CompactionOptions = {}
  ) {
    this.minEvents = opts.minEventsPerAggregate ?? 50
  }

  async run(tenant: TenantContext): Promise<CompactionReport> {
    const startedAt = Date.now()
    const compactable = this.store as Partial<CompactableEventStore>
    const pruneSupported = typeof compactable.compactAggregate === "function"
    const dryRun = this.opts.dryRun ?? false
    const report: CompactionReport = {
      dryRun,
      streamsConsidered: 0,
      snapshotsTaken: 0,
      streamsCompacted: 0,
      eventsPruned: 0,
      streamsSkipped: 0,
      pruneSupported,
      tookMs: 0,
    }

    const events = await this.store.query({ tenant })
    type Stream = { aggregateType: string; aggregateId: string; head: number; events: StoredEvent[] }
    const streams = new Map<string, Stream>()
    for (const e of events) {
      const key = `${e.aggregateType}::${e.aggregateId}`
      const stream = streams.get(key) ?? {
        aggregateType: e.aggregateType,
        aggregateId: e.aggregateId,
        head: 0,
        events: [],
      }
      stream.head = Math.max(stream.head, e.aggregateVersion)
      stream.events.push(e)
      streams.set(key, stream)
    }

    for (const stream of streams.values()) {
      if (stream.events.length < this.minEvents) continue
      report.streamsConsidered++
      try {
        // Pass 1: snapshot backfill (bounds replay regardless of pruning).
        const existing = await this.store.loadSnapshot(
          tenant,
          stream.aggregateType,
          stream.aggregateId
        )
        let snapshotVersion = existing?.version ?? 0
        if (!existing || existing.version < stream.head) {
          if (dryRun) {
            report.snapshotsTaken++
            snapshotVersion = stream.head
          } else {
            const agg = await loadAggregate(this.store, stream.aggregateType, tenant, stream.aggregateId)
            if (agg.version > 0) {
              await this.store.saveSnapshot({
                aggregateType: agg.aggregateType,
                aggregateId: agg.id,
                tenant: agg.tenant,
                version: agg.version,
                state: agg.state,
                takenAt: new Date().toISOString(),
              })
              report.snapshotsTaken++
              snapshotVersion = agg.version
            }
          }
        }

        // Pass 2: prune superseded events into the cold archive (opt-in).
        if (this.opts.prune && pruneSupported && snapshotVersion > 0) {
          const store = compactable as CompactableEventStore
          const archived = await store.archivedEvents({
            tenant,
            aggregateType: stream.aggregateType,
            aggregateId: stream.aggregateId,
          })
          const archivedIds = new Set(archived.map((e) => e.eventId))
          const pruneable = stream.events.filter(
            (e) => e.aggregateVersion <= snapshotVersion && !archivedIds.has(e.eventId)
          )
          if (pruneable.length === 0) continue
          if (dryRun) {
            report.eventsPruned += pruneable.length
            report.streamsCompacted++
          } else {
            const moved = await store.compactAggregate(
              tenant,
              stream.aggregateType,
              stream.aggregateId,
              snapshotVersion
            )
            if (moved.length > 0) {
              report.eventsPruned += moved.length
              report.streamsCompacted++
            }
          }
        }
      } catch (err) {
        report.streamsSkipped++
        console.error(
          `[kernel:compaction] skipped ${stream.aggregateType}/${stream.aggregateId}:`,
          err
        )
      }
    }

    report.tookMs = Date.now() - startedAt
    return report
  }
}
