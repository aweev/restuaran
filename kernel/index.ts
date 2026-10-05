import { InMemoryEventStore } from "@/kernel/event-store/in-memory-event-store"
import { PostgresEventStore } from "@/kernel/event-store/postgres-event-store"
import { sql } from "@/lib/db"
import { Kernel, KernelConfig } from "@/kernel/kernel"
import { TenantContext } from "@/kernel/types"
import { coreCommandHandlers, coreQueryHandlers } from "@/kernel/commands/core-handlers"
import { ProjectionRegistry } from "@/kernel/projections/projection"
import { kitchenQueueProjection, tableBoardProjection, inventoryBoardProjection } from "@/kernel/projections/builtins"
import { orderBoardProjection } from "@/kernel/projections/orders-board"
import { salesBoardProjection } from "@/kernel/projections/sales-board"
import { staffBoardProjection } from "@/kernel/projections/staff-board"
import { customersModule } from "@/kernel/modules/customers.module"
import {
  UpcastRegistry,
  VersionedEventStore,
  defaultUpcasters,
} from "@/kernel/event-store/versioned-store"
import { SnapshotPolicy, defaultSnapshotPolicy } from "@/kernel/aggregates/repository"
import { reservationsModule } from "@/kernel/modules/reservations.module"
import { inventoryModule } from "@/kernel/modules/inventory.module"
import { IdempotencyStore } from "@/kernel/commands/command-bus"
import { paymentsModule } from "@/kernel/modules/payments.module"
import { giftCardsModule } from "@/kernel/modules/gift-cards.module"
import { promotionsModule } from "@/kernel/modules/promotions.module"
import { waitlistModule } from "@/kernel/modules/waitlist.module"
import { menuModule } from "@/kernel/modules/menu.module"
import { staffModule } from "@/kernel/modules/staff.module"
import { venuesModule } from "@/kernel/modules/venues.module"
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

/** Phase 5: the customers, loyalty and feedback domain. */
export const customerModules = () => [customersModule()]

/** Phase 3 modules: marketplace order injection + integration fabric (webhooks/connectors). */
export const phase3Modules = (integrations?: IntegrationsModuleOptions) => [
  platformModule(),
  integrationsModule(integrations ?? {}),
]

/** Phase 4 modules: stored-value gift cards + marketing promotions. */
export const phase4Modules = () => [giftCardsModule(), promotionsModule()]

/** Venue registry: the multi-venue switcher's read model + write path. */
export const venueModules = () => [venuesModule()]

/** Inventory domain module (re-exports core inventory handlers + board). */
export const inventoryModules = () => [inventoryModule()]

