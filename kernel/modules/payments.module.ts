import { randomUUID } from "crypto"
import { z } from "zod"
import { AttributeBag, kernelError, StoredEvent } from "@/kernel/types"
import { defineCommand } from "@/kernel/commands/define-command"
import { QueryHandler } from "@/kernel/queries/query-bus"
import { PaymentIntentAggregate } from "@/kernel/aggregates/payment.aggregate"
import { RosModule, ModuleRuntime } from "@/kernel/modules/module-registry"
import { defineProjection, Projection } from "@/kernel/projections/projection"

export interface PaymentProvider {
  name: string
  authorize(input: { paymentId: string; orderId: string; amount: number; method: string }): Promise<{ ok: boolean; gatewayRef?: string }>
  capture(input: { paymentId: string; amount: number }): Promise<{ ok: boolean }>
  refund(input: { paymentId: string; amount: number }): Promise<{ ok: boolean }>
}

export class ManualProvider implements PaymentProvider {
  name = "manual"
  async authorize(): Promise<{ ok: boolean }> {
    return { ok: true }
  }
  async capture(): Promise<{ ok: boolean }> {
    return { ok: true }
  }
  async refund(): Promise<{ ok: boolean }> {
    return { ok: true }
  }
}

export class SimulatedStripeProvider implements PaymentProvider {
  name = "simulated-stripe"
  async authorize(input: { paymentId: string }): Promise<{ ok: boolean; gatewayRef: string }> {
    return { ok: true, gatewayRef: `pi_sim_${input.paymentId.slice(0, 8)}` }
  }
  async capture(): Promise<{ ok: boolean }> {
    return { ok: true }
  }
  async refund(): Promise<{ ok: boolean }> {
    return { ok: true }
  }
}

let activeProvider: PaymentProvider = new ManualProvider()

export function setPaymentProvider(p: PaymentProvider): void {
  activeProvider = p
}

export function getPaymentProvider(): PaymentProvider {
  return activeProvider
}

/**
 * Select the provider from ROS_PAYMENT_PROVIDER (manual | simulated-stripe |
 * stripe-terminal). Stripe-terminal requires STRIPE_SECRET_KEY; if the key is
 * missing at call time we stay on manual rather than failing the boot.
 */
export function selectPaymentProviderFromEnv(): PaymentProvider {
  const raw = (process.env.ROS_PAYMENT_PROVIDER ?? "manual").toLowerCase()
  if (raw === "sim" || raw === "simulated-stripe" || raw === "simulated") {
    activeProvider = new SimulatedStripeProvider()
  } else if ((raw === "stripe" || raw === "stripe-terminal") && process.env.STRIPE_SECRET_KEY) {
    try {
      // Lazy to avoid hard dep at import time.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mod = require("@/kernel/integrations/stripe-terminal.connector") as {
        StripeTerminalProvider: new () => PaymentProvider
      }
      activeProvider = new mod.StripeTerminalProvider()
    } catch {
      activeProvider = new ManualProvider()
    }
  } else {
    activeProvider = new ManualProvider()
  }
  return activeProvider
}

// ---- commands ----

const authorizeSchema = z.object({
  paymentId: z.string().min(1).optional(),
  orderId: z.string().min(1),
  amount: z.number().positive(),
  method: z.string().min(1),
  gateway: z.string().min(1).optional(),
}).passthrough()

const authorize = defineCommand({
  commandType: "payment.authorize",
  requiredPermission: "order:pay",
  schema: authorizeSchema,
  async execute(ctx) {
    const id = (ctx.payload.paymentId as string) ?? randomUUID()
    const orderId = String(ctx.payload.orderId)
    const amount = Number(ctx.payload.amount)
    const method = String(ctx.payload.method)
    const gateway = ctx.payload.gateway ? String(ctx.payload.gateway) : activeProvider.name
    const res = await activeProvider.authorize({
      paymentId: id,
      orderId,
      amount,
      method,
      ...(ctx.payload.paymentMethodId ? { paymentMethodId: String(ctx.payload.paymentMethodId) } : {}),
    } as { paymentId: string; orderId: string; amount: number; method: string })
    if (!res.ok) throw kernelError("PAYMENT_DECLINED", "Provider declined authorization")
    const agg = PaymentIntentAggregate.authorize(ctx.tenant, { id, orderId, amount, method, gateway, gatewayRef: res.gatewayRef, actor: ctx.actor })
    await ctx.commit(agg)
    return id
  },
})

