"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WaitlistAggregate = void 0;
const types_1 = require("@/kernel/types");
const aggregate_1 = require("./aggregate");
class WaitlistAggregate extends aggregate_1.Aggregate {
    constructor(tenant) {
        super(WaitlistAggregate.TYPE, tenant, {
            customerName: "",
            phone: null,
            partySize: 1,
            status: "waiting",
            position: 0,
            joinedAt: "",
            notifiedAt: null,
            seatedAt: null,
            tableId: null,
            notes: null,
        });
    }
    static join(tenant, opts) {
        var _a, _b, _c;
        const agg = new WaitlistAggregate(tenant);
        agg.initialize(opts.id);
        if (!((_a = opts.customerName) === null || _a === void 0 ? void 0 : _a.trim()))
            throw (0, types_1.kernelError)("INVALID_WAITLIST", "Customer name is required");
        if (!Number.isInteger(opts.partySize) || opts.partySize <= 0) {
            throw (0, types_1.kernelError)("INVALID_WAITLIST", "Party size must be a positive integer");
        }
        agg.raise("waitlist.joined", {
            customerName: opts.customerName,
            partySize: opts.partySize,
            phone: (_b = opts.phone) !== null && _b !== void 0 ? _b : null,
            notes: (_c = opts.notes) !== null && _c !== void 0 ? _c : null,
            position: opts.position,
            joinedAt: new Date().toISOString(),
        }, opts.actor);
        return agg;
    }
    notify(actor) {
        if (this.state.status !== "waiting") {
            throw (0, types_1.kernelError)("BAD_WAITLIST_STATE", `Cannot notify a ${this.state.status} entry`);
        }
        this.raise("waitlist.notified", { status: "notified", notifiedAt: new Date().toISOString() }, actor);
    }
    seat(actor, tableId) {
        if (this.state.status !== "waiting" && this.state.status !== "notified") {
            throw (0, types_1.kernelError)("BAD_WAITLIST_STATE", `Cannot seat a ${this.state.status} entry`);
        }
        if (!tableId)
            throw (0, types_1.kernelError)("TABLE_REQUIRED", "Seating requires a table");
        this.raise("waitlist.seated", { status: "seated", tableId, seatedAt: new Date().toISOString() }, actor);
    }
    remove(actor, reason) {
        if (this.state.status === "seated")
            throw (0, types_1.kernelError)("BAD_WAITLIST_STATE", "Cannot remove a seated party");
        this.raise("waitlist.removed", { status: "removed", notes: reason !== null && reason !== void 0 ? reason : this.state.notes }, actor);
    }
    markNoShow(actor) {
        if (this.state.status !== "notified")
            throw (0, types_1.kernelError)("BAD_WAITLIST_STATE", "Only notified entries can be marked no-show");
        this.raise("waitlist.noShow", { status: "no_show" }, actor);
    }
    isWaiting() {
        return this.state.status === "waiting" || this.state.status === "notified";
    }
    applyEvent(event) {
        switch (event.eventType) {
            case "waitlist.joined":
            case "waitlist.notified":
            case "waitlist.seated":
            case "waitlist.removed":
            case "waitlist.noShow":
                return Object.assign(Object.assign({}, this.state), event.payload);
            default:
                return this.state;
        }
    }
}
exports.WaitlistAggregate = WaitlistAggregate;
WaitlistAggregate.TYPE = "WaitlistEntry";
