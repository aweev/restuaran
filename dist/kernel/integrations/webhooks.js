"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HttpWebhookTransport = exports.DELIVERY_HEADER = exports.EVENT_HEADER = exports.TIMESTAMP_HEADER = exports.SIGNATURE_HEADER = void 0;
exports.signBody = signBody;
exports.verifyWebhookSignature = verifyWebhookSignature;
exports.webhookEnvelope = webhookEnvelope;
exports.webhookDeliveriesFor = webhookDeliveriesFor;
const crypto_1 = require("crypto");
const outbound_queue_1 = require("./outbound-queue");
const webhook_endpoint_aggregate_1 = require("./webhook-endpoint.aggregate");
exports.SIGNATURE_HEADER = "X-ROS-Signature";
exports.TIMESTAMP_HEADER = "X-ROS-Timestamp";
exports.EVENT_HEADER = "X-ROS-Event";
exports.DELIVERY_HEADER = "X-ROS-Delivery";
/** HMAC-SHA256 over `${timestamp}.${rawBody}` — the contract external receivers verify. */
function signBody(secret, rawBody, timestamp = Math.floor(Date.now() / 1000)) {
    const signature = `sha256=${(0, crypto_1.createHmac)("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex")}`;
    return { timestamp, raw: rawBody, signature };
}
/** Constant-time verification helper for receivers (and our own smoke test). */
function verifyWebhookSignature(secret, timestamp, rawBody, signature) {
    const expected = signBody(secret, rawBody, Number(timestamp));
    const a = Buffer.from(expected.signature);
    const b = Buffer.from(String(signature !== null && signature !== void 0 ? signature : ""));
    if (a.length !== b.length)
        return false;
    return (0, crypto_1.timingSafeEqual)(a, b);
}
/** Canonical envelope every webhook subscriber receives. */
function webhookEnvelope(event) {
    var _a, _b;
    return {
        id: event.eventId,
        type: event.eventType,
        occurredAt: event.occurredAt,
        position: event.globalPosition,
        tenant: Object.assign({ orgId: event.tenant.orgId, venueId: event.tenant.venueId }, (event.tenant.zoneId ? { zoneId: event.tenant.zoneId } : {})),
        aggregate: { type: event.aggregateType, id: event.aggregateId, version: event.aggregateVersion },
        actor: (_b = (_a = event.actor) === null || _a === void 0 ? void 0 : _a.userId) !== null && _b !== void 0 ? _b : null,
        payload: event.payload,
        metadata: event.metadata,
    };
}
/**
 * Enqueue inputs for every active endpoint subscribed to this event.
 * Infra events (webhook./outbound.) are never delivered, even to wildcards.
 */
function webhookDeliveriesFor(event, endpoints) {
    if ((0, outbound_queue_1.isInfraEvent)(event.eventType))
        return [];
    const matching = endpoints.filter((ep) => ep.active &&
        (ep.eventTypes.includes(webhook_endpoint_aggregate_1.WILDCARD_EVENT_TYPE) || ep.eventTypes.includes(event.eventType)));
    if (matching.length === 0)
        return [];
    const body = webhookEnvelope(event);
    const raw = JSON.stringify(body);
    return matching.map((ep) => {
        const { timestamp, signature } = signBody(ep.secret, raw);
        return {
            channel: "webhook",
            target: ep.url,
            eventType: event.eventType,
            tenant: event.tenant,
            eventId: event.eventId,
            position: event.globalPosition,
            body,
            headers: {
                [exports.EVENT_HEADER]: event.eventType,
                [exports.TIMESTAMP_HEADER]: String(timestamp),
                [exports.SIGNATURE_HEADER]: signature,
            },
        };
    });
}
/** Production transport: POSTs the signed envelope to the subscriber URL. */
class HttpWebhookTransport {
    constructor(fetchImpl) {
        this.doFetch = fetchImpl !== null && fetchImpl !== void 0 ? fetchImpl : fetch;
    }
    async deliver(message) {
        const res = await this.doFetch(message.target, {
            method: "POST",
            headers: Object.assign({ "Content-Type": "application/json" }, message.headers),
            body: JSON.stringify(message.body),
        });
        if (!res.ok) {
            throw new Error(`webhook delivery failed: ${res.status} ${await res.text().catch(() => "")}`);
        }
    }
}
exports.HttpWebhookTransport = HttpWebhookTransport;
