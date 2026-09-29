"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReservationAggregate = void 0;
const types_1 = require("@/kernel/types");
const aggregate_1 = require("./aggregate");
const TERMINAL = ["completed", "cancelled", "no_show"];
class ReservationAggregate extends aggregate_1.Aggregate {
    constructor(tenant) {
        super(ReservationAggregate.TYPE, tenant, {
            customerName: "",
            phone: null,
            email: null,
            partySize: 1,
            date: "",
            time: "",
            durationMinutes: 90,
            status: "pending",
            tableId: null,
            source: "pos",
            specialRequests: null,
            cancelledReason: null,
            history: [],
        });
    }
    static book(tenant, opts) {
        var _a, _b, _c, _d, _e, _f;
        const agg = new ReservationAggregate(tenant);
        agg.initialize(opts.id);
        if (!((_a = opts.customerName) === null || _a === void 0 ? void 0 : _a.trim()))
            throw (0, types_1.kernelError)("INVALID_RESERVATION", "Customer name is required");
        if (!Number.isInteger(opts.partySize) || opts.partySize <= 0) {
            throw (0, types_1.kernelError)("INVALID_RESERVATION", "Party size must be a positive integer");
        }
        if (!/^\d{4}-\d{2}-\d{2}$/.test(opts.date))
            throw (0, types_1.kernelError)("INVALID_RESERVATION", "Date must be YYYY-MM-DD");
        if (!/^\d{2}:\d{2}$/.test(opts.time))
            throw (0, types_1.kernelError)("INVALID_RESERVATION", "Time must be HH:MM");
        agg.raise("reservation.booked", {
            status: "pending",
            customerName: opts.customerName,
            partySize: opts.partySize,
            date: opts.date,
            time: opts.time,
            phone: (_b = opts.phone) !== null && _b !== void 0 ? _b : null,
            email: (_c = opts.email) !== null && _c !== void 0 ? _c : null,
            durationMinutes: (_d = opts.durationMinutes) !== null && _d !== void 0 ? _d : 90,
            source: (_e = opts.source) !== null && _e !== void 0 ? _e : "pos",
            specialRequests: (_f = opts.specialRequests) !== null && _f !== void 0 ? _f : null,
        }, opts.actor);
        return agg;
    }
    confirm(actor, tableId) {
        this.assertTransition("confirmed");
        if (tableId)
            this.raise("reservation.confirmed", { status: "confirmed", tableId }, actor);
        else
            this.raise("reservation.confirmed", { status: "confirmed" }, actor);
    }
    seat(actor, tableId) {
        if (this.state.status !== "confirmed" && this.state.status !== "pending") {
            throw (0, types_1.kernelError)("BAD_RESERVATION_STATE", `Cannot seat a ${this.state.status} reservation`);
        }
        if (!tableId)
            throw (0, types_1.kernelError)("TABLE_REQUIRED", "Seating requires a table");
        this.raise("reservation.seated", { status: "seated", tableId }, actor);
    }
    complete(actor) {
        this.assertTransition("completed");
        this.raise("reservation.completed", { status: "completed" }, actor);
    }
    cancel(actor, reason) {
        this.assertTransition("cancelled");
        this.raise("reservation.cancelled", { status: "cancelled", cancelledReason: reason !== null && reason !== void 0 ? reason : null }, actor);
    }
    markNoShow(actor) {
        this.assertTransition("no_show");
        this.raise("reservation.noShow", { status: "no_show" }, actor);
    }
    reschedule(actor, date, time) {
        if (TERMINAL.includes(this.state.status)) {
            throw (0, types_1.kernelError)("BAD_RESERVATION_STATE", `Cannot reschedule a ${this.state.status} reservation`);
        }
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
            throw (0, types_1.kernelError)("INVALID_RESERVATION", "Date must be YYYY-MM-DD");
        if (!/^\d{2}:\d{2}$/.test(time))
            throw (0, types_1.kernelError)("INVALID_RESERVATION", "Time must be HH:MM");
        this.raise("reservation.rescheduled", { date, time, status: this.state.status === "seated" ? "confirmed" : this.state.status }, actor);
    }
    isActive() {
        return !TERMINAL.includes(this.state.status);
    }
    slot() {
        return `${this.state.date} ${this.state.time}`;
    }
    assertTransition(next) {
        if (TERMINAL.includes(this.state.status)) {
            throw (0, types_1.kernelError)("BAD_RESERVATION_STATE", `Cannot move ${this.state.status} reservation to ${next}`);
        }
    }
    applyEvent(event) {
        var _a, _b;
        const s = this.state;
        switch (event.eventType) {
            case "reservation.booked":
            case "reservation.confirmed":
            case "reservation.seated":
            case "reservation.completed":
            case "reservation.cancelled":
            case "reservation.noShow":
            case "reservation.rescheduled": {
                const next = Object.assign(Object.assign({}, s), event.payload);
                return Object.assign(Object.assign({}, next), { history: [...s.history, { status: next.status, at: event.occurredAt, by: (_b = (_a = event.actor) === null || _a === void 0 ? void 0 : _a.userId) !== null && _b !== void 0 ? _b : "system" }] });
            }
            default:
                return s;
        }
    }
}
exports.ReservationAggregate = ReservationAggregate;
ReservationAggregate.TYPE = "Reservation";