/** Payments domain module (PaymentIntent aggregate + providers + board). */
export const paymentsModules = () => [paymentsModule()]

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
  /** Optional idempotency store. Uses InMemoryIdempotencyStore if not provided. */
  idempotency?: IdempotencyStore
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
    idempotency: opts.idempotency,
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
  /** Customers/loyalty/feedback module (defaults to installed). */
  withCustomerModules?: boolean
  /** Gift cards + promotions modules (defaults to installed). */
  withPhase4Modules?: boolean
  /** Venue registry module (defaults to installed). */
  withVenueModules?: boolean
  /** Inventory module (defaults to installed). */
  withInventoryModules?: boolean
  /** Payments module (defaults to installed). */
  withPaymentsModules?: boolean
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
  const { klog, kernelMetrics } = await import("@/kernel/observability")
  const t0 = Date.now()
  klog("info", "kernel.boot.start", { tenant: kernel.tenant })
  if (opts.withPhase2Modules !== false) {
    for (const m of phase2Modules()) await kernel.installModule(m)
  }
  if (opts.withPhase3Modules !== false) {
    for (const m of phase3Modules(opts.integrations)) await kernel.installModule(m)
  }
  if (opts.withCustomerModules !== false) {
    for (const m of customerModules()) await kernel.installModule(m)
  }
  if (opts.withPhase4Modules !== false) {
    for (const m of phase4Modules()) await kernel.installModule(m)
  }
  if (opts.withVenueModules !== false) {
    for (const m of venueModules()) await kernel.installModule(m)
  }
  if (opts.withInventoryModules !== false) {
    for (const m of inventoryModules()) await kernel.installModule(m)
  }
  if (opts.withPaymentsModules !== false) {
    for (const m of paymentsModules()) await kernel.installModule(m)
  }
  // Payment provider from env (manual | simulated-stripe | stripe-terminal).
  try {
    const { selectPaymentProviderFromEnv } = await import("@/kernel/modules/payments.module")
    selectPaymentProviderFromEnv()
  } catch {
    /* manual fallback */
  }

  // Server-section scoping: edit_own-only actors are vetoed on tickets
  // owned by another server. Registered before any write can dispatch.
  {
    const { orderSectionPolicy } = await import("@/kernel/commands/section-policy")
    kernel.commands.use(orderSectionPolicy)
  }

  const transport = resolveTransport(opts.socket)
  let bridge: SocketBridge | null = null
  if (transport) {
    bridge = new SocketBridge(transport, { routes: opts.socket?.routes })
    kernel.hooks.on("event:published", async ({ event }) => {
      if (bridge) await bridge.handle(event as never)
    })
  }

  // Inventory → menu auto-86: when stock hits zero, 86 the linked menu item
  // (convention: inventory itemId === menuItemId). Best-effort; never fails the write.

  // Recipe auto-depletion: when lines fire, consume mapped inventory.
  // Recipes are wired via `menu.setRecipe`; items without one are skipped.
  // Best-effort; never fails the fire. INSUFFICIENT_STOCK surfaces on the
  // consume command itself for the next fire (and the 86 hook follows).
  kernel.hooks.on("event:published", async ({ event }) => {
    try {
      const e = event as { eventType?: string; aggregateId?: string; payload?: Record<string, unknown> }
      if (e.eventType !== "order.sentToKitchen") return
      const lines = (e.payload?.lines as Array<{ menuItemId?: string; quantity?: number }> | undefined) ?? []
      if (!Array.isArray(lines) || lines.length === 0) return
      const { MenuItemAggregate } = await import("@/kernel/aggregates/menu.aggregate")
      const { systemActor } = await import("@/kernel/tenant/tenant")
      const actor = systemActor({ userId: "system:recipe" })
      for (const line of lines) {
        if (!line.menuItemId) continue
        const qty = Number(line.quantity ?? 1) || 1
        const item = await kernel.repository
          .read(MenuItemAggregate.TYPE, kernel.tenant, line.menuItemId)
          .catch(() => null) as { state?: { recipe?: Array<{ inventoryItemId: string; qty: number }> } } | null
        const recipe = item?.state?.recipe ?? []
        for (const r of recipe) {
          await kernel
            .execute(
              "inventory.consume",
              { itemId: r.inventoryItemId, quantity: r.qty * qty, orderId: e.aggregateId },
              actor,
            )
            .catch(() => null)
        }
      }
    } catch {
      /* recipe depletion is advisory */
    }
  })
  kernel.hooks.on("event:published", async ({ event }) => {
    try {
      const e = event as { eventType?: string; aggregateType?: string; aggregateId?: string; payload?: Record<string, unknown> }
      if (e.aggregateType !== "InventoryItem") return
      if (e.eventType !== "inventory.consumed" && e.eventType !== "inventory.wasted" && e.eventType !== "inventory.adjusted") return
      const itemId = e.aggregateId
      if (!itemId) return
      const { InventoryItemAggregate } = await import("@/kernel/aggregates/inventory.aggregate")
      const agg = await kernel.repository.read(InventoryItemAggregate.TYPE, kernel.tenant, itemId).catch(() => null) as { state?: { onHand?: number } } | null
      const onHand = Number(agg?.state?.onHand ?? NaN)
      if (!Number.isFinite(onHand) || onHand > 0) return
      const { systemActor } = await import("@/kernel/tenant/tenant")
      await kernel.execute("menu.eightySix", { itemId, reason: "out of stock (auto)" }, systemActor({ userId: "system:auto86" })).catch(() => null)
    } catch {
      /* auto-86 is advisory */
    }
  })

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

  // Durable projection checkpoints: cold boots replay from the saved
  // cursor instead of the full log. Postgres store when available, memory
  // fallback otherwise (dev / in-memory event store).
  try {
    const { PostgresCheckpointStore, MemoryCheckpointStore } = await import(
      "@/kernel/projections/checkpoint-store"
    )
    const isPg =
      (process.env.NODE_ENV === "production" || process.env.ROS_USE_PG === "1") &&
      Boolean(process.env.DATABASE_URL)
    const store = isPg
      ? new PostgresCheckpointStore((await import("@/lib/db")).sql as never)
      : new MemoryCheckpointStore()
    const saved = await store.load(kernel.tenant)
    kernel.projections.applyCheckpoints(saved)
    await kernel.projections.catchUpAll()
    kernel.projections.startAll()
    await store.save(kernel.tenant, kernel.projections.positions())
    kernel.addDisposer(() => {
      void store.save(kernel.tenant, kernel.projections.positions()).catch(() => null)
    })
  } catch {
    await kernel.boot()
  }
  kernelMetrics.recordLatency("kernel.boot", Date.now() - t0)
  klog("info", "kernel.boot.done", { ms: Date.now() - t0, modules: kernel.modules.list().length })
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
  // Added in the domain-completion pass: orders, sales and the roster each had
  // no event-sourced read model, so the screens that need them most had to fall
  // back to ad-hoc SQL over mutable tables.
  registry.register(orderBoardProjection(store, tenant))
  registry.register(salesBoardProjection(store, tenant))
  registry.register(staffBoardProjection(store, tenant))
  return registry
}

