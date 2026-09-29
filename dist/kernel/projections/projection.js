"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProjectionRegistry = exports.Projection = void 0;
exports.defineProjection = defineProjection;
const types_1 = require("@/kernel/types");
class Projection {
    constructor(spec, store, tenant) {
        this.spec = spec;
        this.store = store;
        this.tenant = tenant;
        this.cursor = 0;
        this.listeners = new Set();
        this.unsubscribe = null;
        this.current = spec.initial;
    }
    get state() {
        return this.current;
    }
    get position() {
        return this.cursor;
    }
    matches(event) {
        return (event.tenant.orgId === this.tenant.orgId &&
            event.tenant.venueId === this.tenant.venueId &&
            this.spec.watchedEventTypes.includes(event.eventType));
    }
    async rebuild() {
        this.current = this.spec.initial;
        this.cursor = 0;
        const events = await this.store.query({
            tenant: this.tenant,
            eventTypes: this.spec.watchedEventTypes,
        });
        for (const e of events) {
            this.current = this.spec.reduce(this.current, e);
            this.cursor = Math.max(this.cursor, e.globalPosition);
        }
        this.notify();
        return this.current;
    }
    catchUp() {
        return this.rebuild();
    }
    apply(event) {
        if (!this.matches(event))
            return;
        if (event.globalPosition <= this.cursor)
            return;
        this.current = this.spec.reduce(this.current, event);
        this.cursor = event.globalPosition;
        this.notify();
    }
    start() {
        if (this.unsubscribe)
            return;
        this.unsubscribe = this.store.subscribe((event) => this.apply(event));
    }
    stop() {
        var _a;
        (_a = this.unsubscribe) === null || _a === void 0 ? void 0 : _a.call(this);
        this.unsubscribe = null;
    }
    onChange(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }
    notify() {
        for (const l of this.listeners) {
            try {
                l(this.current);
            }
            catch (err) {
                // eslint-disable-next-line no-console
                console.error(`[kernel:projection:${this.spec.name}] onChange failed:`, err);
            }
        }
    }
}
exports.Projection = Projection;
class ProjectionRegistry {
    constructor() {
        this.projections = new Map();
    }
    register(projection) {
        if (this.projections.has(projection.spec.name)) {
            throw (0, types_1.kernelError)("DUPLICATE_PROJECTION", `Projection already registered: ${projection.spec.name}`);
        }
        this.projections.set(projection.spec.name, projection);
        return projection;
    }
    get(name) {
        const p = this.projections.get(name);
        if (!p)
            throw (0, types_1.kernelError)("UNKNOWN_PROJECTION", `No projection registered named "${name}"`);
        return p;
    }
    names() {
        return [...this.projections.keys()];
    }
    async rebuildAll() {
        for (const p of this.projections.values()) {
            await p.rebuild();
        }
    }
    startAll() {
        for (const p of this.projections.values())
            p.start();
    }
    stopAll() {
        for (const p of this.projections.values())
            p.stop();
    }
}
exports.ProjectionRegistry = ProjectionRegistry;
// Convenience factory: define a projection from a plain spec.
function defineProjection(spec, store, tenant) {
    return new Projection(spec, store, tenant);
}
