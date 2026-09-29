import { InMemoryEventStore } from "@/kernel/event-store/in-memory-event-store"
import { PostgresEventStore } from "@/kernel/event-store/postgres-event-store"
import { sql } from "@/lib/db"
import { Kernel, KernelConfig } from "@/kernel/kernel"
import { TenantContext } from "@/kernel/types"
import { coreCommandHandlers, coreQueryHandlers } from "@/kernel/commands/core-handlers"
import { ProjectionRegistry } from "@/kernel/projections/projection"
import { kitchenQueueProjection, tableBoardProjection, inventoryBoardProjection } from "@/kernel/projections/builtins"
import {
  UpcastRegistry,
  VersionedEventStore,
  defaultUpcasters,
} from "@/kernel/event-store/versioned-store"
import { SnapshotPolicy, defaultSnapshotPolicy } from "@/kernel/aggregates/repository"
import { reservationsModule } from "@/kernel/modules/reservations.module"
import { waitlistModule } from "@/kernel/modules/waitlist.module"
import { menuModule } from "@/kernel/modules/menu.module"
import { staffModule } from "@/kernel/modules/staff.module"
import { platformModule } from "@/kernel/modules/platform.module"
import { integrationsModule, IntegrationsModuleOptions } from "@/kernel/modules/integrations.module"
import { EventCompactor, CompactionOptions } from "@/kernel/event-store/compaction"
import { HttpSocketTransport, SocketBridge, SocketBridgeOptions, SocketTransport } from "@/kernel/modules/socket-bridge"

export function createEventStore(): KernelConfig["store"] {
  if (process.env.NODE_ENV === "production" || process.env.ROS_USE_PG === "1") {
    return new PostgresEventStore(sql as never)
  }
  return new InMemoryEventStore()
}

/** Kernel wiring that requires no transport or DB; safe to construct anywhere. */
export const phase2Modules = () => [reservationsModule(), waitlistModule(), menuModule(), staffModule()]

/** Phase 3 modules: marketplace order injection + integration fabric (webhooks/connectors). */
export const phase3Modules = (integrations?: IntegrationsModuleOptions) => [
  platformModule(),
  integrationsModule(integrations ?? {}),
]

export interface SocketConfig {
  /** Full external config; takes precedence over url/secret env defaults. */
  transport?: SocketTransport
  /** Defaults from NEXT_PUBLIC_SOCKET_URL + INTERNAL_EMIT_SECRET when true. */
  enabled?: boolean
  routes?: SocketBridgeOptions["routes"]
}

export interface CreateKernelOptions {
  tenant: TenantContext
  store?: KernelConfig["store"]
  withBuiltins?: boolean
  /** Schema upcasters; pass undefined for defaults, null to disable versioning. */
  upcasters?: UpcastRegistry | null
  snapshot?: SnapshotPolicy
}

export function createKernel(opts: CreateKernelOptions): Kernel {
  const raw = opts.store ?? createEventStore()
  const store = opts.upcasters === null ? raw : new VersionedEventStore(raw, opts.upcasters ?? defaultUpcasters())
  const projections = opts.withBuiltins === false ? undefined : buildDefaultProjections(store, opts.tenant)
  const kernel = new Kernel({
    store,
    tenant: opts.tenant,
    projections,
    snapshot: opts.snapshot ?? defaultSnapshotPolicy(50),
  })

  if (opts.withBuiltins !== false) {
    registerCore(kernel)
  }
  return kernel
}

export interface BootKernelOptions {
  socket?: SocketConfig | null
  withPhase2Modules?: boolean
  withPhase3Modules?: boolean
  /** Integration fabric options (transports, retry, autoProcess). */
  integrations?: IntegrationsModuleOptions
  /** Background compaction scheduler: intervalMs > 0 starts the job. */
  compaction?: CompactionOptions & { intervalMs?: number }
}

/**
 * Install Phase 2 + Phase 3 modules, wire the socket bridge, optionally start
 * the compaction scheduler, then boot projections. Call once after createKernel
 * (kept async because module activation is async).
 */
export async function bootKernel(kernel: Kernel, opts: BootKernelOptions = {}): Promise<SocketBridge | null> {
  if (opts.withPhase2Modules !== false) {
    for (const m of phase2Modules()) await kernel.installModule(m)
  }
  if (opts.withPhase3Modules !== false) {
    for (const m of phase3Modules(opts.integrations)) await kernel.installModule(m)
  }

  const transport = resolveTransport(opts.socket)
  let bridge: SocketBridge | null = null
  if (transport) {
    bridge = new SocketBridge(transport, { routes: opts.socket?.routes })
    kernel.hooks.on("event:published", async ({ event }) => {
      if (bridge) await bridge.handle(event as never)
    })
  }

  if (opts.compaction?.intervalMs && opts.compaction.intervalMs > 0) {
    const compactor = new EventCompactor(kernel.store, opts.compaction)
    const tick = () => {
      void compactor
        .run(kernel.tenant)
        .then((report) => {
          console.info("[kernel:compaction]", JSON.stringify(report))
        })
        .catch((err) => {
          console.error("[kernel:compaction] run failed:", err)
        })
    }
    const timer = setInterval(tick, opts.compaction.intervalMs)
    ;(timer as unknown as { unref?: () => void }).unref?.()
    kernel.addDisposer(() => clearInterval(timer))
  }

  await kernel.boot()
  return bridge
}

function resolveTransport(cfg?: SocketConfig | null): SocketTransport | null {
  if (!cfg || cfg.transport === undefined) {
    if (cfg?.enabled) {
      const url = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3001"
      const secret = process.env.INTERNAL_EMIT_SECRET
      if (!secret) return null
      return new HttpSocketTransport({ url, secret })
    }
    return null
  }
  return cfg.transport
}

