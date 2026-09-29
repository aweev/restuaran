"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.waitlistBoardProjection = waitlistBoardProjection;
exports.waitlistModule = waitlistModule;
const crypto_1 = require("crypto");
const types_1 = require("@/kernel/types");
const define_command_1 = require("@/kernel/commands/define-command");
const waitlist_aggregate_1 = require("@/kernel/aggregates/waitlist.aggregate");
const projection_1 = require("@/kernel/projections/projection");
function waitlistBoardProjection(store, tenant) {
    return (0, projection_1.defineProjection)({
        name: "waitlist.board",
        initial: { queue: [] },
        watchedEventTypes: ["waitlist.joined", "waitlist.notified", "waitlist.seated", "waitlist.removed", "waitlist.noShow"],
        reduce: (state, event) => {
            var _a, _b, _c, _d, _e;
            let queue = [...state.queue];
            const idx = queue.findIndex((r) => r.id === event.aggregateId);
            const p = event.payload;
            switch (event.eventType) {
                case "waitlist.joined": {
                    const position = queue.filter((r) => r.status === "waiting" || r.status === "notified").length + 1;
                    queue.push({
                        id: event.aggregateId,
                        customerName: String((_a = p.customerName) !== null && _a !== void 0 ? _a : ""),
                        phone: (_b = p.phone) !== null && _b !== void 0 ? _b : null,
                        partySize: Number((_c = p.partySize) !== null && _c !== void 0 ? _c : 1),
                        status: "waiting",
                        position,
                        joinedAt: String((_d = p.joinedAt) !== null && _d !== void 0 ? _d : event.occurredAt),
                        notifiedAt: null,
                    });
                    break;
                }
                case "waitlist.notified":
                    if (idx >= 0)
                        queue[idx] = Object.assign(Object.assign({}, queue[idx]), { status: "notified", notifiedAt: String((_e = p.notifiedAt) !== null && _e !== void 0 ? _e : event.occurredAt) });
                    break;
                case "waitlist.seated":
                case "waitlist.removed":
                case "waitlist.noShow":
                    queue = queue.filter((r) => r.id !== event.aggregateId);
                    break;
            }
            // re-dense positions on every change
            queue = queue.map((r, i) => (Object.assign(Object.assign({}, r), { position: i + 1 })));
            return { queue };
        },
    }, store, tenant);
}
const join = (0, define_command_1.defineCommand)({
    commandType: "waitlist.join",
    requiredPermission: "waitlist:manage",
    async execute(ctx) {
        var _a, _b, _c;
        const id = (_a = ctx.payload.entryId) !== null && _a !== void 0 ? _a : (0, crypto_1.randomUUID)();
        const queue = ctx.projections.get("waitlist.board").state.queue;
        const agg = waitlist_aggregate_1.WaitlistAggregate.join(ctx.tenant, {
            id,
            actor: ctx.actor,
            customerName: String((_b = ctx.payload.customerName) !== null && _b !== void 0 ? _b : ""),
            partySize: Number((_c = ctx.payload.partySize) !== null && _c !== void 0 ? _c : 1),
            phone: ctx.payload.phone ? String(ctx.payload.phone) : undefined,
            notes: ctx.payload.notes ? String(ctx.payload.notes) : undefined,
            position: queue.filter((r) => r.status === "waiting" || r.status === "notified").length + 1,
        });
        await ctx.commit(agg);
        return id;
    },
});
const notify = (0, define_command_1.defineCommand)({
    commandType: "waitlist.notify",
    requiredPermission: "waitlist:manage",
    async execute(ctx) {
        const id = String(ctx.payload.entryId);
        const agg = await ctx.load(waitlist_aggregate_1.WaitlistAggregate.TYPE, id);
        agg.notify(ctx.actor);
        await ctx.commit(agg);
        return id;
    },
});
const seat = (0, define_command_1.defineCommand)({
    commandType: "waitlist.seat",
    requiredPermission: "waitlist:manage",
    async execute(ctx) {
        const id = String(ctx.payload.entryId);
        const tableId = String(ctx.payload.tableId);
        // Cross-module guard: only seat onto a table the floor plan reports as available.
        const board = ctx.projections.get("tables.board");
        if (board.state.rows.length > 0) {
            const row = board.state.rows.find((r) => r.tableId === tableId);
            if (row && row.status !== "available") {
                throw (0, types_1.kernelError)("TABLE_NOT_AVAILABLE", `Table is ${row.status}`);
            }
        }
        const agg = await ctx.load(waitlist_aggregate_1.WaitlistAggregate.TYPE, id);
        agg.seat(ctx.actor, tableId);
        await ctx.commit(agg);
        return id;
    },
});
const remove = (0, define_command_1.defineCommand)({
    commandType: "waitlist.remove",
    requiredPermission: "waitlist:manage",
    async execute(ctx) {
        const id = String(ctx.payload.entryId);
        const agg = await ctx.load(waitlist_aggregate_1.WaitlistAggregate.TYPE, id);
        agg.remove(ctx.actor, ctx.payload.reason ? String(ctx.payload.reason) : undefined);
        await ctx.commit(agg);
        return id;
    },
});
const getEntry = {
    queryType: "get.waitlistEntry",
    requiredPermission: "waitlist:view",
    async handle(params, ctx) {
        const agg = await ctx.repository.load(waitlist_aggregate_1.WaitlistAggregate.TYPE, ctx.tenant, String(params.entryId));
        return { id: agg.id, version: agg.version, state: agg.state };
    },
};
const listQueue = {
    queryType: "list.waitQueue",
    requiredPermission: "waitlist:view",
    async handle(_params, ctx) {
        return ctx.projections.get("waitlist.board").state.queue;
    },
};
function waitlistModule() {
    return {
        id: "ros.waitlist",
        name: "Waitlist",
        version: "1.0.0",
        capabilities: {
            commands: ["waitlist.join", "waitlist.notify", "waitlist.seat", "waitlist.remove"],
            queries: ["get.waitlistEntry", "list.waitQueue"],
            eventTypes: ["waitlist.joined", "waitlist.notified", "waitlist.seated", "waitlist.removed", "waitlist.noShow"],
        },
        lifecycle: {
            async install(runtime) {
                runtime.projections.register(waitlistBoardProjection(runtime.events, runtime.tenant));
            },
            async activate(runtime) {
                runtime.commands.register(join);
                runtime.commands.register(notify);
                runtime.commands.register(seat);
                runtime.commands.register(remove);
                runtime.queries.register(getEntry);
                runtime.queries.register(listQueue);
            },
        },
    };
}
