"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TableAggregate = void 0;
const types_1 = require("@/kernel/types");
const aggregate_1 = require("./aggregate");
class TableAggregate extends aggregate_1.Aggregate {
    constructor(tenant) {
        super(TableAggregate.TYPE, tenant, {
            label: "",
            capacity: 2,
            status: "available",
            serverId: null,
            currentOrderId: null,
            seatedAt: null,
            reservationId: null,
            floor: "main",
        });
    }
    static define(tenant, opts) {
        var _a;
        const agg = new TableAggregate(tenant);
        agg.initialize(opts.id);
        agg.raise("table.created", { label: opts.label, capacity: opts.capacity, floor: (_a = opts.floor) !== null && _a !== void 0 ? _a : "main" }, opts.actor);
        return agg;
    }
    seat(actor, orderId, serverId, seatedAt) {
        if (this.state.status === "occupied")
            throw (0, types_1.kernelError)("TABLE_OCCUPIED", `Table ${this.state.label} is occupied`);
        this.raise("table.seated", { currentOrderId: orderId, serverId, seatedAt: seatedAt !== null && seatedAt !== void 0 ? seatedAt : new Date().toISOString() }, actor);
    }
    clear(actor) {
        if (this.state.status !== "occupied")
            throw (0, types_1.kernelError)("TABLE_NOT_OCCUPIED", "Nothing to clear");
        this.raise("table.cleared", { status: "dirty", currentOrderId: null, serverId: null, seatedAt: null }, actor);
    }
    markClean(actor) {
        if (this.state.status !== "dirty")
            throw (0, types_1.kernelError)("TABLE_NOT_DIRTY", "Table is not dirty");
        this.raise("table.cleaned", { status: "available" }, actor);
    }
    reserve(actor, reservationId) {
        if (this.state.status !== "available")
            throw (0, types_1.kernelError)("TABLE_NOT_AVAILABLE", `Table is ${this.state.status}`);
        this.raise("table.reserved", { reservationId, status: "reserved" }, actor);
    }
    releaseReservation(actor) {
        this.raise("table.reservationReleased", { reservationId: null, status: "available" }, actor);
    }
    applyEvent(event) {
        const s = this.state;
        switch (event.eventType) {
            case "table.created":
                return Object.assign(Object.assign({}, s), event.payload);
            case "table.seated":
                return Object.assign(Object.assign(Object.assign({}, s), { status: "occupied" }), event.payload);
            case "table.cleared":
            case "table.cleaned":
            case "table.reserved":
            case "table.reservationReleased":
                return Object.assign(Object.assign({}, s), event.payload);
            default:
                return s;
        }
    }
}
exports.TableAggregate = TableAggregate;
TableAggregate.TYPE = "Table";
