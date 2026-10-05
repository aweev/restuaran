import { randomUUID } from "crypto"
import { AttributeBag, kernelError, StoredEvent } from "@/kernel/types"
import { defineCommand } from "@/kernel/commands/define-command"
import { QueryHandler } from "@/kernel/queries/query-bus"
import {
  WebhookEndpointAggregate,
} from "@/kernel/integrations/webhook-endpoint.aggregate"
import {
  DELIVERY_HEADER,
  HttpWebhookTransport,
  WebhookEndpointView,
  webhookDeliveriesFor,
} from "@/kernel/integrations/webhooks"
import { ConnectorRegistry } from "@/kernel/integrations/connectors"
import { accountingConnector } from "@/kernel/integrations/accounting.connector"
import { deliveryConnector } from "@/kernel/integrations/delivery.connector"
import type { IntegrationFabric } from "@/kernel/integrations/fabric"
import {
  LoggingOutboundTransport,
  OutboundQueue,
  OutboundTransport,
  RetryPolicy,
} from "@/kernel/integrations/outbound-queue"
import { RosModule, ModuleRuntime } from "@/kernel/modules/module-registry"
import { defineProjection, Projection, maybePaginate } from "@/kernel/projections/projection"
import { registerAggregate } from "@/kernel/aggregates/registry"

export interface IntegrationsModuleOptions {
  /** Defaults to HttpWebhookTransport (real fetch POSTs). */
  webhookTransport?: OutboundTransport
  /** Defaults to LoggingOutboundTransport so queues always drain in dev. */
  connectorTransport?: OutboundTransport
  retry?: Partial<RetryPolicy>
  now?: () => number
  /** Drain queues automatically (immediately after fanout + interval sweep). Default false — opt in per deployment. */
  autoProcess?: boolean
  processIntervalMs?: number
  /** Skip registering the accounting + delivery connectors (webhooks only). */
  withConnectors?: boolean
}

export interface WebhooksEndpointsState extends AttributeBag {
  endpoints: WebhookEndpointView[]
}

export function webhooksEndpointsProjection(
  store: ModuleRuntime["events"],
  tenant: ModuleRuntime["tenant"]
): Projection<WebhooksEndpointsState> {
  return defineProjection<WebhooksEndpointsState>(
    {
      name: "webhooks.endpoints",
      initial: { endpoints: [] },
      watchedEventTypes: ["webhook.subscribed", "webhook.updated", "webhook.unsubscribed"],
      reduce: (state, event): WebhooksEndpointsState => {
        const endpoints = [...state.endpoints]
        const idx = endpoints.findIndex((e) => e.id === event.aggregateId)
        const p = event.payload as Record<string, unknown>
        if (event.eventType === "webhook.unsubscribed") {
          if (idx >= 0) {
            endpoints[idx] = { ...endpoints[idx], active: false, updatedAt: event.occurredAt }
          }
          return { endpoints }
        }
        const base: WebhookEndpointView =
          idx >= 0
            ? endpoints[idx]
            : {
              id: event.aggregateId,
              url: "",
              secret: "",
              eventTypes: [],
              active: false,
              createdAt: event.occurredAt,
              updatedAt: event.occurredAt,
            }
        const next: WebhookEndpointView = { ...base }
        if (event.eventType === "webhook.subscribed") {
          next.url = String(p.url ?? "")
          next.secret = String(p.secret ?? "")
          next.eventTypes = (p.eventTypes as string[]) ?? []
          next.active = true
          next.createdAt = String(p.subscribedAt ?? event.occurredAt)
        } else if (event.eventType === "webhook.updated") {
          if (p.url !== undefined) next.url = String(p.url)
          if (p.secret !== undefined) next.secret = String(p.secret)
          if (p.eventTypes !== undefined) next.eventTypes = (p.eventTypes as string[]) ?? []
        }
        next.updatedAt = event.occurredAt
        if (idx >= 0) endpoints[idx] = next
        else endpoints.push(next)
        endpoints.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        return { endpoints }
      },
    },
    store,
    tenant
  )
}

