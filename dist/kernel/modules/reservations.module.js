"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reservationBoardProjection = reservationBoardProjection;
exports.reservationsModule = reservationsModule;
const crypto_1 = require("crypto");
const types_1 = require("@/kernel/types");
const define_command_1 = require("@/kernel/commands/define-command");
const reservation_aggregate_1 = require("@/kernel/aggregates/reservation.aggregate");
const projection_1 = require("@/kernel/projections/projection");
function reservationBoardProjection(store, tenant) {
    return (0, projection_1.defineProjection)({
        name: "reservations.board",
        initial: { rows: [] },
        watchedEventTypes: [
            "reservation.booked",
            "reservation.confirmed",
            "reservation.seated",
            "reservation.completed",
            "reservation.cancelled",
            "reservation.noShow",
            "reservation.rescheduled",
        ],
        reduce: (state, event) => {
            var _a, _b, _c, _d, _e, _f;
            const rows = [...state.rows];
            const idx = rows.findIndex((r) => r.id === event.aggregateId);
            const p = event.payload;
            const base = idx >= 0
                ? rows[idx]
                : { id: event.aggregateId, customerName: "", partySize: 0, date: "", time: "", status: "pending", tableId: null, source: "pos" };
            const next = Object.assign({}, base);
            if (event.eventType === "reservation.booked") {
                next.customerName = String((_a = p.customerName) !== null && _a !== void 0 ? _a : "");
                next.partySize = Number((_b = p.partySize) !== null && _b !== void 0 ? _b : 0);
                next.date = String((_c = p.date) !== null && _c !== void 0 ? _c : "");
                next.time = String((_d = p.time) !== null && _d !== void 0 ? _d : "");
                next.source = String((_e = p.source) !== null && _e !== void 0 ? _e : "pos");
                next.status = "pending";
            }
            if (p.status)
                next.status = String(p.status);
            if (p.tableId !== undefined)
                next.tableId = (_f = p.tableId) !== null && _f !== void 0 ? _f : null;
            if (p.date)
                next.date = String(p.date);
            if (p.time)
                next.time = String(p.time);
            if (idx >= 0)
                rows[idx] = next;
            else
                rows.push(next);
            rows.sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
            return { rows };
        },
    }, store, tenant);
}
// ---------------------------------------------------------------- commands
const book = (0, define_command_1.defineCommand)({
    commandType: "reservation.book",
    requiredPermission: "reservation:manage",
    async execute(ctx) {
        var _a, _b, _c, _d, _e;
        const { payload } = ctx;
        const id = (_a = payload.reservationId) !== null && _a !== void 0 ? _a : (0, crypto_1.randomUUID)();
        // Guard: same table double-booked in an overlapping window?
        const board = ctx.projections.get("reservations.board").state;
        const tableId = payload.tableId;
        if (tableId) {
            const conflict = board.rows.find((r) => {
                var _a;
                return r.id !== id &&
                    r.tableId === tableId &&
                    r.date === payload.date &&
                    ["pending", "confirmed", "seated"].includes(r.status) &&
                    overlaps(String(payload.time), Number((_a = payload.durationMinutes) !== null && _a !== void 0 ? _a : 90), r.time, 90);
            });
            if (conflict) {
                throw (0, types_1.kernelError)("TABLE_DOUBLE_BOOKED", `Table already reserved at ${conflict.time} by ${conflict.customerName}`);
            }
        }
        const agg = reservation_aggregate_1.ReservationAggregate.book(ctx.tenant, {
            id,
            actor: ctx.actor,
            customerName: String((_b = payload.customerName) !== null && _b !== void 0 ? _b : ""),
            partySize: Number((_c = payload.partySize) !== null && _c !== void 0 ? _c : 1),
            date: String((_d = payload.date) !== null && _d !== void 0 ? _d : ""),
            time: String((_e = payload.time) !== null && _e !== void 0 ? _e : ""),
            phone: payload.phone ? String(payload.phone) : undefined,
            email: payload.email ? String(payload.email) : undefined,
            durationMinutes: payload.durationMinutes ? Number(payload.durationMinutes) : undefined,
            source: payload.source,
            specialRequests: payload.specialRequests ? String(payload.specialRequests) : undefined,
        });
        if (tableId)
            agg.confirm(ctx.actor, tableId); // booking with an assigned table is auto-confirmed
        await ctx.commit(agg);
        return id;
    },
});
const confirm = (0, define_command_1.defineCommand)({
    commandType: "reservation.confirm",
    requiredPermission: "reservation:manage",
    async execute(ctx) {
        const id = String(ctx.payload.reservationId);
        const agg = await ctx.load(reservation_aggregate_1.ReservationAggregate.TYPE, id);
        agg.confirm(ctx.actor, ctx.payload.tableId ? String(ctx.payload.tableId) : undefined);
        await ctx.commit(agg);
        return id;
    },
});
const seat = (0, define_command_1.defineCommand)({
    commandType: "reservation.seat",
    requiredPermission: "reservation:manage",
    async execute(ctx) {
        const id = String(ctx.payload.reservationId);
        const agg = await ctx.load(reservation_aggregate_1.ReservationAggregate.TYPE, id);
        agg.seat(ctx.actor, String(ctx.payload.tableId));
        await ctx.commit(agg);
        return id;
    },
});
const complete = (0, define_command_1.defineCommand)({
    commandType: "reservation.complete",
    requiredPermission: "reservation:manage",
    async execute(ctx) {
        const id = String(ctx.payload.reservationId);
        const agg = await ctx.load(reservation_aggregate_1.ReservationAggregate.TYPE, id);
        agg.complete(ctx.actor);
        await ctx.commit(agg);
        return id;
    },
});
const cancel = (0, define_command_1.defineCommand)({
    commandType: "reservation.cancel",
    requiredPermission: "reservation:manage",
    async execute(ctx) {
        const id = String(ctx.payload.reservationId);
        const agg = await ctx.load(reservation_aggregate_1.ReservationAggregate.TYPE, id);
        agg.cancel(ctx.actor, ctx.payload.reason ? String(ctx.payload.reason) : undefined);
        await ctx.commit(agg);
        return id;
    },
});
const noShow = (0, define_command_1.defineCommand)({
    commandType: "reservation.markNoShow",
    requiredPermission: "reservation:manage",
    async execute(ctx) {
        const id = String(ctx.payload.reservationId);
        const agg = await ctx.load(reservation_aggregate_1.ReservationAggregate.TYPE, id);
        agg.markNoShow(ctx.actor);
        await ctx.commit(agg);
        return id;
    },
});
const reschedule = (0, define_command_1.defineCommand)({
    commandType: "reservation.reschedule",
    requiredPermission: "reservation:manage",
    async execute(ctx) {
        const id = String(ctx.payload.reservationId);
        const agg = await ctx.load(reservation_aggregate_1.ReservationAggregate.TYPE, id);
        agg.reschedule(ctx.actor, String(ctx.payload.date), String(ctx.payload.time));
        await ctx.commit(agg);
        return id;
    },
});
// ---------------------------------------------------------------- queries
function overlaps(aStart, aMins, bStart, bMins) {
    const toMin = (t) => {
        const [h, m] = t.split(":").map(Number);
        return h * 60 + m;
    };
    const as = toMin(aStart);
    const bs = toMin(bStart);
    return as < bs + bMins && bs < as + aMins;
}
const getReservation = {
    queryType: "get.reservation",
    requiredPermission: "reservation:view",
    async handle(params, ctx) {
        const agg = await ctx.repository.load(reservation_aggregate_1.ReservationAggregate.TYPE, ctx.tenant, String(params.reservationId));
        return { id: agg.id, version: agg.version, state: agg.state };
    },
};
const listReservationsForDate = {
    queryType: "list.reservations.onDate",
    requiredPermission: "reservation:view",
    async handle(params, ctx) {
        const board = ctx.projections.get("reservations.board").state;
        return board.rows.filter((r) => r.date === String(params.date));
    },
};
// ---------------------------------------------------------------- module
function reservationsModule() {
    return {
        id: "ros.reservations",
        name: "Reservations",
        version: "1.0.0",
        capabilities: {
            commands: ["reservation.book", "reservation.confirm", "reservation.seat", "reservation.complete", "reservation.cancel", "reservation.markNoShow", "reservation.reschedule"],
            queries: ["get.reservation", "list.reservations.onDate"],
            eventTypes: [
                "reservation.booked", "reservation.confirmed", "reservation.seated",
                "reservation.completed", "reservation.cancelled", "reservation.noShow", "reservation.rescheduled",
            ],
        },
        lifecycle: {
            async install(runtime) {
                runtime.projections.register(reservationBoardProjection(runtime.events, runtime.tenant));
            },
            async activate(runtime) {
                runtime.commands.register(book);
                runtime.commands.register(confirm);
                runtime.commands.register(seat);
                runtime.commands.register(complete);
                runtime.commands.register(cancel);
                runtime.commands.register(noShow);
                runtime.commands.register(reschedule);
                runtime.queries.register(getReservation);
                runtime.queries.register(listReservationsForDate);
            },
        },
    };
}
