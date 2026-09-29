"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StaffShiftAggregate = void 0;
const types_1 = require("@/kernel/types");
const aggregate_1 = require("./aggregate");
class StaffShiftAggregate extends aggregate_1.Aggregate {
    constructor(tenant) {
        super(StaffShiftAggregate.TYPE, tenant, {
            staffId: "",
            position: "",
            locationLabel: "",
            scheduledStart: null,
            scheduledEnd: null,
            status: "scheduled",
            clockInAt: null,
            clockOutAt: null,
            breaks: [],
            notes: null,
        });
    }
    static schedule(tenant, opts) {
        var _a;
        const agg = new StaffShiftAggregate(tenant);
        agg.initialize(opts.id);
        if (!opts.staffId)
            throw (0, types_1.kernelError)("INVALID_SHIFT", "staffId is required");
        const start = Date.parse(opts.scheduledStart);
        const end = Date.parse(opts.scheduledEnd);
        if (Number.isNaN(start) || Number.isNaN(end) || end <= start) {
            throw (0, types_1.kernelError)("INVALID_SHIFT", "Scheduled end must be after start");
        }
        agg.raise("shift.scheduled", {
            staffId: opts.staffId,
            position: opts.position,
            scheduledStart: opts.scheduledStart,
            scheduledEnd: opts.scheduledEnd,
            locationLabel: (_a = opts.locationLabel) !== null && _a !== void 0 ? _a : "",
        }, opts.actor);
        return agg;
    }
    clockIn(actor, at) {
        if (this.state.status !== "scheduled") {
            throw (0, types_1.kernelError)("BAD_SHIFT_STATE", `Cannot clock in from ${this.state.status}`);
        }
        this.raise("shift.clockedIn", { status: "clocked_in", clockInAt: at !== null && at !== void 0 ? at : new Date().toISOString() }, actor);
    }
    startBreak(actor) {
        if (this.state.status !== "clocked_in")
            throw (0, types_1.kernelError)("BAD_SHIFT_STATE", "Breaks are only allowed while clocked in");
        this.raise("shift.breakStarted", { status: "on_break" }, actor);
    }
    endBreak(actor) {
        if (this.state.status !== "on_break")
            throw (0, types_1.kernelError)("BAD_SHIFT_STATE", "No break in progress");
        this.raise("shift.breakEnded", { status: "clocked_in" }, actor);
    }
    clockOut(actor, at) {
        if (this.state.status !== "clocked_in" && this.state.status !== "on_break") {
            throw (0, types_1.kernelError)("BAD_SHIFT_STATE", `Cannot clock out from ${this.state.status}`);
        }
        this.raise("shift.clockedOut", { status: "clocked_out", clockOutAt: at !== null && at !== void 0 ? at : new Date().toISOString() }, actor);
    }
    workedSeconds() {
        const { clockInAt, clockOutAt, breaks } = this.state;
        if (!clockInAt)
            return 0;
        const end = clockOutAt ? Date.parse(clockOutAt) : Date.now();
        let total = end - Date.parse(clockInAt);
        for (const b of breaks) {
            if (b.endAt)
                total -= Date.parse(b.endAt) - Date.parse(b.startAt);
            else
                total -= end - Date.parse(b.startAt);
        }
        return Math.max(0, Math.floor(total / 1000));
    }
    isOvertime(maxHoursPerShift = 10) {
        return this.workedSeconds() / 3600 > maxHoursPerShift;
    }
    applyEvent(event) {
        const s = this.state;
        switch (event.eventType) {
            case "shift.scheduled":
            case "shift.clockedIn":
            case "shift.clockedOut":
                return Object.assign(Object.assign({}, s), event.payload);
            case "shift.breakStarted": {
                const open = s.breaks.find((b) => b.endAt === null);
                if (open)
                    return s;
                return Object.assign(Object.assign({}, s), { status: "on_break", breaks: [...s.breaks, { startAt: event.occurredAt, endAt: null }] });
            }
            case "shift.breakEnded": {
                const breaks = s.breaks.map((b, i) => i === s.breaks.length - 1 && b.endAt === null ? Object.assign(Object.assign({}, b), { endAt: event.occurredAt }) : b);
                return Object.assign(Object.assign({}, s), { status: "clocked_in", breaks });
            }
            default:
                return s;
        }
    }
}
exports.StaffShiftAggregate = StaffShiftAggregate;
StaffShiftAggregate.TYPE = "StaffShift";
