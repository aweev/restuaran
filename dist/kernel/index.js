"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.integrationsModule = exports.platformOrdersProjection = exports.platformModule = exports.computeStaffBoard = exports.staffModule = exports.noSoldItems86dPolicy = exports.menuModule = exports.waitlistModule = exports.reservationsModule = exports.RecordingSocketTransport = exports.HttpSocketTransport = exports.SocketBridge = exports.deriveCapabilities = exports.actorFromAuthPayload = exports.assertTenant = exports.systemActor = exports.newTenant = exports.registerAggregate = exports.saveAggregate = exports.loadAggregate = exports.StaffShiftAggregate = exports.MenuItemAggregate = exports.WaitlistAggregate = exports.ReservationAggregate = exports.InventoryItemAggregate = exports.TableAggregate = exports.OrderAggregate = exports.defaultSnapshotPolicy = exports.AggregateRepository = exports.buildEvent = exports.PROJECTION_CAPABILITIES = exports.requiredCapabilityFor = exports.assertProjectionAccess = exports.defineProjection = exports.ProjectionRegistry = exports.Projection = exports.defaultUpcasters = exports.SCHEMA_VERSION_KEY = exports.CURRENT_SCHEMA_VERSION = exports.UpcastRegistry = exports.VersionedEventStore = exports.PostgresEventStore = exports.InMemoryEventStore = exports.HookBus = exports.QueryBus = exports.defineCommand = exports.CommandBus = exports.Kernel = exports.phase3Modules = exports.phase2Modules = void 0;
exports.buildSdkSource = exports.collectSurface = exports.EventCompactor = exports.platformOrderId = exports.PlatformOrderAggregate = exports.deliveryConnector = exports.accountingConnector = exports.ConnectorRegistry = exports.assertWebhookUrl = exports.WebhookEndpointAggregate = exports.DELIVERY_HEADER = exports.EVENT_HEADER = exports.TIMESTAMP_HEADER = exports.SIGNATURE_HEADER = exports.HttpWebhookTransport = exports.webhookDeliveriesFor = exports.webhookEnvelope = exports.verifyWebhookSignature = exports.signBody = exports.isInfraEvent = exports.defaultRetryPolicy = exports.LoggingOutboundTransport = exports.RecordingOutboundTransport = exports.OutboundQueue = exports.KERNEL_SCHEMA_VERSION = exports.webhooksEndpointsProjection = void 0;
exports.createEventStore = createEventStore;
exports.createKernel = createKernel;
exports.bootKernel = bootKernel;
exports.registerCore = registerCore;
const in_memory_event_store_1 = require("@/kernel/event-store/in-memory-event-store");
const postgres_event_store_1 = require("@/kernel/event-store/postgres-event-store");
const db_1 = require("@/lib/db");
const kernel_1 = require("@/kernel/kernel");
const core_handlers_1 = require("@/kernel/commands/core-handlers");
const projection_1 = require("@/kernel/projections/projection");
const builtins_1 = require("@/kernel/projections/builtins");
const versioned_store_1 = require("@/kernel/event-store/versioned-store");
const repository_1 = require("@/kernel/aggregates/repository");
const reservations_module_1 = require("@/kernel/modules/reservations.module");
const waitlist_module_1 = require("@/kernel/modules/waitlist.module");
const menu_module_1 = require("@/kernel/modules/menu.module");
const staff_module_1 = require("@/kernel/modules/staff.module");
const platform_module_1 = require("@/kernel/modules/platform.module");
const integrations_module_1 = require("@/kernel/modules/integrations.module");
const compaction_1 = require("@/kernel/event-store/compaction");
const socket_bridge_1 = require("@/kernel/modules/socket-bridge");
function createEventStore() {
    if (process.env.NODE_ENV === "production" || process.env.ROS_USE_PG === "1") {
        return new postgres_event_store_1.PostgresEventStore(db_1.sql);
    }
    return new in_memory_event_store_1.InMemoryEventStore();
}
/** Kernel wiring that requires no transport or DB; safe to construct anywhere. */
const phase2Modules = () => [(0, reservations_module_1.reservationsModule)(), (0, waitlist_module_1.waitlistModule)(), (0, menu_module_1.menuModule)(), (0, staff_module_1.staffModule)()];
exports.phase2Modules = phase2Modules;
/** Phase 3 modules: marketplace order injection + integration fabric (webhooks/connectors). */
const phase3Modules = (integrations) => [
    (0, platform_module_1.platformModule)(),
    (0, integrations_module_1.integrationsModule)(integrations !== null && integrations !== void 0 ? integrations : {}),
];
exports.phase3Modules = phase3Modules;
function createKernel(opts) {
    var _a, _b, _c;
    const raw = (_a = opts.store) !== null && _a !== void 0 ? _a : createEventStore();
    const store = opts.upcasters === null ? raw : new versioned_store_1.VersionedEventStore(raw, (_b = opts.upcasters) !== null && _b !== void 0 ? _b : (0, versioned_store_1.defaultUpcasters)());
    const projections = opts.withBuiltins === false ? undefined : buildDefaultProjections(store, opts.tenant);
    const kernel = new kernel_1.Kernel({
        store,
        tenant: opts.tenant,
        projections,
        snapshot: (_c = opts.snapshot) !== null && _c !== void 0 ? _c : (0, repository_1.defaultSnapshotPolicy)(50),
    });
    if (opts.withBuiltins !== false) {
        registerCore(kernel);
    }
    return kernel;
}
/**
 * Install Phase 2 + Phase 3 modules, wire the socket bridge, optionally start
 * the compaction scheduler, then boot projections. Call once after createKernel
 * (kept async because module activation is async).
 */