export function integrationsModule(opts: IntegrationsModuleOptions = {}): RosModule {
  const registry = new ConnectorRegistry()
  if (opts.withConnectors !== false) {
    registry.register(accountingConnector())
    registry.register(deliveryConnector())
  }

  const webhooks = new OutboundQueue({
    transport: opts.webhookTransport ?? new HttpWebhookTransport(),
    retry: opts.retry,
    now: opts.now,
  })
  const connectors = new OutboundQueue({
    transport: opts.connectorTransport ?? new LoggingOutboundTransport(),
    retry: opts.retry,
    now: opts.now,
  })
  const fabric: IntegrationFabric = { webhooks, connectors, registry }

  let activeRuntime: ModuleRuntime | null = null
  let offHook: (() => void) | null = null
  let sweepTimer: ReturnType<typeof setInterval> | null = null

  const drain = (queue: OutboundQueue): void => {
    void queue.process().catch((err) => {
      console.error("[kernel:integrations] outbound process failed:", err)
    })
  }

  /**
   * event:published fanout: webhooks (per subscribed endpoint) + connectors
   * (per registered connector). Enqueue only — delivery happens on process().
   */
  const fanout = (event: StoredEvent): void => {
    if (!activeRuntime) return
    const { endpoints } = activeRuntime.projections.get<WebhooksEndpointsState>("webhooks.endpoints")
      .state
    for (const input of webhookDeliveriesFor(event, endpoints)) {
      const message = webhooks.enqueue(input)
      message.headers[DELIVERY_HEADER] = message.id
    }
    for (const input of registry.fanout(event)) {
      const message = connectors.enqueue(input)
      message.headers[DELIVERY_HEADER] = message.id
    }
    if (opts.autoProcess) {
      if (webhooks.stats().pending > 0) drain(webhooks)
      if (connectors.stats().pending > 0) drain(connectors)
    }
  }

  const subscribe = defineCommand({
    commandType: "webhook.subscribe",
    requiredPermission: "integration:manage",
    async execute(ctx) {
      const { payload } = ctx
      const agg = WebhookEndpointAggregate.create(ctx.tenant, {
        id: String(payload.endpointId ?? randomUUID()),
        url: String(payload.url ?? ""),
        secret: payload.secret !== undefined ? String(payload.secret) : undefined,
        eventTypes: Array.isArray(payload.eventTypes)
          ? (payload.eventTypes as string[])
          : undefined,
        actor: ctx.actor,
      })
      await ctx.commit(agg)
      return agg.id
    },
  })

  const update = defineCommand({
    commandType: "webhook.update",
    requiredPermission: "integration:manage",
    async execute(ctx) {
      const endpointId = String(ctx.payload.endpointId ?? "")
      if (!endpointId) throw kernelError("INVALID_WEBHOOK_ENDPOINT", "endpointId is required")
      const agg = await ctx.load<WebhookEndpointAggregate>(WebhookEndpointAggregate.TYPE, endpointId)
      agg.update(ctx.actor, {
        url: ctx.payload.url !== undefined ? String(ctx.payload.url) : undefined,
        eventTypes: Array.isArray(ctx.payload.eventTypes)
          ? (ctx.payload.eventTypes as string[])
          : undefined,
        secret: ctx.payload.secret !== undefined ? String(ctx.payload.secret) : undefined,
      })
      await ctx.commit(agg)
      return agg.id
    },
  })

  const unsubscribe = defineCommand({
    commandType: "webhook.unsubscribe",
    requiredPermission: "integration:manage",
    async execute(ctx) {
      const endpointId = String(ctx.payload.endpointId ?? "")
      if (!endpointId) throw kernelError("INVALID_WEBHOOK_ENDPOINT", "endpointId is required")
      const agg = await ctx.load<WebhookEndpointAggregate>(WebhookEndpointAggregate.TYPE, endpointId)
      agg.unsubscribe(ctx.actor)
      await ctx.commit(agg)
      return agg.id
    },
  })

  const replay = defineCommand({
    commandType: "outbound.replay",
    requiredPermission: "integration:manage",
    async execute(ctx) {
      const deliveryId = String(ctx.payload.deliveryId ?? "")
      if (!deliveryId) throw kernelError("INVALID_DELIVERY", "deliveryId is required")
      const message = webhooks.get(deliveryId) ?? connectors.get(deliveryId)
      if (!message) {
        throw kernelError("DELIVERY_NOT_FOUND", `No outbound delivery "${deliveryId}"`)
      }
      const queue = message.channel === "webhook" ? webhooks : connectors
      const replayed = queue.replay(deliveryId)
      if (!replayed) {
        throw kernelError(
          "INVALID_DELIVERY_STATE",
          `Delivery ${deliveryId} is ${message.status}; only dead deliveries can be replayed`
        )
      }
      if (opts.autoProcess) drain(queue)
      return deliveryId
    },
  })

  const listWebhooks: QueryHandler = {
    queryType: "list.webhooks",
    requiredPermission: "integration:view",
    async handle(params, ctx) {
      const rows = ctx.projections
        .get<WebhooksEndpointsState>("webhooks.endpoints")
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
        }))
      return maybePaginate(rows, params)
    },
  }

  const listOutbound: QueryHandler = {
    queryType: "list.outbound",
    requiredPermission: "integration:view",
    async handle(params) {
      const status = params.status ? String(params.status) : undefined
      const channel = params.channel ? String(params.channel) : undefined
      let rows = [...webhooks.list(), ...connectors.list()]
      if (status) rows = rows.filter((m) => m.status === status)
      if (channel) rows = rows.filter((m) => m.channel === channel)
      rows.sort((a, b) => b.createdAt - a.createdAt || b.position - a.position)
      if (params.limit == null && params.cursor == null) return rows.slice(0, 200)
      return maybePaginate(rows, params)
    },
  }

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
      async install(runtime: ModuleRuntime) {
        registerAggregate(WebhookEndpointAggregate.TYPE, WebhookEndpointAggregate)
        runtime.projections.register(webhooksEndpointsProjection(runtime.events, runtime.tenant))
      },
      async activate(runtime: ModuleRuntime) {
        activeRuntime = runtime
        offHook = runtime.hooks.on("event:published", ({ event }) => fanout(event as StoredEvent))
        runtime.commands.register(subscribe)
        runtime.commands.register(update)
        runtime.commands.register(unsubscribe)
        runtime.commands.register(replay)
        runtime.queries.register(listWebhooks)
        runtime.queries.register(listOutbound)
        runtime.kernel.integrations = fabric
        if (opts.autoProcess) {
          sweepTimer = setInterval(() => {
            drain(webhooks)
            drain(connectors)
          }, opts.processIntervalMs ?? 2000)
            ; (sweepTimer as unknown as { unref?: () => void }).unref?.()
        }
      },
      async deactivate(runtime: ModuleRuntime) {
        offHook?.()
        offHook = null
        if (sweepTimer) clearInterval(sweepTimer)
        sweepTimer = null
        activeRuntime = null
        runtime.kernel.integrations = undefined
      },
    },
  }
}
