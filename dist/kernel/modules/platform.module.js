"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.platformOrdersProjection = platformOrdersProjection;
exports.platformModule = platformModule;
const crypto_1 = require("crypto");
const types_1 = require("@/kernel/types");
const define_command_1 = require("@/kernel/commands/define-command");
const aggregates_1 = require("@/kernel/aggregates");
const projection_1 = require("@/kernel/projections/projection");
const tenant_1 = require("@/kernel/tenant/tenant");
function platformOrdersProjection(store, tenant) {
    return (0, projection_1.defineProjection)({
        name: "platform.orders",
        initial: { rows: [] },
        watchedEventTypes: [
            "platform.orderReceived",
            "platform.orderCancelled",
            "platform.orderCompleted",
        ],
        reduce: (state, event) => {
            var _a, _b, _c, _d, _e, _f, _g, _h;
            const rows = [...state.rows];
            const idx = rows.findIndex((r) => r.id === event.aggregateId);
            const p = event.payload;
            const base = idx >= 0
                ? rows[idx]
                : {
                    id: event.aggregateId,
                    platform: "",
                    externalOrderId: "",
                    orderId: null,
                    status: "received",
                    fulfillment: "delivery",
                    customerName: null,
                    itemsSubtotal: 0,
                    itemCount: 0,
                    receivedAt: event.occurredAt,
                };
            const next = Object.assign({}, base);
            if (event.eventType === "platform.orderReceived") {
                next.platform = String((_a = p.platform) !== null && _a !== void 0 ? _a : "");
                next.externalOrderId = String((_b = p.externalOrderId) !== null && _b !== void 0 ? _b : "");
                next.orderId = (_c = p.orderId) !== null && _c !== void 0 ? _c : null;
                next.fulfillment = String((_d = p.fulfillment) !== null && _d !== void 0 ? _d : "delivery");
                next.customerName = (_e = p.customerName) !== null && _e !== void 0 ? _e : null;
                next.itemsSubtotal = Number((_f = p.itemsSubtotal) !== null && _f !== void 0 ? _f : 0);
                next.itemCount = Number((_g = p.itemCount) !== null && _g !== void 0 ? _g : 0);
                next.receivedAt = String((_h = p.receivedAt) !== null && _h !== void 0 ? _h : event.occurredAt);
                next.status = "received";
            }
            else if (event.eventType === "platform.orderCancelled") {
                next.status = "cancelled";
            }
            else if (event.eventType === "platform.orderCompleted") {
                next.status = "completed";
            }
            if (idx >= 0)
                rows[idx] = next;
            else
                rows.push(next);
            rows.sort((a, b) => a.receivedAt.localeCompare(b.receivedAt));
            return { rows };
        },
    }, store, tenant);
}
/** The integration identity an external platform acts as when it drives the POS. */
function platformActor(platform) {
    return (0, tenant_1.systemActor)({ userId: `platform:${platform}`, roles: ["integration"] });
}
function platformModule() {
    // Captured at activate: ingest drives the *core* command bus so permission
    // gates and cross-module policies (e.g. the menu 86 veto) apply to injected
    // marketplace orders exactly as they do to POS orders.
    let bus = null;
    const runOrFail = async (cmdBus, tenant, actor, commandType, payload) => cmdBus.dispatch(commandType, payload, { tenant, actor });
    const ingest = (0, define_command_1.defineCommand)({
        commandType: "platform.ingestOrder",
        requiredPermission: "order:create",
        async execute(ctx) {
            var _a, _b, _c, _d, _e;
            const { payload } = ctx;
            const platform = String((_a = payload.platform) !== null && _a !== void 0 ? _a : "").trim();
            const externalOrderId = String((_b = payload.externalOrderId) !== null && _b !== void 0 ? _b : "").trim();
            if (!platform)
                throw (0, types_1.kernelError)("INVALID_PLATFORM_ORDER", "platform is required");
            if (!externalOrderId)
                throw (0, types_1.kernelError)("INVALID_PLATFORM_ORDER", "externalOrderId is required");
            // Deterministic id doubles as the idempotency key: a retried webhook or
            // replayed marketplace push maps onto the same stream and no-ops.
            const id = (0, aggregates_1.platformOrderId)(platform, externalOrderId);
            const existing = await ctx.repository.read(aggregates_1.PlatformOrderAggregate.TYPE, ctx.tenant, id);
            if (existing.exists)
                return existing.id;
            const items = Array.isArray(payload.items) ? payload.items : [];
            if (items.length === 0) {
                throw (0, types_1.kernelError)("PLATFORM_ORDER_EMPTY", "An ingest order needs at least one item");
            }
            if (!bus)
                throw (0, types_1.kernelError)("PLATFORM_MODULE_NOT_READY", "Command bus unavailable");
            const cmdBus = bus;
            const actor = platformActor(platform);
            const customer = ((_c = payload.customer) !== null && _c !== void 0 ? _c : {});
            const customerName = customer.name ? String(customer.name) : undefined;
            const orderId = (0, crypto_1.randomUUID)();
            const abort = async (code, message, details) => {
                // Nothing partially lands: the created order is voided before failing.
                await runOrFail(cmdBus, ctx.tenant, actor, "order.void", {
                    orderId,
                    reason: `platform ingest rejected: ${code}`,
                }).catch(() => undefined);
                throw (0, types_1.kernelError)(code, message, Object.assign(Object.assign({}, details), { orderId }));
            };
            const created = await runOrFail(cmdBus, ctx.tenant, actor, "order.create", {
                orderId,
                channel: "platform",
                customerId: payload.customerId ? String(payload.customerId) : undefined,
                dinerName: customerName,
            });
            if (!created.success) {
                // No order exists yet — fail without the void dance.
                throw (0, types_1.kernelError)(created.error.code, created.error.message, Object.assign(Object.assign({}, created.error.details), { orderId }));
            }
            let subtotal = 0;
            for (const [i, raw] of items.entries()) {
                const item = (raw !== null && raw !== void 0 ? raw : {});
                const unitPrice = Number(item.unitPrice);
                const quantity = Number((_d = item.quantity) !== null && _d !== void 0 ? _d : 1);
                const name = String((_e = item.name) !== null && _e !== void 0 ? _e : "");
                if (!name)
                    await abort("INVALID_PLATFORM_ITEM", `items[${i}].name is required`);
                if (!Number.isFinite(unitPrice) || unitPrice < 0) {
                    await abort("INVALID_PLATFORM_ITEM", `items[${i}].unitPrice must be a non-negative number`);
                }
                if (!Number.isInteger(quantity) || quantity <= 0) {
                    await abort("INVALID_PLATFORM_ITEM", `items[${i}].quantity must be a positive integer`);
                }
                subtotal += unitPrice * quantity;
                // Cross-module policies run here: a 86'd item vetoes the whole ingest.
                const line = await runOrFail(cmdBus, ctx.tenant, actor, "order.addLine", {
                    orderId,
                    menuItemId: item.menuItemId
                        ? String(item.menuItemId)
                        : item.externalItemId
                            ? String(item.externalItemId)
                            : `platform:${platform}`,
                    name,
                    unitPrice,
                    quantity,
                    modifiers: item.modifiers,
                });
                if (!line.success) {
                    await abort(line.error.code, line.error.message, Object.assign(Object.assign({}, line.error.details), { menuItemId: item.menuItemId }));
                }
            }
            if (payload.sendToKitchen !== false) {
                const sent = await runOrFail(cmdBus, ctx.tenant, actor, "order.sendToKitchen", { orderId });
                if (!sent.success)
                    await abort(sent.error.code, sent.error.message, sent.error.details);
            }
            const agg = aggregates_1.PlatformOrderAggregate.create(ctx.tenant, {
                id,
                platform,
                externalOrderId,
                orderId,
                fulfillment: payload.fulfillment === "pickup" ? "pickup" : "delivery",
                customerName: customerName !== null && customerName !== void 0 ? customerName : null,
                itemsSubtotal: subtotal,
                itemCount: items.length,
                actor: ctx.actor,
            });
            await ctx.commit(agg);
            // Always the platform order id — identical to the idempotent dedupe path,
            // so retried ingests return the same aggregateId. The POS order id is on
            // the committed event (payload.orderId) and via get.platformOrder.
            return agg.id;
        },
    });
    const cancel = (0, define_command_1.defineCommand)({
        commandType: "platform.cancelOrder",
        requiredPermission: "order:edit",
        async execute(ctx) {
            var _a, _b;
            const id = String((_a = ctx.payload.platformOrderId) !== null && _a !== void 0 ? _a : "");
            if (!id)
                throw (0, types_1.kernelError)("INVALID_PLATFORM_ORDER", "platformOrderId is required");
            const agg = await ctx.load(aggregates_1.PlatformOrderAggregate.TYPE, id);
            if (agg.state.status !== "received") {
                throw (0, types_1.kernelError)("PLATFORM_ORDER_TERMINAL", `Platform order is ${agg.state.status}`);
            }
            if (!bus)
                throw (0, types_1.kernelError)("PLATFORM_MODULE_NOT_READY", "Command bus unavailable");
            const reason = String((_b = ctx.payload.reason) !== null && _b !== void 0 ? _b : "cancelled by platform");
            // Void the POS order first — a closed order means the cancellation
            // arrived too late, and the whole command must fail atomically.
            if (agg.state.orderId) {
                const result = await runOrFail(bus, ctx.tenant, platformActor(agg.state.platform), "order.void", {
                    orderId: agg.state.orderId,
                    reason,
                });
                if (!result.success) {
                    throw (0, types_1.kernelError)(result.error.code, result.error.message, Object.assign(Object.assign({}, result.error.details), { orderId: agg.state.orderId }));
                }
            }
            agg.cancel(ctx.actor, reason);
            await ctx.commit(agg);
            return agg.id;
        },
    });
    const complete = (0, define_command_1.defineCommand)({
        commandType: "platform.completeOrder",
        requiredPermission: "order:process",
        async execute(ctx) {
            var _a;
            const id = String((_a = ctx.payload.platformOrderId) !== null && _a !== void 0 ? _a : "");
            if (!id)
                throw (0, types_1.kernelError)("INVALID_PLATFORM_ORDER", "platformOrderId is required");
            const agg = await ctx.load(aggregates_1.PlatformOrderAggregate.TYPE, id);
            agg.complete(ctx.actor);
            await ctx.commit(agg);
            return agg.id;
        },
    });
    const getPlatformOrder = {
        queryType: "get.platformOrder",
        requiredPermission: "order:view",
        async handle(params, ctx) {
            const agg = await ctx.repository.load(aggregates_1.PlatformOrderAggregate.TYPE, ctx.tenant, String(params.platformOrderId));
            return { id: agg.id, version: agg.version, state: agg.state };
        },
    };
    const listPlatformOrders = {
        queryType: "list.platformOrders",
        requiredPermission: "order:view",
        async handle(params, ctx) {
            const rows = ctx.projections.get("platform.orders").state.rows;
            const status = params.status ? String(params.status) : null;
            return status ? rows.filter((r) => r.status === status) : rows;
        },
    };
    return {
        id: "ros.platform",
        name: "Platform Orders",
        version: "1.0.0",
        capabilities: {
            commands: ["platform.ingestOrder", "platform.cancelOrder", "platform.completeOrder"],
            queries: ["get.platformOrder", "list.platformOrders"],
            eventTypes: ["platform.orderReceived", "platform.orderCancelled", "platform.orderCompleted"],
        },
        lifecycle: {
            async install(runtime) {
                runtime.projections.register(platformOrdersProjection(runtime.events, runtime.tenant));
            },
            async activate(runtime) {
                bus = runtime.commands;
                runtime.commands.register(ingest);
                runtime.commands.register(cancel);
                runtime.commands.register(complete);
                runtime.queries.register(getPlatformOrder);
                runtime.queries.register(listPlatformOrders);
            },
            async deactivate() {
                bus = null;
            },
        },
    };
}
