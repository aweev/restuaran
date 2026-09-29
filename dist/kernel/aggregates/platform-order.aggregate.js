"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlatformOrderAggregate = void 0;
exports.platformOrderId = platformOrderId;
const crypto_1 = require("crypto");
const types_1 = require("@/kernel/types");
const aggregate_1 = require("./aggregate");
const emptyState = {
    platform: "",
    externalOrderId: "",
    orderId: null,
    status: "received",
    fulfillment: "delivery",
    customerName: null,
    itemsSubtotal: 0,
    itemCount: 0,
    receivedAt: "",
    closedAt: null,
    reason: null,
};
/**
 * Deterministic UUID-shaped id for `(platform, externalOrderId)`, so re-ingesting
 * the same marketplace order maps onto the same stream — idempotency falls out
 * of aggregate identity instead of a side table. UUID-shaped to fit PG uuid columns.
 */
function platformOrderId(platform, externalOrderId) {
    const hex = (0, crypto_1.createHash)("sha256").update(`${platform}#${externalOrderId}`).digest("hex").slice(0, 32);
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}
/**
 * Marketplace order injection record: maps an external platform order onto the
 * internal POS Order. The POS order is created through the command bus (so
 * cross-module policies like the 86 veto apply); this aggregate tracks the
 * external identity + lifecycle (received -> completed | cancelled).
 */
class PlatformOrderAggregate extends aggregate_1.Aggregate {
    constructor(tenant) {
        super(PlatformOrderAggregate.TYPE, tenant, Object.assign({}, emptyState));
    }
    static create(tenant, opts) {
        var _a, _b;
        const agg = new PlatformOrderAggregate(tenant);
        agg.initialize(opts.id);
        agg.raise("platform.orderReceived", {
            platform: opts.platform,
            externalOrderId: opts.externalOrderId,
            orderId: opts.orderId,
            fulfillment: (_a = opts.fulfillment) !== null && _a !== void 0 ? _a : "delivery",
            customerName: (_b = opts.customerName) !== null && _b !== void 0 ? _b : null,
            itemsSubtotal: opts.itemsSubtotal,
            itemCount: opts.itemCount,
            receivedAt: new Date().toISOString(),
        }, opts.actor);
        return agg;
    }
    cancel(actor, reason) {
        if (this.state.status !== "received") {
            throw (0, types_1.kernelError)("PLATFORM_ORDER_TERMINAL", `Platform order is ${this.state.status}`);
        }
        this.raise("platform.orderCancelled", { reason }, actor);
    }
    complete(actor) {
        if (this.state.status !== "received") {
            throw (0, types_1.kernelError)("PLATFORM_ORDER_TERMINAL", `Platform order is ${this.state.status}`);
        }
        this.raise("platform.orderCompleted", {}, actor);
    }
    applyEvent(event) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j;
        const s = this.state;
        switch (event.eventType) {
            case "platform.orderReceived":
                return Object.assign(Object.assign({}, s), { platform: String((_a = event.payload.platform) !== null && _a !== void 0 ? _a : ""), externalOrderId: String((_b = event.payload.externalOrderId) !== null && _b !== void 0 ? _b : ""), orderId: (_c = event.payload.orderId) !== null && _c !== void 0 ? _c : null, fulfillment: (_d = event.payload.fulfillment) !== null && _d !== void 0 ? _d : "delivery", customerName: (_e = event.payload.customerName) !== null && _e !== void 0 ? _e : null, itemsSubtotal: Number((_f = event.payload.itemsSubtotal) !== null && _f !== void 0 ? _f : 0), itemCount: Number((_g = event.payload.itemCount) !== null && _g !== void 0 ? _g : 0), receivedAt: String((_h = event.payload.receivedAt) !== null && _h !== void 0 ? _h : event.occurredAt), status: "received", closedAt: null, reason: null });
            case "platform.orderCancelled":
                return Object.assign(Object.assign({}, s), { status: "cancelled", reason: String((_j = event.payload.reason) !== null && _j !== void 0 ? _j : "cancelled"), closedAt: event.occurredAt });
            case "platform.orderCompleted":
                return Object.assign(Object.assign({}, s), { status: "completed", closedAt: event.occurredAt });
            default:
                return s;
        }
    }
}
exports.PlatformOrderAggregate = PlatformOrderAggregate;
PlatformOrderAggregate.TYPE = "PlatformOrder";