function buildDefaultProjections(store: KernelConfig["store"], tenant: TenantContext): ProjectionRegistry {
  const registry = new ProjectionRegistry()
  registry.register(kitchenQueueProjection(store, tenant))
  registry.register(tableBoardProjection(store, tenant))
  registry.register(inventoryBoardProjection(store, tenant))
  return registry
}

export function registerCore(kernel: Kernel): void {
  for (const h of coreCommandHandlers) kernel.commands.register(h)
  for (const h of coreQueryHandlers) kernel.queries.register(h)
}

export * from "@/kernel/types"
export { Kernel } from "@/kernel/kernel"
export { CommandBus } from "@/kernel/commands/command-bus"
export { defineCommand } from "@/kernel/commands/define-command"
export { QueryBus } from "@/kernel/queries/query-bus"
export { HookBus } from "@/kernel/hooks/hook-bus"
export { InMemoryEventStore } from "@/kernel/event-store/in-memory-event-store"
export { PostgresEventStore } from "@/kernel/event-store/postgres-event-store"
export {
  VersionedEventStore,
  UpcastRegistry,
  CURRENT_SCHEMA_VERSION,
  SCHEMA_VERSION_KEY,
  defaultUpcasters,
} from "@/kernel/event-store/versioned-store"
export { Projection, ProjectionRegistry, defineProjection } from "@/kernel/projections/projection"
export { assertProjectionAccess, requiredCapabilityFor, PROJECTION_CAPABILITIES } from "@/kernel/projections/projection-acl"
export { buildEvent } from "@/kernel/event-store/event-store"
export { AggregateRepository, defaultSnapshotPolicy } from "@/kernel/aggregates/repository"
export {
  OrderAggregate,
  TableAggregate,
  InventoryItemAggregate,
  ReservationAggregate,
  WaitlistAggregate,
  MenuItemAggregate,
  StaffShiftAggregate,
  loadAggregate,
  saveAggregate,
  registerAggregate,
} from "@/kernel/aggregates"
export { newTenant, systemActor, assertTenant } from "@/kernel/tenant/tenant"
export { actorFromAuthPayload, deriveCapabilities } from "@/kernel/tenant/permission-map"
export { SocketBridge, HttpSocketTransport, RecordingSocketTransport } from "@/kernel/modules/socket-bridge"
export type { SocketTransport, SocketEmit, SocketBridgeOptions, EventRoute } from "@/kernel/modules/socket-bridge"
export { reservationsModule } from "@/kernel/modules/reservations.module"
export { waitlistModule } from "@/kernel/modules/waitlist.module"
export { menuModule, noSoldItems86dPolicy } from "@/kernel/modules/menu.module"
export { staffModule, computeStaffBoard } from "@/kernel/modules/staff.module"
export { platformModule, platformOrdersProjection } from "@/kernel/modules/platform.module"
export type { PlatformOrderRow, PlatformOrdersState } from "@/kernel/modules/platform.module"
export { integrationsModule, webhooksEndpointsProjection } from "@/kernel/modules/integrations.module"
export type { IntegrationsModuleOptions, WebhooksEndpointsState } from "@/kernel/modules/integrations.module"
export type { RosModule, ModuleRuntime, ModuleStatus } from "@/kernel/modules/module-registry"
export type { AttributeBag } from "@/kernel/types"
export { CURRENT_SCHEMA_VERSION as KERNEL_SCHEMA_VERSION } from "@/kernel/event-store/versioned-store"

// ---- Phase 3: integration fabric ----
export {
  OutboundQueue,
  RecordingOutboundTransport,
  LoggingOutboundTransport,
  defaultRetryPolicy,
  isInfraEvent,
} from "@/kernel/integrations/outbound-queue"
export type {
  OutboundMessage,
  OutboundTransport,
  OutboundStatus,
  EnqueueInput,
  RetryPolicy,
  ProcessReport,
} from "@/kernel/integrations/outbound-queue"
export type { IntegrationFabric } from "@/kernel/integrations/fabric"
export {
  signBody,
  verifyWebhookSignature,
  webhookEnvelope,
  webhookDeliveriesFor,
  HttpWebhookTransport,
  SIGNATURE_HEADER,
  TIMESTAMP_HEADER,
  EVENT_HEADER,
  DELIVERY_HEADER,
} from "@/kernel/integrations/webhooks"
export type { WebhookEndpointView } from "@/kernel/integrations/webhooks"
export { WebhookEndpointAggregate, assertWebhookUrl } from "@/kernel/integrations/webhook-endpoint.aggregate"
export type { WebhookEndpointState } from "@/kernel/integrations/webhook-endpoint.aggregate"
export { ConnectorRegistry } from "@/kernel/integrations/connectors"
export type { Connector } from "@/kernel/integrations/connectors"
export { accountingConnector } from "@/kernel/integrations/accounting.connector"
export { deliveryConnector } from "@/kernel/integrations/delivery.connector"

// ---- Phase 3: platform/marketplace injection ----
export { PlatformOrderAggregate, platformOrderId } from "@/kernel/aggregates/platform-order.aggregate"
export type { PlatformOrderState } from "@/kernel/aggregates/platform-order.aggregate"

// ---- Phase 3: event compaction ----
export { EventCompactor } from "@/kernel/event-store/compaction"
export type { CompactionOptions, CompactionReport, CompactableEventStore } from "@/kernel/event-store/compaction"

// ---- Phase 3: public API surface + generated SDK ----
export { collectSurface, buildSdkSource } from "@/kernel/public-api/generate-sdk"
export type { KernelSurface } from "@/kernel/public-api/generate-sdk"