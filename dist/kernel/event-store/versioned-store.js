"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VersionedEventStore = exports.UpcastRegistry = exports.SCHEMA_VERSION_KEY = exports.CURRENT_SCHEMA_VERSION = void 0;
exports.schemaVersionOf = schemaVersionOf;
exports.defaultUpcasters = defaultUpcasters;
const types_1 = require("@/kernel/types");
exports.CURRENT_SCHEMA_VERSION = 1;
exports.SCHEMA_VERSION_KEY = "schemaVersion";
function schemaVersionOf(event) {
    var _a;
    const v = (_a = event.metadata) === null || _a === void 0 ? void 0 : _a[exports.SCHEMA_VERSION_KEY];
    return typeof v === "number" ? v : 1;
}
/**
 * Registry of forward-only payload transformers, one per (eventType, version step).
 * Legacy event payloads are upgraded on read so aggregates only ever see the
 * current schema — no destructive migrations, replay stays correct.
 */
class UpcastRegistry {
    constructor() {
        this.steps = new Map();
    }
    register(reg) {
        var _a;
        const byVersion = (_a = this.steps.get(reg.eventType)) !== null && _a !== void 0 ? _a : new Map();
        byVersion.set(reg.fromVersion, reg);
        this.steps.set(reg.eventType, byVersion);
        return this;
    }
    upcast(event) {
        const chain = this.steps.get(event.eventType);
        if (!chain)
            return event;
        let version = schemaVersionOf(event);
        let payload = event.payload;
        let meta = Object.assign({}, event.metadata);
        let guard = 0;
        while (chain.has(version) && guard++ < 100) {
            const reg = chain.get(version);
            const result = reg.upcast(payload, meta);
            payload = result.payload;
            const stamped = result.meta[exports.SCHEMA_VERSION_KEY];
            meta = Object.assign(Object.assign({}, result.meta), { [exports.SCHEMA_VERSION_KEY]: typeof stamped === "number" ? stamped : reg.toVersion });
            version = reg.toVersion;
        }
        return Object.assign(Object.assign({}, event), { payload, metadata: meta });
    }
}
exports.UpcastRegistry = UpcastRegistry;
/**
 * Decorator EventStore that stamps the current schema version on append and
 * upcasts on read/subscribe. Snapshots are version-tagged and rejected when
 * stale (forcing a full replay through the upcast chain).
 */
class VersionedEventStore {
    constructor(inner, upcasts, schemaVersion = exports.CURRENT_SCHEMA_VERSION) {
        this.inner = inner;
        this.upcasts = upcasts;
        this.schemaVersion = schemaVersion;
    }
    get version() {
        return this.schemaVersion;
    }
    async append(event, options) {
        const [stored] = await this.inner.appendMany(this.stamp([event]), options);
        return stored;
    }
    async appendMany(events, options) {
        return this.inner.appendMany(this.stamp(events), options);
    }
    async query(q) {
        const rows = await this.inner.query(q);
        return rows.map((e) => this.upcasts.upcast(e));
    }
    async readAggregate(tenant, aggregateType, aggregateId, fromVersion, limit) {
        const rows = await this.inner.readAggregate(tenant, aggregateType, aggregateId, fromVersion, limit);
        return rows.map((e) => this.upcasts.upcast(e));
    }
    async saveSnapshot(snapshot) {
        return this.inner.saveSnapshot(Object.assign(Object.assign({}, snapshot), { snapshotSchemaVersion: this.schemaVersion }));
    }
    async loadSnapshot(tenant, aggregateType, aggregateId) {
        var _a;
        const snap = await this.inner.loadSnapshot(tenant, aggregateType, aggregateId);
        if (!snap)
            return null;
        const snapVersion = (_a = snap.snapshotSchemaVersion) !== null && _a !== void 0 ? _a : 1;
        if (snapVersion !== this.schemaVersion)
            return null;
        return snap;
    }
    subscribe(listener) {
        return this.inner.subscribe((event) => listener(this.upcasts.upcast(event)));
    }
    // ---- Compaction delegation (Phase 3): moves raw rows, upcasts on read ----
    async compactAggregate(tenant, aggregateType, aggregateId, throughVersion) {
        const inner = this.inner;
        if (typeof inner.compactAggregate !== "function") {
            throw (0, types_1.kernelError)("NOT_COMPACTABLE", "The underlying event store does not support compaction");
        }
        return inner.compactAggregate(tenant, aggregateType, aggregateId, throughVersion);
    }
    async archivedEvents(q) {
        const inner = this.inner;
        if (typeof inner.archivedEvents !== "function")
            return [];
        const rows = await inner.archivedEvents(q);
        return rows.map((e) => this.upcasts.upcast(e));
    }
    stamp(events) {
        return events.map((e) => {
            var _a, _b;
            return (Object.assign(Object.assign({}, e), { metadata: Object.assign(Object.assign({}, e.metadata), { [exports.SCHEMA_VERSION_KEY]: (_b = (_a = e.metadata) === null || _a === void 0 ? void 0 : _a[exports.SCHEMA_VERSION_KEY]) !== null && _b !== void 0 ? _b : this.schemaVersion }) }));
        });
    }
}
exports.VersionedEventStore = VersionedEventStore;
/** Upcasters shared by every kernel instance. Extend in later phases. */
function defaultUpcasters() {
    return new UpcastRegistry();
}
