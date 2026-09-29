"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeStaffBoard = computeStaffBoard;
exports.staffModule = staffModule;
const crypto_1 = require("crypto");
const types_1 = require("@/kernel/types");
const define_command_1 = require("@/kernel/commands/define-command");
const shift_aggregate_1 = require("@/kernel/aggregates/shift.aggregate");
function toRow(agg, workedSeconds) {
    return {
        id: agg.id,
        staffId: agg.state.staffId,
        position: agg.state.position,
        status: agg.state.status,
        clockInAt: agg.state.clockInAt,
        clockOutAt: agg.state.clockOutAt,
        workedMinutes: Math.round(workedSeconds / 60),
    };
}
/**
 * Live staffing board, recomputed from the event log. Worked-time math lives in
 * exactly one place (the aggregate) instead of a duplicated reducer, so
 * break/clock edge cases can never drift between write and read models.
 */
async function computeStaffBoard(store, tenant) {
    var _a;
    const events = await store.query({
        tenant,
        eventTypes: ["shift.scheduled", "shift.clockedIn", "shift.breakStarted", "shift.breakEnded", "shift.clockedOut"],
    });
    const byId = new Map();
    for (const e of events) {
        const list = (_a = byId.get(e.aggregateId)) !== null && _a !== void 0 ? _a : [];
        list.push(e);
        byId.set(e.aggregateId, list);
    }
    const onShift = [];
    const history = [];
    for (const [id, list] of byId) {
        const agg = new shift_aggregate_1.StaffShiftAggregate(tenant);
        agg.initialize(id);
        for (const e of list) {
            ;
            agg.replay(e);
        }
        const row = toRow(agg, agg.workedSeconds());
        if (row.status === "clocked_in" || row.status === "on_break")
            onShift.push(row);
        else if (row.status === "clocked_out")
            history.push(row);
    }
    return { onShift, history };
}
const schedule = (0, define_command_1.defineCommand)({
    commandType: "staff.scheduleShift",
    requiredPermission: "staff:schedule",
    async execute(ctx) {
        var _a, _b, _c, _d, _e;
        const id = (_a = ctx.payload.shiftId) !== null && _a !== void 0 ? _a : (0, crypto_1.randomUUID)();
        const agg = shift_aggregate_1.StaffShiftAggregate.schedule(ctx.tenant, {
            id,
            actor: ctx.actor,
            staffId: String((_b = ctx.payload.staffId) !== null && _b !== void 0 ? _b : ""),
            position: String((_c = ctx.payload.position) !== null && _c !== void 0 ? _c : ""),
            scheduledStart: String((_d = ctx.payload.scheduledStart) !== null && _d !== void 0 ? _d : ""),
            scheduledEnd: String((_e = ctx.payload.scheduledEnd) !== null && _e !== void 0 ? _e : ""),
            locationLabel: ctx.payload.locationLabel ? String(ctx.payload.locationLabel) : undefined,
        });
        await ctx.commit(agg);
        return id;
    },
});
/**
 * Clock operations must be bound to the authenticated identity, never to a
 * client-supplied staffId field (which is self-asserted and trivially spoofed).
 * Acting on another employee's shift requires staff:schedule.
 */
function assertOwnShift(ctx, agg) {
    if (agg.state.staffId === ctx.actor.userId)
        return;
    if (!ctx.actor.permissions.includes("staff:schedule")) {
        throw (0, types_1.kernelError)("SHIFT_OWNERSHIP", "Cannot modify another staff member's shift");
    }
}
const clockIn = (0, define_command_1.defineCommand)({
    commandType: "staff.clockIn",
    requiredPermission: "staff:clock",
    async execute(ctx) {
        const id = String(ctx.payload.shiftId);
        const agg = await ctx.load(shift_aggregate_1.StaffShiftAggregate.TYPE, id);
        assertOwnShift(ctx, agg);
        agg.clockIn(ctx.actor);
        await ctx.commit(agg);
        return id;
    },
});
const clockOut = (0, define_command_1.defineCommand)({
    commandType: "staff.clockOut",
    requiredPermission: "staff:clock",
    async execute(ctx) {
        const id = String(ctx.payload.shiftId);
        const agg = await ctx.load(shift_aggregate_1.StaffShiftAggregate.TYPE, id);
        assertOwnShift(ctx, agg);
        agg.clockOut(ctx.actor);
        await ctx.commit(agg);
        return id;
    },
});
const breakStart = (0, define_command_1.defineCommand)({
    commandType: "staff.startBreak",
    requiredPermission: "staff:clock",
    async execute(ctx) {
        const id = String(ctx.payload.shiftId);
        const agg = await ctx.load(shift_aggregate_1.StaffShiftAggregate.TYPE, id);
        assertOwnShift(ctx, agg);
        agg.startBreak(ctx.actor);
        await ctx.commit(agg);
        return id;
    },
});
const breakEnd = (0, define_command_1.defineCommand)({
    commandType: "staff.endBreak",
    requiredPermission: "staff:clock",
    async execute(ctx) {
        const id = String(ctx.payload.shiftId);
        const agg = await ctx.load(shift_aggregate_1.StaffShiftAggregate.TYPE, id);
        assertOwnShift(ctx, agg);
        agg.endBreak(ctx.actor);
        await ctx.commit(agg);
        return id;
    },
});
const getShift = {
    queryType: "get.shift",
    requiredPermission: "staff:view",
    async handle(params, ctx) {
        var _a;
        const agg = await ctx.repository.load(shift_aggregate_1.StaffShiftAggregate.TYPE, ctx.tenant, String(params.shiftId));
        return { id: agg.id, version: agg.version, state: agg.state, workedSeconds: agg.workedSeconds(), overtime: agg.isOvertime(Number((_a = params.maxHoursPerShift) !== null && _a !== void 0 ? _a : 10)) };
    },
};
const listStaffing = {
    queryType: "list.staffing.board",
    requiredPermission: "staff:view",
    async handle(_params, ctx) {
        return computeStaffBoard(ctx.events, ctx.tenant);
    },
};
function staffModule() {
    return {
        id: "ros.staff",
        name: "Staff Scheduling & Time Clock",
        version: "1.0.0",
        capabilities: {
            commands: ["staff.scheduleShift", "staff.clockIn", "staff.clockOut", "staff.startBreak", "staff.endBreak"],
            queries: ["get.shift", "list.staffing.board"],
            eventTypes: ["shift.scheduled", "shift.clockedIn", "shift.clockedOut", "shift.breakStarted", "shift.breakEnded"],
        },
        lifecycle: {
            async activate(runtime) {
                runtime.commands.register(schedule);
                runtime.commands.register(clockIn);
                runtime.commands.register(clockOut);
                runtime.commands.register(breakStart);
                runtime.commands.register(breakEnd);
                runtime.queries.register(getShift);
                runtime.queries.register(listStaffing);
            },
        },
    };
}
