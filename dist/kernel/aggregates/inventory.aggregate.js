"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InventoryItemAggregate = void 0;
const types_1 = require("@/kernel/types");
const aggregate_1 = require("./aggregate");
class InventoryItemAggregate extends aggregate_1.Aggregate {
    constructor(tenant) {
        super(InventoryItemAggregate.TYPE, tenant, {
            sku: "",
            name: "",
            unit: "ea",
            onHand: 0,
            reserved: 0,
            reorderPoint: 0,
            unitCost: 0,
            vendorId: null,
            wastageTotal: 0,
        });
    }
    static define(tenant, opts) {
        var _a, _b, _c;
        const agg = new InventoryItemAggregate(tenant);
        agg.initialize(opts.id);
        agg.raise("inventory.itemDefined", {
            sku: opts.sku,
            name: opts.name,
            unit: opts.unit,
            reorderPoint: (_a = opts.reorderPoint) !== null && _a !== void 0 ? _a : 0,
            unitCost: (_b = opts.unitCost) !== null && _b !== void 0 ? _b : 0,
            vendorId: (_c = opts.vendorId) !== null && _c !== void 0 ? _c : null,
        }, opts.actor);
        return agg;
    }
    receive(actor, quantity, opts) {
        var _a;
        if (quantity <= 0)
            throw (0, types_1.kernelError)("INVALID_QUANTITY", "Receive quantity must be positive");
        this.raise("inventory.received", { delta: quantity, note: (_a = opts === null || opts === void 0 ? void 0 : opts.note) !== null && _a !== void 0 ? _a : null }, actor);
    }
    consume(actor, quantity, orderId) {
        if (quantity <= 0)
            throw (0, types_1.kernelError)("INVALID_QUANTITY", "Consume quantity must be positive");
        if (this.state.onHand < quantity)
            throw (0, types_1.kernelError)("INSUFFICIENT_STOCK", `onHand=${this.state.onHand} need=${quantity}`);
        this.raise("inventory.consumed", { delta: quantity, orderId: orderId !== null && orderId !== void 0 ? orderId : null }, actor);
    }
    recordWastage(actor, quantity, reason) {
        if (quantity <= 0 || this.state.onHand < quantity)
            throw (0, types_1.kernelError)("INVALID_QUANTITY", "Wastage exceeds on-hand");
        this.raise("inventory.wasted", { delta: quantity, reason }, actor);
    }
    adjust(actor, counted, reason) {
        const delta = counted - this.state.onHand;
        this.raise("inventory.adjusted", { delta, reason, target: counted }, actor);
    }
    available() {
        return this.state.onHand - this.state.reserved;
    }
    applyEvent(event) {
        const s = this.state;
        switch (event.eventType) {
            case "inventory.itemDefined":
                return Object.assign(Object.assign({}, s), event.payload);
            case "inventory.received":
                return Object.assign(Object.assign({}, s), { onHand: s.onHand + Number(event.payload.delta) });
            case "inventory.consumed":
                return Object.assign(Object.assign({}, s), { onHand: s.onHand - Number(event.payload.delta) });
            case "inventory.wasted":
                return Object.assign(Object.assign({}, s), { onHand: s.onHand - Number(event.payload.delta), wastageTotal: s.wastageTotal + Number(event.payload.delta) });
            case "inventory.adjusted":
                return Object.assign(Object.assign({}, s), { onHand: Number(event.payload.target) });
            default:
                return s;
        }
    }
}
exports.InventoryItemAggregate = InventoryItemAggregate;
InventoryItemAggregate.TYPE = "InventoryItem";