const capture = defineCommand({
  commandType: "payment.capture",
  requiredPermission: "order:pay",
  schema: z.object({ paymentId: z.string().min(1) }).passthrough(),
  async execute(ctx) {
    const id = String(ctx.payload.paymentId)
    const agg = await ctx.load<PaymentIntentAggregate>(PaymentIntentAggregate.TYPE, id)
    const res = await activeProvider.capture({ paymentId: id, amount: agg.state.amount, gatewayRef: agg.state.gatewayRef } as { paymentId: string; amount: number })
    if (!res.ok) throw kernelError("PAYMENT_CAPTURE_FAILED", "Provider capture failed")
    agg.capture(ctx.actor)
    await ctx.commit(agg)
    return id
  },
})

const refund = defineCommand({
  commandType: "payment.refund",
  requiredPermission: "order:pay",
  schema: z.object({ paymentId: z.string().min(1), amount: z.number().positive().optional() }).passthrough(),
  async execute(ctx) {
    const id = String(ctx.payload.paymentId)
    const agg = await ctx.load<PaymentIntentAggregate>(PaymentIntentAggregate.TYPE, id)
    const amount = ctx.payload.amount != null ? Number(ctx.payload.amount) : undefined
    const res = await activeProvider.refund({ paymentId: id, amount: amount ?? agg.state.capturedAmount - agg.state.refundedAmount, gatewayRef: agg.state.gatewayRef } as { paymentId: string; amount: number })
    if (!res.ok) throw kernelError("PAYMENT_REFUND_FAILED", "Provider refund failed")
    agg.refund(ctx.actor, amount)
    await ctx.commit(agg)
    return id
  },
})

const voidAuth = defineCommand({
  commandType: "payment.voidAuth",
  requiredPermission: "order:pay",
  schema: z.object({ paymentId: z.string().min(1), reason: z.string().min(1).optional() }).passthrough(),
  async execute(ctx) {
    const id = String(ctx.payload.paymentId)
    const agg = await ctx.load<PaymentIntentAggregate>(PaymentIntentAggregate.TYPE, id)
    agg.voidAuth(ctx.actor, ctx.payload.reason ? String(ctx.payload.reason) : "voided")
    await ctx.commit(agg)
    return id
  },
})

// ---- projection ----

export interface PaymentBoardRow {
  paymentId: string
  orderId: string
  amount: number
  capturedAmount: number
  refundedAmount: number
  method: string
  gateway: string
  status: string
  updatedAt: string
}

export interface PaymentsBoardState extends AttributeBag {
  rows: PaymentBoardRow[]
}

