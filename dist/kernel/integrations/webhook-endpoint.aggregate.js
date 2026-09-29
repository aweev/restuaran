"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebhookEndpointAggregate = exports.WILDCARD_EVENT_TYPE = void 0;
exports.assertWebhookUrl = assertWebhookUrl;
const crypto_1 = require("crypto");
const types_1 = require("@/kernel/types");
const aggregate_1 = require("@/kernel/aggregates/aggregate");
exports.WILDCARD_EVENT_TYPE = "*";
const emptyEndpointState = {
    url: "",
    secret: "",
    eventTypes: [],
    active: false,
    createdAt: "",
    updatedAt: "",
};
function assertWebhookUrl(url) {
    let parsed;
    try {
        parsed = new URL(url);
    }
    catch (_a) {
        throw (0, types_1.kernelError)("INVALID_WEBHOOK_URL", `Not a valid URL: "${url}"`);
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        throw (0, types_1.kernelError)("INVALID_WEBHOOK_URL", `Webhook URL must be http(s): "${url}"`);
    }
}
function normalizeEventTypes(eventTypes) {
    if (!eventTypes || eventTypes.length === 0)
        return [exports.WILDCARD_EVENT_TYPE];
    return [...new Set(eventTypes.map((t) => String(t).trim()).filter(Boolean))];
}
/**
 * Event-sourced webhook subscription. Survives restarts via replay; the secret
 * used to sign deliveries lives on the aggregate (queries redact it).
 */
class WebhookEndpointAggregate extends aggregate_1.Aggregate {
    constructor(tenant) {
        super(WebhookEndpointAggregate.TYPE, tenant, Object.assign({}, emptyEndpointState));
    }
    static create(tenant, opts) {
        var _a;
        assertWebhookUrl(opts.url);
        const agg = new WebhookEndpointAggregate(tenant);
        agg.initialize(opts.id);
        agg.raise("webhook.subscribed", {
            url: opts.url,
            secret: (_a = opts.secret) !== null && _a !== void 0 ? _a : (0, crypto_1.randomUUID)(),
            eventTypes: normalizeEventTypes(opts.eventTypes),
            subscribedAt: new Date().toISOString(),
        }, opts.actor);
        return agg;
    }
    update(actor, changes) {
        if (!this.state.active) {
            throw (0, types_1.kernelError)("WEBHOOK_INACTIVE", `Endpoint ${this.id} is unsubscribed`);
        }
        const payload = {};
        if (changes.url !== undefined) {
            assertWebhookUrl(changes.url);
            payload.url = changes.url;
        }
        if (changes.eventTypes !== undefined)
            payload.eventTypes = normalizeEventTypes(changes.eventTypes);
        if (changes.secret !== undefined)
            payload.secret = changes.secret;
        if (Object.keys(payload).length === 0) {
            throw (0, types_1.kernelError)("NO_CHANGES", "Provide url, eventTypes and/or secret to update");
        }
        this.raise("webhook.updated", payload, actor);
    }
    unsubscribe(actor) {
        if (!this.state.active) {
            throw (0, types_1.kernelError)("WEBHOOK_INACTIVE", `Endpoint ${this.id} is already unsubscribed`);
        }
        this.raise("webhook.unsubscribed", {}, actor);
    }
    /** Does an (active) endpoint want this event type? Infra events never match. */
    matches(eventType) {
        if (!this.state.active)
            return false;
        if (this.state.eventTypes.includes(exports.WILDCARD_EVENT_TYPE))
            return true;
        return this.state.eventTypes.includes(eventType);
    }
    applyEvent(event) {
        var _a, _b, _c, _d, _e;
        const s = this.state;
        switch (event.eventType) {
            case "webhook.subscribed":
                return Object.assign(Object.assign({}, s), { url: String((_a = event.payload.url) !== null && _a !== void 0 ? _a : ""), secret: String((_b = event.payload.secret) !== null && _b !== void 0 ? _b : ""), eventTypes: (_c = event.payload.eventTypes) !== null && _c !== void 0 ? _c : [], active: true, createdAt: String((_d = event.payload.subscribedAt) !== null && _d !== void 0 ? _d : event.occurredAt), updatedAt: event.occurredAt });
            case "webhook.updated":
                return Object.assign(Object.assign({}, s), { url: event.payload.url !== undefined ? String(event.payload.url) : s.url, secret: event.payload.secret !== undefined ? String(event.payload.secret) : s.secret, eventTypes: event.payload.eventTypes !== undefined
                        ? ((_e = event.payload.eventTypes) !== null && _e !== void 0 ? _e : [])
                        : s.eventTypes, updatedAt: event.occurredAt });
            case "webhook.unsubscribed":
                return Object.assign(Object.assign({}, s), { active: false, updatedAt: event.occurredAt });
            default:
                return s;
        }
    }
}
exports.WebhookEndpointAggregate = WebhookEndpointAggregate;
WebhookEndpointAggregate.TYPE = "WebhookEndpoint";
