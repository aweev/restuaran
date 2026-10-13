import { randomUUID } from "crypto"
import { kernelError } from "@/kernel/types"
import { defineCommand } from "@/kernel/commands/define-command"
import { CashDrawerAggregate } from "@/kernel/aggregates/cash-drawer.aggregate"
import { registerAggregate } from "@/kernel/aggregates/registry"
import { RosModule, ModuleRuntime } from "@/kernel/modules/module-registry"
import { systemActor } from "@/kernel/tenant/tenant"

/**
 * Cash-drawer sessions as first-class kernel state.
 *
 * Replaces the localStorage-only drawer (`context/CashDrawerContext.tsx`):
 * expected/variance are computed server-side from the event stream, close is
 * immutable, and every cash payment auto-notes a sale so the drawer agrees
 * with the order ledger. Stale auto-close fabrication is gone: opening while
 * one is open is rejected with the current session id.
 */

const openDrawer = defineCommand({
  commandType: "cash.open",
  requiredPermission: "order:pay",
  async execute(ctx) {
    const current = ctx.projections.get<{ currentId: string | null }>("cash.board")
    if (current.state.currentId) {
      throw kernelError("SESSION_ALREADY_OPEN", `Drawer ${current.state.currentId} is already open — close it first`)
    }
    const id = (ctx.payload.sessionId as string) ?? randomUUID()
    const existing = await ctx.loadOrEmpty<CashDrawerAggregate>(CashDrawerAggregate.TYPE, id)
    if (existing.exists) throw kernelError("SESSION_EXISTS", `Cash session ${id} already exists`)
    const agg = CashDrawerAggregate.open(ctx.tenant, {
      id,
      startingFloat: Number(ctx.payload.startingFloat ?? 0),
      openedBy: ctx.actor.userId ?? null,
      actor: ctx.actor,
    })
    await ctx.commit(agg)
    return id
  },
})

const payout = defineCommand({
  commandType: "cash.payout",
  requiredPermission: "order:pay",
  async execute(ctx) {
    const id = String(ctx.payload.sessionId ?? "")
    if (!id) throw kernelError("INVALID_PAYOUT", "sessionId is required")
    const agg = await ctx.load<CashDrawerAggregate>(CashDrawerAggregate.TYPE, id)
    agg.payout(ctx.actor, Number(ctx.payload.amount ?? NaN), String(ctx.payload.reason ?? ""))
    await ctx.commit(agg)
    return id
  },
})

const noteSale = defineCommand({
  commandType: "cash.noteSale",
  requiredPermission: "order:pay",
  async execute(ctx) {
    const sessionId = String(ctx.payload.sessionId ?? "")
    const paymentId = String(ctx.payload.paymentId ?? "")
    if (!sessionId || !paymentId) throw kernelError("INVALID_SALE", "sessionId and paymentId are required")
    const agg = await ctx.load<CashDrawerAggregate>(CashDrawerAggregate.TYPE, sessionId)
    agg.noteSale(ctx.actor, paymentId, Number(ctx.payload.amount ?? NaN))
    await ctx.commit(agg)
    return sessionId
  },
})

const closeDrawer = defineCommand({
  commandType: "cash.close",
  requiredPermission: "order:pay",
  async execute(ctx) {
    const id = String(ctx.payload.sessionId ?? "")
    if (!id) throw kernelError("INVALID_CLOSE", "sessionId is required")
    const agg = await ctx.load<CashDrawerAggregate>(CashDrawerAggregate.TYPE, id)
    // Expected is derived from the stream — never accepted from the client.
    const { expected, variance } = agg.close(
      ctx.actor,
      Number(ctx.payload.countedCash ?? NaN),
      ctx.payload.varianceReason ? String(ctx.payload.varianceReason) : undefined,
    )
    await ctx.commit(agg)
    return id
  },
})

export function cashModule(): RosModule {
  return {
    id: "ros.cash",
    name: "Cash Drawer Sessions",
    version: "1.0.0",
    capabilities: {
      commands: ["cash.open", "cash.payout", "cash.noteSale", "cash.close"],
      eventTypes: ["cash.opened", "cash.saleNoted", "cash.payout", "cash.closed"],
    },
    lifecycle: {
      async install() {
        registerAggregate(CashDrawerAggregate.TYPE, CashDrawerAggregate)
      },
      async activate(runtime: ModuleRuntime) {
        runtime.commands.register(openDrawer)
        runtime.commands.register(payout)
        runtime.commands.register(noteSale)
        runtime.commands.register(closeDrawer)

        // Every cash payment notes a sale on the open drawer session, so the
        // drawer and the order ledger share one truth. Idempotent per
        // paymentId; advisory — a missed note surfaces as variance, never a
        // failed sale.
        runtime.hooks.on("event:published", async ({ event }: { event: unknown }) => {
          try {
            const e = event as { eventType?: string; payload?: Record<string, unknown> }
            if (e.eventType !== "order.paymentRecorded") return
            const payment = (e.payload as Record<string, unknown> | undefined)?.payment as { method?: string; amount?: number; paymentId?: string } | undefined
            if (!payment || String(payment.method ?? "").toLowerCase() !== "cash") return
            if (!payment.paymentId) return
            const board = runtime.projections.get<{ currentId: string | null }>("cash.board")
            const currentId = board.state.currentId
            if (!currentId) return
            await runtime.kernel.execute(
              "cash.noteSale",
              { sessionId: currentId, paymentId: payment.paymentId, amount: payment.amount ?? 0 },
              systemActor({ userId: "system:cash-hook" }),
              `cash-sale:${payment.paymentId}`,
            ).catch(() => null)
          } catch {
            /* advisory */
          }
        })
      },
    },
  }
}
