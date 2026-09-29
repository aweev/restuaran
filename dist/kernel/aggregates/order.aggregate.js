"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderAggregate = void 0;
const types_1 = require("@/kernel/types");
const aggregate_1 = require("./aggregate");
const emptyState = {
    tableId: null,
    customerId: null,
    dinerName: null,
    serverId: null,
    channel: "pos",
    status: "draft",
    lines: [],
    discountTotal: 0,
    taxTotal: 0,
    payments: [],
};
class OrderAggregate extends aggregate_1.Aggregate {
    constructor(tenant) {
        super(OrderAggregate.TYPE, tenant, Object.assign(Object.assign({}, emptyState), { lines: [], payments: [] }));
    }
    static create(tenant, opts) {
        var _a, _b, _c, _d, _e;
        const agg = new OrderAggregate(tenant);
        agg.initialize(opts.id);
        agg.raise("order.created", {
            channel: (_a = opts.channel) !== null && _a !== void 0 ? _a : "pos",
            tableId: (_b = opts.tableId) !== null && _b !== void 0 ? _b : null,
            serverId: (_c = opts.serverId) !== null && _c !== void 0 ? _c : null,
            customerId: (_d = opts.customerId) !== null && _d !== void 0 ? _d : null,
            dinerName: (_e = opts.dinerName) !== null && _e !== void 0 ? _e : null,
        }, opts.actor);
        return agg;
    }
    /**
     * Every order event carries routing context (server/table/customer) so the
     * socket bridge and projections never need to load the aggregate to fan out.
     */
    raise(eventType, payload, actor) {
        const stamped = Object.assign({ tableId: this.state.tableId, serverId: this.state.serverId, customerId: this.state.customerId, dinerName: this.state.dinerName, status: this.state.status, channel: this.state.channel }, payload);
        super.raise(eventType, stamped, actor);
    }
    addLine(actor, line) {
        if (this.state.status !== "open" && this.state.status !== "draft") {
            throw (0, types_1.kernelError)("ORDER_NOT_EDITABLE", `Order is ${this.state.status}`);
        }
        if (!Number.isFinite(line.unitPrice) || line.unitPrice < 0) {
            throw (0, types_1.kernelError)("INVALID_LINE_PRICE", "Unit price must be a non-negative number");
        }
        if (!Number.isInteger(line.quantity) || line.quantity <= 0) {
            throw (0, types_1.kernelError)("INVALID_LINE_QUANTITY", "Quantity must be a positive integer");
        }
        this.raise("order.lineAdded", { line: Object.assign(Object.assign({}, line), { lineId: crypto.randomUUID(), status: "open" }) }, actor);
    }
    sendToKitchen(actor, lineIds) {
        const open = this.state.lines.filter((l) => l.status === "open");
        const ids = lineIds !== null && lineIds !== void 0 ? lineIds : open.map((l) => l.lineId);
        if (ids.length === 0)
            throw (0, types_1.kernelError)("NOTHING_TO_SEND", "No open lines to send");
        const sent = this.state.lines.filter((l) => ids.includes(l.lineId));
        if (sent.length !== ids.length)
            throw (0, types_1.kernelError)("UNKNOWN_LINE", "lineIds reference lines not on this order");
        // Payload embeds full line details so kitchen tickets are self-contained.
        this.raise("order.sentToKitchen", { lineIds: ids, lines: sent.map((l) => {
                var _a;
                return ({
                    lineId: l.lineId,
                    name: l.name,
                    quantity: l.quantity,
                    modifiers: ((_a = l.modifiers) !== null && _a !== void 0 ? _a : []).map((m) => m.name),
                    course: l.course,
                });
            }) }, actor);
    }
    markLinePreparing(actor, lineId) {
        this.assertLineStatus(lineId, "sent", "preparing");
        this.raise("kitchen.lineBegan", { lineId }, actor);
    }
    markLineReady(actor, lineId) {
        this.assertLineStatus(lineId, "preparing", "ready");
        this.raise("kitchen.lineReady", { lineId }, actor);
    }
    serveLine(actor, lineId) {
        this.assertLineStatus(lineId, "ready", "served");
        this.raise("kitchen.lineServed", { lineId }, actor);
    }
    voidLine(actor, lineId, reason) {
        if (this.state.status === "closed")
            throw (0, types_1.kernelError)("ORDER_CLOSED", "Order is closed");
        const line = this.state.lines.find((l) => l.lineId === lineId);
        if (!line)
            throw (0, types_1.kernelError)("UNKNOWN_LINE", `No line ${lineId} on this order`);
        if (line.status === "served" || line.status === "voided") {
            throw (0, types_1.kernelError)("BAD_LINE_STATE", `Line is ${line.status}; cannot void`);
        }
        this.raise("order.lineVoided", { lineId, reason }, actor);
    }
    assertLineStatus(lineId, from, to) {
        const line = this.state.lines.find((l) => l.lineId === lineId);
        if (!line)
            throw (0, types_1.kernelError)("UNKNOWN_LINE", `No line ${lineId} on this order`);
        if (line.status !== from) {
            throw (0, types_1.kernelError)("BAD_LINE_STATE", `Line is ${line.status}; cannot move ${from} -> ${to}`);
        }
    }
    recordPayment(actor, payment) {
        if (payment.amount <= 0)
            throw (0, types_1.kernelError)("INVALID_PAYMENT", "Payment amount must be positive");
        this.raise("order.paymentRecorded", { payment: Object.assign(Object.assign({}, payment), { paymentId: crypto.randomUUID() }) }, actor);
    }
    close(actor) {
        const total = this.orderTotal();
        const paid = this.state.payments.reduce((s, p) => s + p.amount, 0);
        if (paid + 0.001 < total) {
            throw (0, types_1.kernelError)("ORDER_UNPAID", `Cannot close: paid ${paid} of ${total}`);
        }
        // Totals ride on the event so downstream consumers (accounting connector,
        // webhooks) never need to load the aggregate.
        this.raise("order.closed", { total, paid }, actor);
    }
    void(actor, reason) {
        if (this.state.status === "closed")
            throw (0, types_1.kernelError)("ORDER_ALREADY_CLOSED", "Cannot void a closed order");
        this.raise("order.voided", { reason }, actor);
    }
    orderTotal() {
        const sub = this.state.lines
            .filter((l) => l.status !== "voided")
            .reduce((s, l) => { var _a, _b; return s + l.unitPrice * l.quantity + ((_b = (_a = l.modifiers) === null || _a === void 0 ? void 0 : _a.reduce((m, o) => m + o.price, 0)) !== null && _b !== void 0 ? _b : 0) * l.quantity; }, 0);
        return Math.max(0, sub - this.state.discountTotal + this.state.taxTotal);
    }
    applyEvent(event) {
        var _a, _b;
        const s = this.state;
        const setLine = (id, status) => (Object.assign(Object.assign({}, s), { lines: s.lines.map((l) => (l.lineId === id ? Object.assign(Object.assign({}, l), { status }) : l)) }));
        switch (event.eventType) {
            case "order.created":
                return Object.assign(Object.assign({}, s), event.payload);
            case "order.lineAdded":
                return Object.assign(Object.assign({}, s), { status: s.status === "draft" ? "open" : s.status, lines: [...s.lines, event.payload.line] });
            case "order.lineVoided":
                return setLine(event.payload.lineId, "voided");
            case "order.sentToKitchen": {
                const ids = new Set(event.payload.lineIds);
                return Object.assign(Object.assign({}, s), { lines: s.lines.map((l) => (ids.has(l.lineId) ? Object.assign(Object.assign({}, l), { status: "sent" }) : l)) });
            }
            case "kitchen.lineBegan":
                return setLine(event.payload.lineId, "preparing");
            case "kitchen.lineReady":
                return setLine(event.payload.lineId, "ready");
            case "kitchen.lineServed":
                return setLine(event.payload.lineId, "served");
            case "order.discountApplied":
                return Object.assign(Object.assign({}, s), { discountTotal: Number((_a = event.payload.discountTotal) !== null && _a !== void 0 ? _a : s.discountTotal) });
            case "order.taxApplied":
                return Object.assign(Object.assign({}, s), { taxTotal: Number((_b = event.payload.taxTotal) !== null && _b !== void 0 ? _b : s.taxTotal) });
            case "order.paymentRecorded":
                return Object.assign(Object.assign({}, s), { payments: [...s.payments, event.payload.payment] });
            case "order.closed":
                return Object.assign(Object.assign({}, s), { status: "closed" });
            case "order.voided":
                return Object.assign(Object.assign({}, s), { status: "voided" });
            default:
                return s;
        }
    }
}
exports.OrderAggregate = OrderAggregate;
OrderAggregate.TYPE = "Order";
