"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AggregateRepository = exports.defaultSnapshotPolicy = void 0;
const defaultSnapshotPolicy = (every = 50) => ({
    every,
    shouldSnapshot: (_committed, version) => every > 0 && version % every === 0,
});
exports.defaultSnapshotPolicy = defaultSnapshotPolicy;
/**
 * The single write path for every command (core + modules): loads with the
 * existence guard, persists, then applies the snapshot policy. Centralizing
 * this means snapshots and AGGREGATE_NOT_FOUND enforcement can never be
 * skipped by a handler that forgets to route through saveAggregate.
 */
class AggregateRepository {
    constructor(deps) {
        this.deps = deps;
    }
    /** Load an aggregate for mutation. Throws AGGREGATE_NOT_FOUND for unknown ids. */
    load(type, tenant, id) {
        return this.deps.load(this.deps.events, type, tenant, id);
    }
    /** Load without the existence guard — for cross-module checks on possibly-absent ids. */
    read(type, tenant, id) {
        return this.deps.read(this.deps.events, type, tenant, id);
    }
    async save(agg) {
        const committed = await this.deps.saveAggregate(this.deps.events, agg);
        await this.maybeSnapshot(agg, committed);
        return committed;
    }
    /** Load-with-guard, run a behavior, commit, publish. The handler happy path. */
    async mutate(type, tenant, id, behavior) {
        const agg = await this.load(type, tenant, id);
        behavior(agg);
        return this.save(agg);
    }
    async maybeSnapshot(agg, committed) {
        var _a;
        if (committed.length === 0)
            return;
        const view = agg;
        const policy = (_a = this.deps.snapshot) !== null && _a !== void 0 ? _a : (0, exports.defaultSnapshotPolicy)();
        if (!policy.shouldSnapshot(committed, view.version))
            return;
        try {
            await this.deps.events.saveSnapshot({
                aggregateType: agg.aggregateType,
                aggregateId: agg.id,
                tenant: agg.tenant,
                version: view.version,
                state: view.state,
                takenAt: new Date().toISOString(),
            });
        }
        catch (err) {
            // The write is already committed; a failed snapshot is non-fatal and the
            // next save (or a compaction job) retries it. Never break the command path.
            // eslint-disable-next-line no-console
            console.error("[kernel:snapshot] failed:", err);
        }
    }
}
exports.AggregateRepository = AggregateRepository;
