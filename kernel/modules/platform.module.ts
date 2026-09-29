import { randomUUID } from "crypto"
import { ActorContext, AttributeBag, CommandResult, kernelError } from "@/kernel/types"
import { defineCommand } from "@/kernel/commands/define-command"
import { QueryHandler } from "@/kernel/queries/query-bus"
import { CommandBus } from "@/kernel/commands/command-bus"
import { PlatformOrderAggregate, platformOrderId } from "@/kernel/aggregates"
import { RosModule, ModuleRuntime } from "@/kernel/modules/module-registry"
import { defineProjection, Projection } from "@/kernel/projections/projection"
import { systemActor } from "@/kernel/tenant/tenant"

export interface PlatformOrderRow {
  id: string
  platform: string
  externalOrderId: string
  orderId: string | null
  status: string
  fulfillment: string
  customerName: string | null
  itemsSubtotal: number
  itemCount: number
  receivedAt: string
}

export interface PlatformOrdersState extends AttributeBag {
  rows: PlatformOrderRow[]
}

export function platformOrdersProjection(
  store: ModuleRuntime["events"],
  tenant: ModuleRuntime["tenant"]
): Projection<PlatformOrdersState> {
  return defineProjection<PlatformOrdersState>(
    {
      name: "platform.orders",
      initial: { rows: [] },
      watchedEventTypes: [
        "platform.orderReceived",
        "platform.orderCancelled",
        "platform.orderCompleted",
      ],
      reduce: (state, event): PlatformOrdersState => {
        const rows = [...state.rows]
        const idx = rows.findIndex((r) => r.id === event.aggregateId)
        const p = event.payload as Record<string, unknown>
        const base: PlatformOrderRow =
          idx >= 0
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
            }
        const next: PlatformOrderRow = { ...base }
        if (event.eventType === "platform.orderReceived") {
          next.platform = String(p.platform ?? "")
          next.externalOrderId = String(p.externalOrderId ?? "")
          next.orderId = (p.orderId as string) ?? null
          next.fulfillment = String(p.fulfillment ?? "delivery")
          next.customerName = (p.customerName as string) ?? null
          next.itemsSubtotal = Number(p.itemsSubtotal ?? 0)
          next.itemCount = Number(p.itemCount ?? 0)
          next.receivedAt = String(p.receivedAt ?? event.occurredAt)
          next.status = "received"
        } else if (event.eventType === "platform.orderCancelled") {
          next.status = "cancelled"
        } else if (event.eventType === "platform.orderCompleted") {
          next.status = "completed"
        }
        if (idx >= 0) rows[idx] = next
        else rows.push(next)
        rows.sort((a, b) => a.receivedAt.localeCompare(b.receivedAt))
        return { rows }
      },
    },
    store,
    tenant
  )
}

/** The integration identity an external platform acts as when it drives the POS. */
function platformActor(platform: string): ActorContext {
  return systemActor({ userId: `platform:${platform}`, roles: ["integration"] })
}

