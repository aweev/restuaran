"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deliveryConnector = deliveryConnector;
const connectors_1 = require("./connectors");
const STATUS_BY_EVENT = {
    "platform.orderReceived": "accepted",
    "order.sentToKitchen": "preparing",
    "kitchen.lineReady": "ready",
    "order.closed": "completed",
    "platform.orderCancelled": "cancelled",
};
/**
 * Delivery connector: mirrors marketplace order progress back to the platform
 * (rider dispatch / ETA feeds). platform.* events always carry the external
 * mapping; plain order events only matter when the order came in on the
 * "platform" channel (stamped on every Order event).
 */
function deliveryConnector() {
    return {
        id: "delivery",
        eventTypes: Object.keys(STATUS_BY_EVENT),
        build(event) {
            var _a, _b, _c, _d;
            const p = event.payload;
            const isPlatformEvent = event.eventType.startsWith("platform.");
            if (!isPlatformEvent && String((_a = p.channel) !== null && _a !== void 0 ? _a : "") !== "platform")
                return null;
            return {
                channel: "connector",
                target: "delivery",
                eventType: event.eventType,
                tenant: event.tenant,
                eventId: event.eventId,
                position: event.globalPosition,
                body: (0, connectors_1.connectorBody)(event, {
                    status: STATUS_BY_EVENT[event.eventType],
                    orderId: String((_b = p.orderId) !== null && _b !== void 0 ? _b : (isPlatformEvent ? event.aggregateId : event.aggregateId)),
                    platform: (_c = p.platform) !== null && _c !== void 0 ? _c : null,
                    externalOrderId: (_d = p.externalOrderId) !== null && _d !== void 0 ? _d : null,
                }),
            };
        },
    };
}
