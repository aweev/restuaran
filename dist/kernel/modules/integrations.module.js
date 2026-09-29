"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.webhooksEndpointsProjection = webhooksEndpointsProjection;
exports.integrationsModule = integrationsModule;
const crypto_1 = require("crypto");
const types_1 = require("@/kernel/types");
const define_command_1 = require("@/kernel/commands/define-command");
const webhook_endpoint_aggregate_1 = require("@/kernel/integrations/webhook-endpoint.aggregate");
const webhooks_1 = require("@/kernel/integrations/webhooks");
const connectors_1 = require("@/kernel/integrations/connectors");
const accounting_connector_1 = require("@/kernel/integrations/accounting.connector");
const delivery_connector_1 = require("@/kernel/integrations/delivery.connector");
const outbound_queue_1 = require("@/kernel/integrations/outbound-queue");
const projection_1 = require("@/kernel/projections/projection");
const registry_1 = require("@/kernel/aggregates/registry");
function webhooksEndpointsProjection(store, tenant) {
    return (0, projection_1.defineProjection)({
        name: "webhooks.endpoints",
        initial: { endpoints: [] },
        watchedEventTypes: ["webhook.subscribed", "webhook.updated", "webhook.unsubscribed"],
        reduce: (state, event) => {
            var _a, _b, _c, _d, _e;
            const endpoints = [...state.endpoints];
            const idx = endpoints.findIndex((e) => e.id === event.aggregateId);
            const p = event.payload;
            if (event.eventType === "webhook.unsubscribed") {
                if (idx >= 0) {
                    endpoints[idx] = Object.assign(Object.assign({}, endpoints[idx]), { active: false, updatedAt: event.occurredAt });
                }
                return { endpoints };
            }
            const base = idx >= 0
                ? endpoints[idx]
                : {
                    id: event.aggregateId,
                    url: "",
                    secret: "",
                    eventTypes: [],
                    active: false,
                    createdAt: event.occurredAt,
                    updatedAt: event.occurredAt,
                };
            const next = Object.assign({}, base);
            if (event.eventType === "webhook.subscribed") {
                next.url = String((_a = p.url) !== null && _a !== void 0 ? _a : "");
                next.secret = String((_b = p.secret) !== null && _b !== void 0 ? _b : "");
                next.eventTypes = (_c = p.eventTypes) !== null && _c !== void 0 ? _c : [];
                next.active = true;
                next.createdAt = String((_d = p.subscribedAt) !== null && _d !== void 0 ? _d : event.occurredAt);
            }
            else if (event.eventType === "webhook.updated") {
                if (p.url !== undefined)
                    next.url = String(p.url);
                if (p.secret !== undefined)
                    next.secret = String(p.secret);
                if (p.eventTypes !== undefined)
                    next.eventTypes = (_e = p.eventTypes) !== null && _e !== void 0 ? _e : [];
            }
            next.updatedAt = event.occurredAt;
            if (idx >= 0)
                endpoints[idx] = next;
            else
                endpoints.push(next);
            endpoints.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
            return { endpoints };
        },
    }, store, tenant);
}
function integrationsModule(opts = {}) {
    var _a, _b;
    const registry = new connectors_1.ConnectorRegistry();
    if (opts.withConnectors !== false) {
        registry.register((0, accounting_connector_1.accountingConnector)());
        registry.register((0, delivery_connector_1.deliveryConnector)());
    }
    const webhooks = new outbound_queue_1.OutboundQueue({
        transport: (_a = opts.webhookTransport) !== null && _a !== void 0 ? _a : new webhooks_1.HttpWebhookTransport(),
        retry: opts.retry,
        now: opts.now,
    });
    const connectors = new outbound_queue_1.OutboundQueue({
        transport: (_b = opts.connectorTransport) !== null && _b !== void 0 ? _b : new outbound_queue_1.LoggingOutboundTransport(),
        retry: opts.retry,
        now: opts.now,
    });
    const fabric = { webhooks, connectors, registry };
    let activeRuntime = null;
    let offHook = null;
    let sweepTimer = null;
    const drain = (queue) => {
        void queue.process().catch((err) => {
            console.error("[kernel:integrations] outbound process failed:", err);
        });
    };
    /**
     * event:published fanout: webhooks (per subscribed endpoint) + connectors
     * (per registered connector). Enqueue only — delivery happens on process().
     */
    const fanout = (event) => {
        if (!activeRuntime)
            return;
        const { endpoints } = activeRuntime.projections.get("webhooks.endpoints")
            .state;
        for (const input of (0, webhooks_1.webhookDeliveriesFor)(event, endpoints)) {
            const message = webhooks.enqueue(input);
            message.headers[webhooks_1.DELIVERY_HEADER] = message.id;
        }
        for (const input of registry.fanout(event)) {
            const message = connectors.enqueue(input);
            message.headers[webhooks_1.DELIVERY_HEADER] = message.id;
        }
        if (opts.autoProcess) {
            if (webhooks.stats().pending > 0)
                drain(webhooks);
            if (connectors.stats().pending > 0)
                drain(connectors);
        }
    };
    const subscribe = (0, define_command_1.defineCommand)({
        commandType: "webhook.subscribe",
        requiredPermission: "integration:manage",
        async execute(ctx) {
            var _a, _b;
            const { payload } = ctx;
            const agg = webhook_endpoint_aggregate_1.WebhookEndpointAggregate.create(ctx.tenant, {
                id: String((_a = payload.endpointId) !== null && _a !== void 0 ? _a : (0, crypto_1.randomUUID)()),
                url: String((_b = payload.url) !== null && _b !== void 0 ? _b : ""),
                secret: payload.secret !== undefined ? String(payload.secret) : undefined,
                eventTypes: Array.isArray(payload.eventTypes)
                    ? payload.eventTypes
                    : undefined,
                actor: ctx.actor,
            });
            await ctx.commit(agg);
            return agg.id;
        },
    });
    const update = (0, define_command_1.defineCommand)({
        commandType: "webhook.update",
        requiredPermission: "integration:manage",
        async execute(ctx) {
            var _a;
            const endpointId = String((_a = ctx.payload.endpointId) !== null && _a !== void 0 ? _a : "");
            if (!endpointId)
                throw (0, types_1.kernelError)("INVALID_WEBHOOK_ENDPOINT", "endpointId is required");
            const agg = await ctx.load(webhook_endpoint_aggregate_1.WebhookEndpointAggregate.TYPE, endpointId);
            agg.update(ctx.actor, {
                url: ctx.payload.url !== undefined ? String(ctx.payload.url) : undefined,
                eventTypes: Array.isArray(ctx.payload.eventTypes)
                    ? ctx.payload.eventTypes
                    : undefined,
                secret: ctx.payload.secret !== undefined ? String(ctx.payload.secret) : undefined,
            });
            await ctx.commit(agg);
            return agg.id;
        },
    });
    const unsubscribe = (0, define_command_1.defineCommand)({
        commandType: "webhook.unsubscribe",
        requiredPermission: "integration:manage",
        async execute(ctx) {
            var _a;
            const endpointId = String((_a = ctx.payload.endpointId) !== null && _a !== void 0 ? _a : "");
            if (!endpointId)
                throw (0, types_1.kernelError)("INVALID_WEBHOOK_ENDPOINT", "endpointId is required");
            const agg = await ctx.load(webhook_endpoint_aggregate_1.WebhookEndpointAggregate.TYPE, endpointId);
            agg.unsubscribe(ctx.actor);
            await ctx.commit(agg);
            return agg.id;
        },
    });
    const replay = (0, define_command_1.defineCommand)({
        commandType: "outbound.replay",
        requiredPermission: "integration:manage",
        async execute(ctx) {
            var _a, _b;
            const deliveryId = String((_a = ctx.payload.deliveryId) !== null && _a !== void 0 ? _a : "");
            if (!deliveryId)
                throw (0, types_1.kernelError)("INVALID_DELIVERY", "deliveryId is required");
            const message = (_b = webhooks.get(deliveryId)) !== null && _b !== void 0 ? _b : connectors.get(deliveryId);
            if (!message) {
                throw (0, types_1.kernelError)("DELIVERY_NOT_FOUND", `No outbound delivery "${deliveryId}"`);
            }
            const queue = message.channel === "webhook" ? webhooks : connectors;
            const replayed = queue.replay(deliveryId);
            if (!replayed) {
                throw (0, types_1.kernelError)("INVALID_DELIVERY_STATE", `Delivery ${deliveryId} is ${message.status}; only dead deliveries can be replayed`);
            }
            if (opts.autoProcess)
                drain(queue);
            return deliveryId;
        },
    });
    const listWebhooks = {
        queryType: "list.webhooks",
        requiredPermission: "integration:view",
        async handle(_params, ctx) {
            return ctx.projections
                .get("webhooks.endpoints")
                .state.endpoints.filter((e) => e.active)
                .map((e) => ({
                id: e.id,
                url: e.url,
                eventTypes: e.eventTypes,
                active: e.active,
                createdAt: e.createdAt,
                updatedAt: e.updatedAt,
                // Never leak the signing secret through a query.
                hasSecret: Boolean(e.secret),
            }));
        },
    };
    const listOutbound = {
        queryType: "list.outbound",
        requiredPermission: "integration:view",
        async handle(params) {
            const status = params.status ? String(params.status) : undefined;
            const channel = params.channel ? String(params.channel) : undefined;
            const limit = params.limit ? Number(params.limit) : 200;
            let rows = [...webhooks.list(), ...connectors.list()];
            if (status)
                rows = rows.filter((m) => m.status === status);
            if (channel)
                rows = rows.filter((m) => m.channel === channel);
            rows.sort((a, b) => b.createdAt - a.createdAt || b.position - a.position);
            return rows.slice(0, limit);
        },
    };
    return {
        id: "ros.integrations",
        name: "Integrations",
        version: "1.0.0",
        capabilities: {
            commands: ["webhook.subscribe", "webhook.update", "webhook.unsubscribe", "outbound.replay"],
            queries: ["list.webhooks", "list.outbound"],
            eventTypes: ["webhook.subscribed", "webhook.updated", "webhook.unsubscribed"],
        },
        lifecycle: {
            async install(runtime) {
                (0, registry_1.registerAggregate)(webhook_endpoint_aggregate_1.WebhookEndpointAggregate.TYPE, webhook_endpoint_aggregate_1.WebhookEndpointAggregate);
                runtime.projections.register(webhooksEndpointsProjection(runtime.events, runtime.tenant));
            },
            async activate(runtime) {
                var _a, _b, _c;
                activeRuntime = runtime;
                offHook = runtime.hooks.on("event:published", ({ event }) => fanout(event));
                runtime.commands.register(subscribe);
                runtime.commands.register(update);
                runtime.commands.register(unsubscribe);
                runtime.commands.register(replay);
                runtime.queries.register(listWebhooks);
                runtime.queries.register(listOutbound);
                runtime.kernel.integrations = fabric;
                if (opts.autoProcess) {
                    sweepTimer = setInterval(() => {
                        drain(webhooks);
                        drain(connectors);
                    }, (_a = opts.processIntervalMs) !== null && _a !== void 0 ? _a : 2000);
                    (_c = (_b = sweepTimer).unref) === null || _c === void 0 ? void 0 : _c.call(_b);
                }
            },
            async deactivate(runtime) {
                offHook === null || offHook === void 0 ? void 0 : offHook();
                offHook = null;
                if (sweepTimer)
                    clearInterval(sweepTimer);
                sweepTimer = null;
                activeRuntime = null;
                runtime.kernel.integrations = undefined;
            },
        },
    };
}
