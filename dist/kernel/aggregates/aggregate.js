"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Aggregate = void 0;
const types_1 = require("@/kernel/types");
const event_store_1 = require("@/kernel/event-store/event-store");
class Aggregate {
    constructor(aggregateType, tenant, initialState) {
        this._id = null;
        this._version = 0;
        this._uncommitted = [];
        this.aggregateType = aggregateType;
        this.tenant = tenant;
        this._state = initialState;
    }
    get id() {
        if (!this._id)
            throw (0, types_1.kernelError)("AGGREGATE_UNINITIALIZED", `${this.aggregateType} has no id yet`);
        return this._id;
    }
    get version() {
        return this._version;
    }
    /**
     * True once the stream has history (committed events / snapshot) or a
     * genesis event raised this same unit of work. A loaded aggregate with no
     * events and no pending creation does NOT exist — callers use
     * requireAggregate() to reject mutations against unknown ids instead of
     * silently spawning an orphan stream.
     */
    get exists() {
        return this._version > 0 || this._uncommitted.length > 0;
    }
    get state() {
        return this._state;
    }
    get uncommittedEvents() {
        return this._uncommitted;
    }
    get expectedVersion() {
        return this._version;
    }
    raise(eventType, payload, actor) {
        const event = (0, event_store_1.buildEvent)({
            eventType,
            aggregateType: this.aggregateType,
            aggregateId: this.id,
            aggregateVersion: this._version + this._uncommitted.length + 1,
            tenant: this.tenant,
            payload,
            actor,
        });
        this._uncommitted.push(event);
        this._state = this.applyEvent(event);
    }
    markCommitted(committed) {
        if (committed.length > this._uncommitted.length) {
            throw (0, types_1.kernelError)("COMMIT_MISMATCH", "More committed events than pending");
        }
        this._uncommitted = this._uncommitted.slice(committed.length);
        this._version = Math.max(this._version, ...committed.map((e) => e.aggregateVersion));
    }
    restoreFromSnapshot(version, state) {
        this._version = version;
        this._state = state;
    }
    replay(event) {
        if (event.aggregateVersion <= this._version)
            return;
        if (event.aggregateVersion !== this._version + 1) {
            throw (0, types_1.kernelError)("VERSION_GAP", `Missing event for ${this.aggregateType}/${this.id}: expected v${this._version + 1}, got v${event.aggregateVersion}`);
        }
        this._state = this.applyEvent(event);
        this._version = event.aggregateVersion;
    }
    initialize(id) {
        this._id = id;
    }
}
exports.Aggregate = Aggregate;
