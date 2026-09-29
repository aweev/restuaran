"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventCompactor = void 0;
const registry_1 = require("@/kernel/aggregates/registry");
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
class EventCompactor {
    constructor(store, opts = {}) {
        var _a;
        this.store = store;
        this.opts = opts;
        this.minEvents = (_a = opts.minEventsPerAggregate) !== null && _a !== void 0 ? _a : 50;
    }
    async run(tenant) {
        var _a, _b, _c;
        const startedAt = Date.now();
        const compactable = this.store;
        const pruneSupported = typeof compactable.compactAggregate === "function";
        const dryRun = (_a = this.opts.dryRun) !== null && _a !== void 0 ? _a : false;
        const report = {
            dryRun,
            streamsConsidered: 0,
            snapshotsTaken: 0,
            streamsCompacted: 0,
            eventsPruned: 0,
            streamsSkipped: 0,
            pruneSupported,
            tookMs: 0,
        };
        const events = await this.store.query({ tenant });
        const streams = new Map();
        for (const e of events) {
            const key = `${e.aggregateType}::${e.aggregateId}`;
            const stream = (_b = streams.get(key)) !== null && _b !== void 0 ? _b : {
                aggregateType: e.aggregateType,
                aggregateId: e.aggregateId,
                head: 0,
                events: [],
            };
            stream.head = Math.max(stream.head, e.aggregateVersion);
            stream.events.push(e);
            streams.set(key, stream);
        }
        for (const stream of streams.values()) {
            if (stream.events.length < this.minEvents)
                continue;
            report.streamsConsidered++;
            try {
                // Pass 1: snapshot backfill (bounds replay regardless of pruning).
                const existing = await this.store.loadSnapshot(tenant, stream.aggregateType, stream.aggregateId);
                let snapshotVersion = (_c = existing === null || existing === void 0 ? void 0 : existing.version) !== null && _c !== void 0 ? _c : 0;
                if (!existing || existing.version < stream.head) {
                    if (dryRun) {
                        report.snapshotsTaken++;
                        snapshotVersion = stream.head;
                    }
                    else {
                        const agg = await (0, registry_1.loadAggregate)(this.store, stream.aggregateType, tenant, stream.aggregateId);
                        if (agg.version > 0) {
                            await this.store.saveSnapshot({
                                aggregateType: agg.aggregateType,
                                aggregateId: agg.id,
                                tenant: agg.tenant,
                                version: agg.version,
                                state: agg.state,
                                takenAt: new Date().toISOString(),
                            });
                            report.snapshotsTaken++;
                            snapshotVersion = agg.version;
                        }
                    }
                }
                // Pass 2: prune superseded events into the cold archive (opt-in).
                if (this.opts.prune && pruneSupported && snapshotVersion > 0) {
                    const store = compactable;
                    const archived = await store.archivedEvents({
                        tenant,
                        aggregateType: stream.aggregateType,
                        aggregateId: stream.aggregateId,
                    });
                    const archivedIds = new Set(archived.map((e) => e.eventId));
                    const pruneable = stream.events.filter((e) => e.aggregateVersion <= snapshotVersion && !archivedIds.has(e.eventId));
                    if (pruneable.length === 0)
                        continue;
                    if (dryRun) {
                        report.eventsPruned += pruneable.length;
                        report.streamsCompacted++;
                    }
                    else {
                        const moved = await store.compactAggregate(tenant, stream.aggregateType, stream.aggregateId, snapshotVersion);
                        if (moved.length > 0) {
                            report.eventsPruned += moved.length;
                            report.streamsCompacted++;
                        }
                    }
                }
            }
            catch (err) {
                report.streamsSkipped++;
                console.error(`[kernel:compaction] skipped ${stream.aggregateType}/${stream.aggregateId}:`, err);
            }
        }
        report.tookMs = Date.now() - startedAt;
        return report;
    }
}
exports.EventCompactor = EventCompactor;
