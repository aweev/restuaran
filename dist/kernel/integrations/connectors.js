"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConnectorRegistry = void 0;
exports.connectorBody = connectorBody;
const outbound_queue_1 = require("./outbound-queue");
class ConnectorRegistry {
    constructor() {
        this.connectors = new Map();
    }
    register(connector) {
        if (this.connectors.has(connector.id)) {
            throw new Error(`Connector already registered: ${connector.id}`);
        }
        this.connectors.set(connector.id, connector);
    }
    unregister(id) {
        return this.connectors.delete(id);
    }
    ids() {
        return [...this.connectors.keys()];
    }
    match(eventType) {
        if ((0, outbound_queue_1.isInfraEvent)(eventType))
            return [];
        return [...this.connectors.values()].filter((c) => c.eventTypes.includes(eventType));
    }
    /** Build outbound messages for all connectors interested in this event. */
    fanout(event) {
        const inputs = [];
        for (const connector of this.match(event.eventType)) {
            const built = connector.build(event);
            if (!built)
                continue;
            inputs.push(...(Array.isArray(built) ? built : [built]));
        }
        return inputs;
    }
}
exports.ConnectorRegistry = ConnectorRegistry;
/** Shared envelope for outbound connector messages. */
function connectorBody(event, extra) {
    return Object.assign({ id: event.eventId, type: event.eventType, occurredAt: event.occurredAt, tenant: { orgId: event.tenant.orgId, venueId: event.tenant.venueId }, aggregate: { type: event.aggregateType, id: event.aggregateId, version: event.aggregateVersion }, payload: event.payload }, extra);
}
