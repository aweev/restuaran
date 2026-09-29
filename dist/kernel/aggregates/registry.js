"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerAggregate = registerAggregate;
exports.aggregateConstructor = aggregateConstructor;
exports.loadAggregate = loadAggregate;
exports.loadExisting = loadExisting;
exports.saveAggregate = saveAggregate;
exports.appendEvent = appendEvent;
const types_1 = require("@/kernel/types");
const event_store_1 = require("@/kernel/event-store/event-store");
const registry = new Map();
function registerAggregate(aggregateType, ctor) {
    registry.set(aggregateType, ctor);
}
function aggregateConstructor(aggregateType) {
    const ctor = registry.get(aggregateType);
    if (!ctor)
        throw (0, types_1.kernelError)("UNKNOWN_AGGREGATE", `No aggregate registered for type "${aggregateType}"`);
    return ctor;
}
async function loadAggregate(store, aggregateType, tenant, aggregateId) {
    var _a;
    const Ctor = aggregateConstructor(aggregateType);
    const agg = new Ctor(tenant);
    agg.initialize(aggregateId);
    const snapshot = await store.loadSnapshot(tenant, aggregateType, aggregateId);
    if (snapshot)
        agg.restoreFromSnapshot(snapshot.version, snapshot.state);
    const events = await store.readAggregate(tenant, aggregateType, aggregateId, (_a = snapshot === null || snapshot === void 0 ? void 0 : snapshot.version) !== null && _a !== void 0 ? _a : 0);
    for (const e of events)
        agg.replay(e);
    return agg;
}
/**
 * Load for *mutation*: rejects ids that have no stream, so a typo/unknown id
 * yields AGGREGATE_NOT_FOUND instead of silently creating an orphan aggregate.
 */
async function loadExisting(store, aggregateType, tenant, aggregateId) {
    const agg = await loadAggregate(store, aggregateType, tenant, aggregateId);
    if (agg.version === 0) {
        throw (0, types_1.kernelError)("AGGREGATE_NOT_FOUND", `No ${aggregateType} "${aggregateId}" exists in this venue`);
    }
    return agg;
}
async function saveAggregate(store, agg) {
    if (agg.uncommittedEvents.length === 0)
        return [];
    const pending = [...agg.uncommittedEvents];
    const committed = await store.appendMany(pending, { expectedVersion: agg.expectedVersion });
    agg.markCommitted(committed);
    return committed;
}
/**
 * Append a single event directly to an aggregate stream (e.g. kitchen
 * line-status updates on an Order stream). Bumps version with optimistic
 * locking; the aggregate's applyEvent is the reducer that decides its effect.
 */
async function appendEvent(store, tenant, aggregateType, aggregateId, eventType, payload, actor) {
    const current = await store.readAggregate(tenant, aggregateType, aggregateId);
    const version = current.length > 0 ? current[current.length - 1].aggregateVersion : 0;
    const event = (0, event_store_1.buildEvent)({
        eventType,
        aggregateType,
        aggregateId,
        aggregateVersion: version + 1,
        tenant,
        payload,
        actor,
    });
    return store.append(event, { expectedVersion: version });
}
