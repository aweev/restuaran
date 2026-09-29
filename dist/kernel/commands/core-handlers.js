"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.coreQueryHandlers = exports.coreCommandHandlers = void 0;
const crypto_1 = require("crypto");
const aggregates_1 = require("@/kernel/aggregates");
const str = (v) => String(v);
const num = (v) => Number(v);
async function publish(deps, committed) {
    for (const e of committed)
        await deps.hooks.emit("event:published", { event: e });
}
/**
 * Load-with-guard + mutate + save + publish. Every mutating handler funnels
 * through the AggregateRepository so snapshot policy and AGGREGATE_NOT_FOUND
 * enforcement are uniform across core and module domains.
 */
async function mutate(deps, type, id, behavior) {
    const agg = await deps.repository.load(type, deps.tenant, id);
    behavior(agg);
    const committed = await deps.repository.save(agg);
    await publish(deps, committed);
    return committed;
}
/** New aggregate from a static factory: build, save, publish. */
async function create(deps, build) {
    const agg = build();
    const committed = await deps.repository.save(agg);
    await publish(deps, committed);
    return committed;
}
function handler(commandType, requiredPermission, run) {
    return { commandType, requiredPermission, handle: run };
}
function ok(cmd, aggregateId, events) {
    return { success: true, commandId: cmd.commandId, aggregateId, events };
}
// ============================ ORDER ============================
const createOrder = handler("order.create", "order:create", async (cmd, deps) => {
    const id = cmd.payload.orderId ? str(cmd.payload.orderId) : (0, crypto_1.randomUUID)();
    const committed = await create(deps, () => aggregates_1.OrderAggregate.create(deps.tenant, {
        id,
        channel: cmd.payload.channel,
        tableId: cmd.payload.tableId ? str(cmd.payload.tableId) : undefined,
        serverId: cmd.payload.serverId ? str(cmd.payload.serverId) : undefined,
        customerId: cmd.payload.customerId ? str(cmd.payload.customerId) : undefined,
        dinerName: cmd.payload.dinerName ? str(cmd.payload.dinerName) : undefined,
        actor: cmd.actor,
    }));
    return ok(cmd, id, committed);
});
const addOrderLine = handler("order.addLine", "order:edit", async (cmd, deps) => {
    const orderId = str(cmd.payload.orderId);
    const committed = await mutate(deps, aggregates_1.OrderAggregate.TYPE, orderId, (agg) => {
        var _a;
        return agg.addLine(cmd.actor, {
            menuItemId: str(cmd.payload.menuItemId),
            name: str(cmd.payload.name),
            unitPrice: num(cmd.payload.unitPrice),
            quantity: num((_a = cmd.payload.quantity) !== null && _a !== void 0 ? _a : 1),
            modifiers: cmd.payload.modifiers,
            course: cmd.payload.course ? num(cmd.payload.course) : undefined,
        });
    });
    return ok(cmd, orderId, committed);
});
const sendToKitchen = handler("order.sendToKitchen", "order:process", async (cmd, deps) => {
    const orderId = str(cmd.payload.orderId);
    const committed = await mutate(deps, aggregates_1.OrderAggregate.TYPE, orderId, (agg) => agg.sendToKitchen(cmd.actor, cmd.payload.lineIds));
    return ok(cmd, orderId, committed);
});
const recordPayment = handler("order.recordPayment", "order:pay", async (cmd, deps) => {
    const orderId = str(cmd.payload.orderId);
    const committed = await mutate(deps, aggregates_1.OrderAggregate.TYPE, orderId, (agg) => agg.recordPayment(cmd.actor, {
        method: str(cmd.payload.method),
        amount: num(cmd.payload.amount),
        gateway: cmd.payload.gateway ? str(cmd.payload.gateway) : undefined,
    }));
    return ok(cmd, orderId, committed);
});
const closeOrder = handler("order.close", "order:pay", async (cmd, deps) => {
    const orderId = str(cmd.payload.orderId);
    const committed = await mutate(deps, aggregates_1.OrderAggregate.TYPE, orderId, (agg) => agg.close(cmd.actor));
    return ok(cmd, orderId, committed);
});
const voidOrder = handler("order.void", "order:edit", async (cmd, deps) => {
    const orderId = str(cmd.payload.orderId);
    const committed = await mutate(deps, aggregates_1.OrderAggregate.TYPE, orderId, (agg) => { var _a; return agg.void(cmd.actor, str((_a = cmd.payload.reason) !== null && _a !== void 0 ? _a : "voided")); });
    return ok(cmd, orderId, committed);
});
// ---- Kitchen (KDS) line lifecycle ----
function lineStatusCommand(commandType, method) {
    return handler(commandType, "order:process", async (cmd, deps) => {
        const orderId = str(cmd.payload.orderId);
        const lineId = str(cmd.payload.lineId);
        const committed = await mutate(deps, aggregates_1.OrderAggregate.TYPE, orderId, (agg) => agg[method](cmd.actor, lineId));
        return ok(cmd, orderId, committed);
    });
}
const beginLine = lineStatusCommand("kitchen.beginLine", "markLinePreparing");
const readyLine = lineStatusCommand("kitchen.readyLine", "markLineReady");
const serveLine = lineStatusCommand("kitchen.serveLine", "serveLine");
const voidOrderLine = handler("order.voidLine", "order:edit", async (cmd, deps) => {
    const orderId = str(cmd.payload.orderId);
    const committed = await mutate(deps, aggregates_1.OrderAggregate.TYPE, orderId, (agg) => { var _a; return agg.voidLine(cmd.actor, str(cmd.payload.lineId), str((_a = cmd.payload.reason) !== null && _a !== void 0 ? _a : "voided")); });
    return ok(cmd, orderId, committed);
});
// ============================ TABLE ============================
const createTable = handler("table.create", "table:create", async (cmd, deps) => {
    const id = cmd.payload.tableId ? str(cmd.payload.tableId) : (0, crypto_1.randomUUID)();
    const committed = await create(deps, () => {
        var _a;
        return aggregates_1.TableAggregate.define(deps.tenant, {
            id,
            label: str(cmd.payload.label),
            capacity: num((_a = cmd.payload.capacity) !== null && _a !== void 0 ? _a : 2),
            floor: cmd.payload.floor ? str(cmd.payload.floor) : undefined,
            actor: cmd.actor,
        });
    });
    return ok(cmd, id, committed);
});
const seatTable = handler("table.seat", "table:edit", async (cmd, deps) => {
    const tableId = str(cmd.payload.tableId);
    const committed = await mutate(deps, aggregates_1.TableAggregate.TYPE, tableId, (agg) => agg.seat(cmd.actor, str(cmd.payload.orderId), str(cmd.payload.serverId)));
    return ok(cmd, tableId, committed);
});
const clearTable = handler("table.clear", "table:edit", async (cmd, deps) => {
    const tableId = str(cmd.payload.tableId);
    const committed = await mutate(deps, aggregates_1.TableAggregate.TYPE, tableId, (agg) => agg.clear(cmd.actor));
    return ok(cmd, tableId, committed);
});
const cleanTable = handler("table.clean", "table:edit", async (cmd, deps) => {
    const tableId = str(cmd.payload.tableId);
    const committed = await mutate(deps, aggregates_1.TableAggregate.TYPE, tableId, (agg) => agg.markClean(cmd.actor));
    return ok(cmd, tableId, committed);
});
// ============================ INVENTORY ============================
const defineItem = handler("inventory.defineItem", "inventory:create", async (cmd, deps) => {
    const id = cmd.payload.itemId ? str(cmd.payload.itemId) : (0, crypto_1.randomUUID)();
    const committed = await create(deps, () => {
        var _a;
        return aggregates_1.InventoryItemAggregate.define(deps.tenant, {
            id,
            sku: str(cmd.payload.sku),
            name: str(cmd.payload.name),
            unit: str((_a = cmd.payload.unit) !== null && _a !== void 0 ? _a : "ea"),
            reorderPoint: cmd.payload.reorderPoint ? num(cmd.payload.reorderPoint) : undefined,
            unitCost: cmd.payload.unitCost ? num(cmd.payload.unitCost) : undefined,
            vendorId: cmd.payload.vendorId ? str(cmd.payload.vendorId) : undefined,
            actor: cmd.actor,
        });
    });
    return ok(cmd, id, committed);
});
const receiveStock = handler("inventory.receive", "inventory:edit", async (cmd, deps) => {
    const itemId = str(cmd.payload.itemId);
    const committed = await mutate(deps, aggregates_1.InventoryItemAggregate.TYPE, itemId, (agg) => agg.receive(cmd.actor, num(cmd.payload.quantity), { note: cmd.payload.note ? str(cmd.payload.note) : undefined }));
    return ok(cmd, itemId, committed);
});
const consumeStock = handler("inventory.consume", "inventory:edit", async (cmd, deps) => {
    const itemId = str(cmd.payload.itemId);
    const committed = await mutate(deps, aggregates_1.InventoryItemAggregate.TYPE, itemId, (agg) => agg.consume(cmd.actor, num(cmd.payload.quantity), cmd.payload.orderId ? str(cmd.payload.orderId) : undefined));
    return ok(cmd, itemId, committed);
});
const recordWastage = handler("inventory.recordWastage", "inventory:edit", async (cmd, deps) => {
    const itemId = str(cmd.payload.itemId);
    const committed = await mutate(deps, aggregates_1.InventoryItemAggregate.TYPE, itemId, (agg) => { var _a; return agg.recordWastage(cmd.actor, num(cmd.payload.quantity), str((_a = cmd.payload.reason) !== null && _a !== void 0 ? _a : "unspecified")); });
    return ok(cmd, itemId, committed);
});
const adjustStock = handler("inventory.adjust", "inventory:edit", async (cmd, deps) => {
    const itemId = str(cmd.payload.itemId);
    const committed = await mutate(deps, aggregates_1.InventoryItemAggregate.TYPE, itemId, (agg) => { var _a; return agg.adjust(cmd.actor, num(cmd.payload.counted), str((_a = cmd.payload.reason) !== null && _a !== void 0 ? _a : "stock take")); });
    return ok(cmd, itemId, committed);
});
// ============================ QUERIES ============================
const getOrder = {
    queryType: "get.order",
    requiredPermission: "order:view",
    async handle(params, ctx) {
        const agg = await ctx.repository.load(aggregates_1.OrderAggregate.TYPE, ctx.tenant, str(params.orderId));
        return { id: agg.id, version: agg.version, state: agg.state, total: agg.orderTotal() };
    },
};
const getTable = {
    queryType: "get.table",
    requiredPermission: "table:view",
    async handle(params, ctx) {
        const agg = await ctx.repository.load(aggregates_1.TableAggregate.TYPE, ctx.tenant, str(params.tableId));
        return { id: agg.id, version: agg.version, state: agg.state };
    },
};
const getInventoryItem = {
    queryType: "get.inventoryItem",
    requiredPermission: "inventory:view",
    async handle(params, ctx) {
        const agg = await ctx.repository.load(aggregates_1.InventoryItemAggregate.TYPE, ctx.tenant, str(params.itemId));
        return { id: agg.id, version: agg.version, state: agg.state, available: agg.available() };
    },
};
const AUDIT_EVENT_LIMIT = 200;
const getAggregateEvents = {
    queryType: "get.aggregateEvents",
    // Raw event streams carry payment + PII payloads and actor identities:
    // audit:view (mapped from granular audit_log:view) is mandatory.
    requiredPermission: "audit:view",
    async handle(params, ctx) {
        const requested = params.limit ? num(params.limit) : AUDIT_EVENT_LIMIT;
        const limit = Math.min(Math.max(requested, 1), AUDIT_EVENT_LIMIT);
        return ctx.events.readAggregate(ctx.tenant, str(params.aggregateType), str(params.aggregateId), params.fromVersion ? num(params.fromVersion) : undefined, limit);
    },
};
// ============================ REGISTRATION ============================
exports.coreCommandHandlers = [
    createOrder, addOrderLine, sendToKitchen, recordPayment, closeOrder, voidOrder,
    beginLine, readyLine, serveLine, voidOrderLine,
    createTable, seatTable, clearTable, cleanTable,
    defineItem, receiveStock, consumeStock, recordWastage, adjustStock,
];
exports.coreQueryHandlers = [
    getOrder, getTable, getInventoryItem, getAggregateEvents,
];