export function registerCore(kernel: Kernel): void {
  for (const h of coreCommandHandlers) kernel.commands.register(h)
  for (const h of coreQueryHandlers) kernel.queries.register(h)
}

export * from "@/kernel/types"
export { Kernel } from "@/kernel/kernel"
export { CommandBus } from "@/kernel/commands/command-bus"
export { orderSectionPolicy } from "@/kernel/commands/section-policy"
export { MemoryCheckpointStore, PostgresCheckpointStore } from "@/kernel/projections/checkpoint-store"
export type { CheckpointStore } from "@/kernel/projections/checkpoint-store"
export { InMemoryIdempotencyStore, PostgresIdempotencyStore } from "@/kernel/commands/command-bus"
export type { IdempotencyStore } from "@/kernel/commands/command-bus"
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
export { Projection, ProjectionRegistry, defineProjection, paginate, maybePaginate } from "@/kernel/projections/projection"
export type { Page, PageOptions } from "@/kernel/projections/projection"
export { assertProjectionAccess, requiredCapabilityFor, PROJECTION_CAPABILITIES } from "@/kernel/projections/projection-acl"
export { buildEvent } from "@/kernel/event-store/event-store"
export { versionConflictError } from "@/kernel/event-store/event-store"
export { AggregateRepository, defaultSnapshotPolicy } from "@/kernel/aggregates/repository"
export {
  OrderAggregate,
  TableAggregate,
  InventoryItemAggregate,
  KitchenStationAggregate,
  ReservationAggregate,
  WaitlistAggregate,
  MenuItemAggregate,
  StaffShiftAggregate,
  loadAggregate,
  saveAggregate,
  registerAggregate,
  PaymentIntentAggregate,
} from "@/kernel/aggregates"
export { newTenant, systemActor, assertTenant } from "@/kernel/tenant/tenant"
export { actorFromAuthPayload, deriveCapabilities } from "@/kernel/tenant/permission-map"
export { SocketBridge, HttpSocketTransport, RecordingSocketTransport } from "@/kernel/modules/socket-bridge"
export type { SocketTransport, SocketEmit, SocketBridgeOptions, EventRoute } from "@/kernel/modules/socket-bridge"
export { reservationsModule } from "@/kernel/modules/reservations.module"
export { giftCardsModule } from "@/kernel/modules/gift-cards.module"
export type { GiftCardRow, GiftCardsBoardState } from "@/kernel/modules/gift-cards.module"
export { promotionsModule } from "@/kernel/modules/promotions.module"
export type { PromotionRow, PromotionsBoardState } from "@/kernel/modules/promotions.module"
export { waitlistModule } from "@/kernel/modules/waitlist.module"
export { menuModule, noSoldItems86dPolicy } from "@/kernel/modules/menu.module"
export { staffModule } from "@/kernel/modules/staff.module"
export { venuesModule } from "@/kernel/modules/venues.module"
export type { VenueBoardRow, VenuesBoardState } from "@/kernel/modules/venues.module"
export { staffBoardProjection } from "@/kernel/projections/staff-board"
export type { StaffRow, StaffBoardState } from "@/kernel/projections/staff-board"
export { orderBoardProjection, listOrdersBoard } from "@/kernel/projections/orders-board"
export type { OrderBoardRow, OrderBoardLine, OrderBoardState } from "@/kernel/projections/orders-board"
export { salesBoardProjection } from "@/kernel/projections/sales-board"
export type { SalesBucket, SalesBoardState } from "@/kernel/projections/sales-board"
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

// ---- Kernel P0: money, observability, inventory, payments ----
export { toCents, fromCents, round2, addCents, mulCents, percentCents } from "@/kernel/money"
export { traceId, klog, Metrics, kernelMetrics } from "@/kernel/observability"
export type { KLogLevel } from "@/kernel/observability"
export { inventoryModule, inventoryBoardProjection } from "@/kernel/modules/inventory.module"
export type { InventoryBoardState } from "@/kernel/modules/inventory.module"
export {
  paymentsModule,
  paymentsBoardProjection,
  ManualProvider,
  SimulatedStripeProvider,
  setPaymentProvider,
  getPaymentProvider,
} from "@/kernel/modules/payments.module"
export type { PaymentProvider, PaymentBoardRow, PaymentsBoardState } from "@/kernel/modules/payments.module"
export type { PaymentState as PaymentIntentState, PaymentStatus } from "@/kernel/aggregates/payment.aggregate"