async function bootKernel(kernel, opts = {}) {
    var _a, _b, _c, _d;
    if (opts.withPhase2Modules !== false) {
        for (const m of (0, exports.phase2Modules)())
            await kernel.installModule(m);
    }
    if (opts.withPhase3Modules !== false) {
        for (const m of (0, exports.phase3Modules)(opts.integrations))
            await kernel.installModule(m);
    }
    const transport = resolveTransport(opts.socket);
    let bridge = null;
    if (transport) {
        bridge = new socket_bridge_1.SocketBridge(transport, { routes: (_a = opts.socket) === null || _a === void 0 ? void 0 : _a.routes });
        kernel.hooks.on("event:published", async ({ event }) => {
            if (bridge)
                await bridge.handle(event);
        });
    }
    if (((_b = opts.compaction) === null || _b === void 0 ? void 0 : _b.intervalMs) && opts.compaction.intervalMs > 0) {
        const compactor = new compaction_1.EventCompactor(kernel.store, opts.compaction);
        const tick = () => {
            void compactor
                .run(kernel.tenant)
                .then((report) => {
                // eslint-disable-next-line no-console
                console.info("[kernel:compaction]", JSON.stringify(report));
            })
                .catch((err) => {
                // eslint-disable-next-line no-console
                console.error("[kernel:compaction] run failed:", err);
            });
        };
        const timer = setInterval(tick, opts.compaction.intervalMs);
        (_d = (_c = timer).unref) === null || _d === void 0 ? void 0 : _d.call(_c);
        kernel.addDisposer(() => clearInterval(timer));
    }
    await kernel.boot();
    return bridge;
}
function resolveTransport(cfg) {
    if (!cfg || cfg.transport === undefined) {
        if (cfg === null || cfg === void 0 ? void 0 : cfg.enabled) {
            const url = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3001";
            const secret = process.env.INTERNAL_EMIT_SECRET;
            if (!secret)
                return null;
            return new socket_bridge_1.HttpSocketTransport({ url, secret });
        }
        return null;
    }
    return cfg.transport;
}
function buildDefaultProjections(store, tenant) {
    const registry = new projection_1.ProjectionRegistry();
    registry.register((0, builtins_1.kitchenQueueProjection)(store, tenant));
    registry.register((0, builtins_1.tableBoardProjection)(store, tenant));
    registry.register((0, builtins_1.inventoryBoardProjection)(store, tenant));
    return registry;
}
function registerCore(kernel) {
    for (const h of core_handlers_1.coreCommandHandlers)
        kernel.commands.register(h);
    for (const h of core_handlers_1.coreQueryHandlers)
        kernel.queries.register(h);
}
__exportStar(require("@/kernel/types"), exports);
var kernel_2 = require("@/kernel/kernel");
Object.defineProperty(exports, "Kernel", { enumerable: true, get: function () { return kernel_2.Kernel; } });
var command_bus_1 = require("@/kernel/commands/command-bus");
Object.defineProperty(exports, "CommandBus", { enumerable: true, get: function () { return command_bus_1.CommandBus; } });
var define_command_1 = require("@/kernel/commands/define-command");
Object.defineProperty(exports, "defineCommand", { enumerable: true, get: function () { return define_command_1.defineCommand; } });
var query_bus_1 = require("@/kernel/queries/query-bus");
Object.defineProperty(exports, "QueryBus", { enumerable: true, get: function () { return query_bus_1.QueryBus; } });
var hook_bus_1 = require("@/kernel/hooks/hook-bus");
Object.defineProperty(exports, "HookBus", { enumerable: true, get: function () { return hook_bus_1.HookBus; } });
var in_memory_event_store_2 = require("@/kernel/event-store/in-memory-event-store");
Object.defineProperty(exports, "InMemoryEventStore", { enumerable: true, get: function () { return in_memory_event_store_2.InMemoryEventStore; } });
var postgres_event_store_2 = require("@/kernel/event-store/postgres-event-store");
Object.defineProperty(exports, "PostgresEventStore", { enumerable: true, get: function () { return postgres_event_store_2.PostgresEventStore; } });
var versioned_store_2 = require("@/kernel/event-store/versioned-store");
Object.defineProperty(exports, "VersionedEventStore", { enumerable: true, get: function () { return versioned_store_2.VersionedEventStore; } });
Object.defineProperty(exports, "UpcastRegistry", { enumerable: true, get: function () { return versioned_store_2.UpcastRegistry; } });
Object.defineProperty(exports, "CURRENT_SCHEMA_VERSION", { enumerable: true, get: function () { return versioned_store_2.CURRENT_SCHEMA_VERSION; } });
Object.defineProperty(exports, "SCHEMA_VERSION_KEY", { enumerable: true, get: function () { return versioned_store_2.SCHEMA_VERSION_KEY; } });
Object.defineProperty(exports, "defaultUpcasters", { enumerable: true, get: function () { return versioned_store_2.defaultUpcasters; } });
var projection_2 = require("@/kernel/projections/projection");
Object.defineProperty(exports, "Projection", { enumerable: true, get: function () { return projection_2.Projection; } });
Object.defineProperty(exports, "ProjectionRegistry", { enumerable: true, get: function () { return projection_2.ProjectionRegistry; } });
Object.defineProperty(exports, "defineProjection", { enumerable: true, get: function () { return projection_2.defineProjection; } });
var projection_acl_1 = require("@/kernel/projections/projection-acl");
Object.defineProperty(exports, "assertProjectionAccess", { enumerable: true, get: function () { return projection_acl_1.assertProjectionAccess; } });
Object.defineProperty(exports, "requiredCapabilityFor", { enumerable: true, get: function () { return projection_acl_1.requiredCapabilityFor; } });
Object.defineProperty(exports, "PROJECTION_CAPABILITIES", { enumerable: true, get: function () { return projection_acl_1.PROJECTION_CAPABILITIES; } });
var event_store_1 = require("@/kernel/event-store/event-store");
Object.defineProperty(exports, "buildEvent", { enumerable: true, get: function () { return event_store_1.buildEvent; } });
var repository_2 = require("@/kernel/aggregates/repository");
Object.defineProperty(exports, "AggregateRepository", { enumerable: true, get: function () { return repository_2.AggregateRepository; } });
Object.defineProperty(exports, "defaultSnapshotPolicy", { enumerable: true, get: function () { return repository_2.defaultSnapshotPolicy; } });
var aggregates_1 = require("@/kernel/aggregates");
Object.defineProperty(exports, "OrderAggregate", { enumerable: true, get: function () { return aggregates_1.OrderAggregate; } });
Object.defineProperty(exports, "TableAggregate", { enumerable: true, get: function () { return aggregates_1.TableAggregate; } });
Object.defineProperty(exports, "InventoryItemAggregate", { enumerable: true, get: function () { return aggregates_1.InventoryItemAggregate; } });
Object.defineProperty(exports, "ReservationAggregate", { enumerable: true, get: function () { return aggregates_1.ReservationAggregate; } });
Object.defineProperty(exports, "WaitlistAggregate", { enumerable: true, get: function () { return aggregates_1.WaitlistAggregate; } });
Object.defineProperty(exports, "MenuItemAggregate", { enumerable: true, get: function () { return aggregates_1.MenuItemAggregate; } });
Object.defineProperty(exports, "StaffShiftAggregate", { enumerable: true, get: function () { return aggregates_1.StaffShiftAggregate; } });
Object.defineProperty(exports, "loadAggregate", { enumerable: true, get: function () { return aggregates_1.loadAggregate; } });
Object.defineProperty(exports, "saveAggregate", { enumerable: true, get: function () { return aggregates_1.saveAggregate; } });
Object.defineProperty(exports, "registerAggregate", { enumerable: true, get: function () { return aggregates_1.registerAggregate; } });
var tenant_1 = require("@/kernel/tenant/tenant");
Object.defineProperty(exports, "newTenant", { enumerable: true, get: function () { return tenant_1.newTenant; } });
Object.defineProperty(exports, "systemActor", { enumerable: true, get: function () { return tenant_1.systemActor; } });
Object.defineProperty(exports, "assertTenant", { enumerable: true, get: function () { return tenant_1.assertTenant; } });
var permission_map_1 = require("@/kernel/tenant/permission-map");
Object.defineProperty(exports, "actorFromAuthPayload", { enumerable: true, get: function () { return permission_map_1.actorFromAuthPayload; } });
Object.defineProperty(exports, "deriveCapabilities", { enumerable: true, get: function () { return permission_map_1.deriveCapabilities; } });
var socket_bridge_2 = require("@/kernel/modules/socket-bridge");
Object.defineProperty(exports, "SocketBridge", { enumerable: true, get: function () { return socket_bridge_2.SocketBridge; } });
Object.defineProperty(exports, "HttpSocketTransport", { enumerable: true, get: function () { return socket_bridge_2.HttpSocketTransport; } });
Object.defineProperty(exports, "RecordingSocketTransport", { enumerable: true, get: function () { return socket_bridge_2.RecordingSocketTransport; } });
var reservations_module_2 = require("@/kernel/modules/reservations.module");
Object.defineProperty(exports, "reservationsModule", { enumerable: true, get: function () { return reservations_module_2.reservationsModule; } });
var waitlist_module_2 = require("@/kernel/modules/waitlist.module");
Object.defineProperty(exports, "waitlistModule", { enumerable: true, get: function () { return waitlist_module_2.waitlistModule; } });
var menu_module_2 = require("@/kernel/modules/menu.module");
Object.defineProperty(exports, "menuModule", { enumerable: true, get: function () { return menu_module_2.menuModule; } });
Object.defineProperty(exports, "noSoldItems86dPolicy", { enumerable: true, get: function () { return menu_module_2.noSoldItems86dPolicy; } });
var staff_module_2 = require("@/kernel/modules/staff.module");
Object.defineProperty(exports, "staffModule", { enumerable: true, get: function () { return staff_module_2.staffModule; } });
Object.defineProperty(exports, "computeStaffBoard", { enumerable: true, get: function () { return staff_module_2.computeStaffBoard; } });
var platform_module_2 = require("@/kernel/modules/platform.module");
Object.defineProperty(exports, "platformModule", { enumerable: true, get: function () { return platform_module_2.platformModule; } });
Object.defineProperty(exports, "platformOrdersProjection", { enumerable: true, get: function () { return platform_module_2.platformOrdersProjection; } });
var integrations_module_2 = require("@/kernel/modules/integrations.module");
Object.defineProperty(exports, "integrationsModule", { enumerable: true, get: function () { return integrations_module_2.integrationsModule; } });
Object.defineProperty(exports, "webhooksEndpointsProjection", { enumerable: true, get: function () { return integrations_module_2.webhooksEndpointsProjection; } });
var versioned_store_3 = require("@/kernel/event-store/versioned-store");
Object.defineProperty(exports, "KERNEL_SCHEMA_VERSION", { enumerable: true, get: function () { return versioned_store_3.CURRENT_SCHEMA_VERSION; } });
// ---- Phase 3: integration fabric ----
var outbound_queue_1 = require("@/kernel/integrations/outbound-queue");
Object.defineProperty(exports, "OutboundQueue", { enumerable: true, get: function () { return outbound_queue_1.OutboundQueue; } });
Object.defineProperty(exports, "RecordingOutboundTransport", { enumerable: true, get: function () { return outbound_queue_1.RecordingOutboundTransport; } });
Object.defineProperty(exports, "LoggingOutboundTransport", { enumerable: true, get: function () { return outbound_queue_1.LoggingOutboundTransport; } });
Object.defineProperty(exports, "defaultRetryPolicy", { enumerable: true, get: function () { return outbound_queue_1.defaultRetryPolicy; } });
Object.defineProperty(exports, "isInfraEvent", { enumerable: true, get: function () { return outbound_queue_1.isInfraEvent; } });
var webhooks_1 = require("@/kernel/integrations/webhooks");
Object.defineProperty(exports, "signBody", { enumerable: true, get: function () { return webhooks_1.signBody; } });
Object.defineProperty(exports, "verifyWebhookSignature", { enumerable: true, get: function () { return webhooks_1.verifyWebhookSignature; } });
Object.defineProperty(exports, "webhookEnvelope", { enumerable: true, get: function () { return webhooks_1.webhookEnvelope; } });
Object.defineProperty(exports, "webhookDeliveriesFor", { enumerable: true, get: function () { return webhooks_1.webhookDeliveriesFor; } });
Object.defineProperty(exports, "HttpWebhookTransport", { enumerable: true, get: function () { return webhooks_1.HttpWebhookTransport; } });
Object.defineProperty(exports, "SIGNATURE_HEADER", { enumerable: true, get: function () { return webhooks_1.SIGNATURE_HEADER; } });
Object.defineProperty(exports, "TIMESTAMP_HEADER", { enumerable: true, get: function () { return webhooks_1.TIMESTAMP_HEADER; } });
Object.defineProperty(exports, "EVENT_HEADER", { enumerable: true, get: function () { return webhooks_1.EVENT_HEADER; } });
Object.defineProperty(exports, "DELIVERY_HEADER", { enumerable: true, get: function () { return webhooks_1.DELIVERY_HEADER; } });
var webhook_endpoint_aggregate_1 = require("@/kernel/integrations/webhook-endpoint.aggregate");
Object.defineProperty(exports, "WebhookEndpointAggregate", { enumerable: true, get: function () { return webhook_endpoint_aggregate_1.WebhookEndpointAggregate; } });
Object.defineProperty(exports, "assertWebhookUrl", { enumerable: true, get: function () { return webhook_endpoint_aggregate_1.assertWebhookUrl; } });
var connectors_1 = require("@/kernel/integrations/connectors");
Object.defineProperty(exports, "ConnectorRegistry", { enumerable: true, get: function () { return connectors_1.ConnectorRegistry; } });
var accounting_connector_1 = require("@/kernel/integrations/accounting.connector");
Object.defineProperty(exports, "accountingConnector", { enumerable: true, get: function () { return accounting_connector_1.accountingConnector; } });
var delivery_connector_1 = require("@/kernel/integrations/delivery.connector");
Object.defineProperty(exports, "deliveryConnector", { enumerable: true, get: function () { return delivery_connector_1.deliveryConnector; } });
// ---- Phase 3: platform/marketplace injection ----
var platform_order_aggregate_1 = require("@/kernel/aggregates/platform-order.aggregate");
Object.defineProperty(exports, "PlatformOrderAggregate", { enumerable: true, get: function () { return platform_order_aggregate_1.PlatformOrderAggregate; } });
Object.defineProperty(exports, "platformOrderId", { enumerable: true, get: function () { return platform_order_aggregate_1.platformOrderId; } });
// ---- Phase 3: event compaction ----
var compaction_2 = require("@/kernel/event-store/compaction");
Object.defineProperty(exports, "EventCompactor", { enumerable: true, get: function () { return compaction_2.EventCompactor; } });
// ---- Phase 3: public API surface + generated SDK ----
var generate_sdk_1 = require("@/kernel/public-api/generate-sdk");
Object.defineProperty(exports, "collectSurface", { enumerable: true, get: function () { return generate_sdk_1.collectSurface; } });
Object.defineProperty(exports, "buildSdkSource", { enumerable: true, get: function () { return generate_sdk_1.buildSdkSource; } });