export function paymentsBoardProjection(
  store: ModuleRuntime["events"],
  tenant: ModuleRuntime["tenant"],
): Projection<PaymentsBoardState> {
  return defineProjection<PaymentsBoardState>(
    {
      name: "payments.board",
      initial: { rows: [] },
      watchedEventTypes: ["payment.authorized", "payment.captured", "payment.refunded", "payment.voided"],
      reduce: (state, event: StoredEvent): PaymentsBoardState => {
        const rows = [...state.rows]
        const idx = rows.findIndex((r) => r.paymentId === event.aggregateId)
        const p = event.payload as Record<string, unknown>
        const base: PaymentBoardRow =
          idx >= 0
            ? rows[idx]
            : {
                paymentId: event.aggregateId,
                orderId: "",
                amount: 0,
                capturedAmount: 0,
                refundedAmount: 0,
                method: "",
                gateway: "manual",
                status: "authorized",
                updatedAt: event.occurredAt,
              }
        const next = { ...base, updatedAt: event.occurredAt }
        switch (event.eventType) {
          case "payment.authorized":
            next.orderId = String(p.orderId ?? "")
            next.amount = Number(p.amount ?? 0)
            next.method = String(p.method ?? "")
            next.gateway = String(p.gateway ?? "manual")
            next.status = "authorized"
            break
          case "payment.captured":
            next.capturedAmount = Number(p.amount ?? next.amount)
            next.status = "captured"
            break
          case "payment.refunded":
            next.refundedAmount += Number(p.amount ?? 0)
            next.status = next.refundedAmount + 1e-9 >= next.capturedAmount ? "refunded" : "partially_refunded"
            break
          case "payment.voided":
            next.status = "voided"
            break
        }
        if (idx >= 0) rows[idx] = next
        else rows.push(next)
        return { rows }
      },
    },
    store,
    tenant,
  )
}

function paginate<T>(rows: T[], params: { limit?: unknown; cursor?: unknown }): T[] {
  const limit = params.limit != null ? Math.min(Math.max(Number(params.limit) || 50, 1), 500) : 50
  const cursor = params.cursor != null ? Number(params.cursor) || 0 : 0
  return rows.slice(cursor, cursor + limit)
}

const listPayments: QueryHandler = {
  queryType: "list.payments",
  requiredPermission: "order:view",
  async handle(params, ctx) {
    const rows = ctx.projections.get<PaymentsBoardState>("payments.board").state.rows
    return paginate(rows, params as { limit?: unknown; cursor?: unknown })
  },
}

const getPayment: QueryHandler = {
  queryType: "get.payment",
  requiredPermission: "order:view",
  async handle(params, ctx) {
    const agg = await ctx.repository.load<PaymentIntentAggregate>(
      PaymentIntentAggregate.TYPE,
      ctx.tenant,
      String((params as Record<string, unknown>).paymentId),
    )
    return { id: agg.id, version: agg.version, state: agg.state }
  },
}

/**
 * Which card provider is live (manual | simulated-stripe | stripe-terminal).
 * Surfaced so the checkout screen can say so honestly instead of implying
 * real card processing when there is none.
 */
const getPaymentProviderInfo: QueryHandler = {
  queryType: "get.paymentProvider",
  requiredPermission: "order:view",
  async handle() {
    const name = activeProvider.name
    return {
      provider: name,
      liveCards: name === "stripe-terminal",
      hint:
        name === "stripe-terminal"
          ? "Card terminal connected — follow the reader prompts."
          : name === "simulated-stripe"
            ? "SIMULATED cards — no money moves. Flip ROS_PAYMENT_PROVIDER for the real terminal."
            : "Manual cards — record the slip/reference; no gateway is connected.",
    }
  },
}

export function paymentsModule(): RosModule {
  return {
    id: "ros.payments",
    name: "Payments",
    version: "1.0.0",
    capabilities: {
      commands: ["payment.authorize", "payment.capture", "payment.refund", "payment.voidAuth"],
      queries: ["list.payments", "get.payment", "get.paymentProvider"],
      eventTypes: ["payment.authorized", "payment.captured", "payment.refunded", "payment.voided"],
    },
    lifecycle: {
      async install(runtime: ModuleRuntime) {
        runtime.projections.register(paymentsBoardProjection(runtime.events, runtime.tenant))
      },
      async activate(runtime: ModuleRuntime) {
        runtime.commands.register(authorize)
        runtime.commands.register(capture)
        runtime.commands.register(refund)
        runtime.commands.register(voidAuth)
        runtime.queries.register(listPayments)
        runtime.queries.register(getPayment)
        runtime.queries.register(getPaymentProviderInfo)
      },
    },
  }
}