export function platformModule(): RosModule {
  // Captured at activate: ingest drives the *core* command bus so permission
  // gates and cross-module policies (e.g. the menu 86 veto) apply to injected
  // marketplace orders exactly as they do to POS orders.
  let bus: CommandBus | null = null

  const runOrFail = async (
    cmdBus: CommandBus,
    tenant: ModuleRuntime["tenant"],
    actor: ActorContext,
    commandType: string,
    payload: AttributeBag
  ): Promise<CommandResult> => cmdBus.dispatch(commandType, payload, { tenant, actor })

  const ingest = defineCommand({
    commandType: "platform.ingestOrder",
    requiredPermission: "order:create",
    async execute(ctx) {
      const { payload } = ctx
      const platform = String(payload.platform ?? "").trim()
      const externalOrderId = String(payload.externalOrderId ?? "").trim()
      if (!platform) throw kernelError("INVALID_PLATFORM_ORDER", "platform is required")
      if (!externalOrderId) throw kernelError("INVALID_PLATFORM_ORDER", "externalOrderId is required")

      // Deterministic id doubles as the idempotency key: a retried webhook or
      // replayed marketplace push maps onto the same stream and no-ops.
      const id = platformOrderId(platform, externalOrderId)
      const existing = await ctx.repository.read<PlatformOrderAggregate>(
        PlatformOrderAggregate.TYPE,
        ctx.tenant,
        id
      )
      if (existing.exists) return existing.id

      const items = Array.isArray(payload.items) ? (payload.items as AttributeBag[]) : []
      if (items.length === 0) {
        throw kernelError("PLATFORM_ORDER_EMPTY", "An ingest order needs at least one item")
      }
      if (!bus) throw kernelError("PLATFORM_MODULE_NOT_READY", "Command bus unavailable")

      const cmdBus = bus
      const actor = platformActor(platform)
      const customer = (payload.customer ?? {}) as AttributeBag
      const customerName = customer.name ? String(customer.name) : undefined
      const orderId = randomUUID()

      const abort = async (code: string, message: string, details?: AttributeBag): Promise<never> => {
        // Nothing partially lands: the created order is voided before failing.
        await runOrFail(cmdBus, ctx.tenant, actor, "order.void", {
          orderId,
          reason: `platform ingest rejected: ${code}`,
        }).catch(() => undefined)
        throw kernelError(code, message, { ...details, orderId })
      }

      const created = await runOrFail(cmdBus, ctx.tenant, actor, "order.create", {
        orderId,
        channel: "platform",
        customerId: payload.customerId ? String(payload.customerId) : undefined,
        dinerName: customerName,
      })
      if (!created.success) {
        // No order exists yet — fail without the void dance.
        throw kernelError(created.error.code, created.error.message, { ...created.error.details, orderId })
      }

      let subtotal = 0
      for (const [i, raw] of items.entries()) {
        const item = (raw ?? {}) as AttributeBag
        const unitPrice = Number(item.unitPrice)
        const quantity = Number(item.quantity ?? 1)
        const name = String(item.name ?? "")
        if (!name) await abort("INVALID_PLATFORM_ITEM", `items[${i}].name is required`)
        if (!Number.isFinite(unitPrice) || unitPrice < 0) {
          await abort("INVALID_PLATFORM_ITEM", `items[${i}].unitPrice must be a non-negative number`)
        }
        if (!Number.isInteger(quantity) || quantity <= 0) {
          await abort("INVALID_PLATFORM_ITEM", `items[${i}].quantity must be a positive integer`)
        }
        subtotal += unitPrice * quantity

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
        })
        if (!line.success) {
          await abort(line.error.code, line.error.message, {
            ...line.error.details,
            menuItemId: item.menuItemId,
          })
        }
      }

      if (payload.sendToKitchen !== false) {
        const sent = await runOrFail(cmdBus, ctx.tenant, actor, "order.sendToKitchen", { orderId })
        if (!sent.success) await abort(sent.error.code, sent.error.message, sent.error.details)
      }

      const agg = PlatformOrderAggregate.create(ctx.tenant, {
        id,
        platform,
        externalOrderId,
        orderId,
        fulfillment: payload.fulfillment === "pickup" ? "pickup" : "delivery",
        customerName: customerName ?? null,
        itemsSubtotal: subtotal,
        itemCount: items.length,
        actor: ctx.actor,
      })
      await ctx.commit(agg)
      // Always the platform order id — identical to the idempotent dedupe path,
      // so retried ingests return the same aggregateId. The POS order id is on
      // the committed event (payload.orderId) and via get.platformOrder.
      return agg.id
    },
  })

  const cancel = defineCommand({
    commandType: "platform.cancelOrder",
    requiredPermission: "order:edit",
    async execute(ctx) {
      const id = String(ctx.payload.platformOrderId ?? "")
      if (!id) throw kernelError("INVALID_PLATFORM_ORDER", "platformOrderId is required")
      const agg = await ctx.load<PlatformOrderAggregate>(PlatformOrderAggregate.TYPE, id)
      if (agg.state.status !== "received") {
        throw kernelError("PLATFORM_ORDER_TERMINAL", `Platform order is ${agg.state.status}`)
      }
      if (!bus) throw kernelError("PLATFORM_MODULE_NOT_READY", "Command bus unavailable")
      const reason = String(ctx.payload.reason ?? "cancelled by platform")

      // Void the POS order first — a closed order means the cancellation
      // arrived too late, and the whole command must fail atomically.
      if (agg.state.orderId) {
        const result = await runOrFail(bus, ctx.tenant, platformActor(agg.state.platform), "order.void", {
          orderId: agg.state.orderId,
          reason,
        })
        if (!result.success) {
          throw kernelError(result.error.code, result.error.message, {
            ...result.error.details,
            orderId: agg.state.orderId,
          })
        }
      }
      agg.cancel(ctx.actor, reason)
      await ctx.commit(agg)
      return agg.id
    },
  })

  const complete = defineCommand({
    commandType: "platform.completeOrder",
    requiredPermission: "order:process",
    async execute(ctx) {
      const id = String(ctx.payload.platformOrderId ?? "")
      if (!id) throw kernelError("INVALID_PLATFORM_ORDER", "platformOrderId is required")
      const agg = await ctx.load<PlatformOrderAggregate>(PlatformOrderAggregate.TYPE, id)
      agg.complete(ctx.actor)
      await ctx.commit(agg)
      return agg.id
    },
  })

  const getPlatformOrder: QueryHandler = {
    queryType: "get.platformOrder",
    requiredPermission: "order:view",
    async handle(params, ctx) {
      const agg = await ctx.repository.load<PlatformOrderAggregate>(
        PlatformOrderAggregate.TYPE,
        ctx.tenant,
        String(params.platformOrderId)
      )
      return { id: agg.id, version: agg.version, state: agg.state }
    },
  }

  const listPlatformOrders: QueryHandler = {
    queryType: "list.platformOrders",
    requiredPermission: "order:view",
    async handle(params, ctx) {
      const rows = ctx.projections.get<PlatformOrdersState>("platform.orders").state.rows
      const status = params.status ? String(params.status) : null
      return status ? rows.filter((r) => r.status === status) : rows
    },
  }

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
      async install(runtime: ModuleRuntime) {
        runtime.projections.register(platformOrdersProjection(runtime.events, runtime.tenant))
      },
      async activate(runtime: ModuleRuntime) {
        bus = runtime.commands
        runtime.commands.register(ingest)
        runtime.commands.register(cancel)
        runtime.commands.register(complete)
        runtime.queries.register(getPlatformOrder)
        runtime.queries.register(listPlatformOrders)
      },
      async deactivate() {
        bus = null
      },
    },
  }
}