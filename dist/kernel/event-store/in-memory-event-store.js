"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InMemoryEventStore = void 0;
const types_1 = require("@/kernel/types");
class ConflictError extends Error {
    constructor(message) {
        super(message);
        this.name = "ConflictError";
    }
}
function sameTenant(a, b) {
    return a.orgId === b.orgId && a.venueId === b.venueId;
}
function keyOf(tenant, aggregateType, aggregateId) {
    return `${tenant.orgId}::${tenant.venueId}::${aggregateType}::${aggregateId}`;
}
class InMemoryEventStore {
    constructor() {
        this.events = [];
        /** Cold tier: events moved out of `events` by compaction. Reads merge both. */
        this.archive = [];
        this.snapshots = new Map();
        this.position = 0;
        this.listeners = new Set();
    }
    async append(event, options) {
        const stored = await this.appendMany([event], options);
        return stored[0];
    }
    async appendMany(events, options) {
        if (events.length === 0)
            return [];
        const first = events[0];
        const k = keyOf(first.tenant, first.aggregateType, first.aggregateId);
        for (const e of events) {
            if (keyOf(e.tenant, e.aggregateType, e.aggregateId) !== k) {
                throw (0, types_1.kernelError)("BATCH_MIXED_AGGREGATE", "A single appendMany batch must target one aggregate");
            }
        }
        const existing = [...this.events, ...this.archive].filter((e) => keyOf(e.tenant, e.aggregateType, e.aggregateId) === k);
        // Version comes from live ∪ archive: after compaction the newest events may
        // be cold, but optimistic concurrency must still see their versions.
        const currentVersion = existing.reduce((max, e) => Math.max(max, e.aggregateVersion), 0);
        if ((options === null || options === void 0 ? void 0 : options.expectedVersion) !== undefined && options.expectedVersion !== currentVersion) {
            throw new ConflictError(`Optimistic concurrency conflict: expected v${options.expectedVersion}, current v${currentVersion}`);
        }
        const stored = events.map((e, i) => {
            var _a;
            const record = Object.assign(Object.assign({}, e), { eventId: (_a = e.eventId) !== null && _a !== void 0 ? _a : crypto.randomUUID(), globalPosition: ++this.position, aggregateVersion: currentVersion + i + 1 });
            return record;
        });
        this.events.push(...stored);
        for (const s of stored) {
            for (const listener of this.listeners) {
                try {
                    listener(s);
                }
                catch (_a) {
                    // listener failures must not break the append
                }
            }
        }
        return stored;
    }
    async query(q) {
        var _a;
        // Archived (cold) events merge back in so projections/rebuilds stay correct.
        let result = [...this.events, ...this.archive].filter((e) => sameTenant(e.tenant, q.tenant));
        if (q.aggregateType)
            result = result.filter((e) => e.aggregateType === q.aggregateType);
        if (q.aggregateId)
            result = result.filter((e) => e.aggregateId === q.aggregateId);
        if ((_a = q.eventTypes) === null || _a === void 0 ? void 0 : _a.length)
            result = result.filter((e) => q.eventTypes.includes(e.eventType));
        if (q.fromGlobalPosition !== undefined)
            result = result.filter((e) => e.globalPosition > q.fromGlobalPosition);
        result.sort((a, b) => a.globalPosition - b.globalPosition);
        if (q.limit)
            result = result.slice(0, q.limit);
        return result;
    }
    async readAggregate(tenant, aggregateType, aggregateId, fromVersion, limit) {
        const events = [...this.events, ...this.archive].filter((e) => sameTenant(e.tenant, tenant) &&
            e.aggregateType === aggregateType &&
            e.aggregateId === aggregateId);
        events.sort((a, b) => a.aggregateVersion - b.aggregateVersion);
        const tail = fromVersion === undefined ? events : events.filter((e) => e.aggregateVersion > fromVersion);
        return limit ? tail.slice(0, limit) : tail;
    }
    async saveSnapshot(snapshot) {
        this.snapshots.set(keyOf(snapshot.tenant, snapshot.aggregateType, snapshot.aggregateId), snapshot);
    }
    async loadSnapshot(tenant, aggregateType, aggregateId) {
        var _a;
        return (_a = this.snapshots.get(keyOf(tenant, aggregateType, aggregateId))) !== null && _a !== void 0 ? _a : null;
    }
    subscribe(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }
    /** Move events at/below `throughVersion` for this stream into the cold archive. */
    async compactAggregate(tenant, aggregateType, aggregateId, throughVersion) {
        const moved = [];
        const kept = [];
        for (const e of this.events) {
            const match = sameTenant(e.tenant, tenant) &&
                e.aggregateType === aggregateType &&
                e.aggregateId === aggregateId &&
                e.aggregateVersion <= throughVersion;
            if (match)
                moved.push(e);
            else
                kept.push(e);
        }
        this.events = kept;
        this.archive.push(...moved);
        return moved;
    }
    /** Explicit read of the cold archive (audit / compaction bookkeeping). */
    async archivedEvents(q) {
        var _a;
        let result = this.archive.filter((e) => sameTenant(e.tenant, q.tenant));
        if (q.aggregateType)
            result = result.filter((e) => e.aggregateType === q.aggregateType);
        if (q.aggregateId)
            result = result.filter((e) => e.aggregateId === q.aggregateId);
        if ((_a = q.eventTypes) === null || _a === void 0 ? void 0 : _a.length)
            result = result.filter((e) => q.eventTypes.includes(e.eventType));
        if (q.fromGlobalPosition !== undefined)
            result = result.filter((e) => e.globalPosition > q.fromGlobalPosition);
        result.sort((a, b) => a.globalPosition - b.globalPosition);
        if (q.limit)
            result = result.slice(0, q.limit);
        return result;
    }
}
exports.InMemoryEventStore = InMemoryEventStore;
