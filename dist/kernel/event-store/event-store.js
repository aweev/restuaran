"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildEvent = buildEvent;
exports.eventTopic = eventTopic;
const crypto_1 = require("crypto");
function buildEvent(input) {
    var _a;
    return {
        eventId: (0, crypto_1.randomUUID)(),
        eventType: input.eventType,
        aggregateType: input.aggregateType,
        aggregateId: input.aggregateId,
        aggregateVersion: input.aggregateVersion,
        tenant: input.tenant,
        actor: input.actor,
        occurredAt: (_a = input.occurredAt) !== null && _a !== void 0 ? _a : new Date().toISOString(),
        payload: input.payload,
        metadata: Object.assign({ source: "system" }, input.metadata),
    };
}
function eventTopic(event) {
    return `${event.tenant.orgId}.${event.tenant.venueId}.${event.eventType}`;
}
