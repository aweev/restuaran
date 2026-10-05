import { randomUUID } from "crypto"
import { z } from "zod"
import { AttributeBag, StoredEvent } from "@/kernel/types"
import { defineCommand } from "@/kernel/commands/define-command"
import { QueryHandler } from "@/kernel/queries/query-bus"
import {
  PromotionAggregate,
  PromotionKind,
  PromotionState,
  evaluatePromotion,
} from "@/kernel/aggregates/promotion.aggregate"
import { RosModule, ModuleRuntime } from "@/kernel/modules/module-registry"
import { defineProjection, Projection, maybePaginate } from "@/kernel/projections/projection"
import { registerAggregate } from "@/kernel/aggregates/registry"

export interface PromotionRow {
  promotionId: string
  code: string
  name: string
  kind: PromotionKind
  value: number | string
  active: boolean
  usesCount: number
  maxUses: number | null
  exclusive: boolean
  priority: number
  updatedAt: string | null
}

export interface PromotionsBoardState extends AttributeBag {
  rows: PromotionRow[]
}

export function promotionsBoardProjection(
  store: ModuleRuntime["events"],
  tenant: ModuleRuntime["tenant"],
): Projection<PromotionsBoardState> {
  return defineProjection<PromotionsBoardState>(
    {
      name: "promotions.board",
      initial: { rows: [] },
      watchedEventTypes: ["promotion.defined", "promotion.activated", "promotion.deactivated", "promotion.redeemed"],
      reduce: (state, event: StoredEvent): PromotionsBoardState => {
        const rows = [...state.rows]
        const p = event.payload as Record<string, unknown>
        let idx = rows.findIndex((r) => r.promotionId === event.aggregateId)
        if (idx < 0) {
          if (event.eventType !== "promotion.defined") return state
          idx = rows.length
          rows.push({
            promotionId: event.aggregateId,
            code: "", name: "", kind: "percent", value: 0, active: true,
            usesCount: 0, maxUses: null, exclusive: false, priority: 100, updatedAt: null,
          })
        }
        const row = { ...rows[idx] }
        switch (event.eventType) {
          case "promotion.defined":
            row.code = String(p.code ?? "")
            row.name = String(p.name ?? "")
            row.kind = p.kind as PromotionKind
            row.value = p.value as number | string
            row.active = true
            row.usesCount = 0
            row.maxUses = (p.maxUses as number) ?? null
            row.exclusive = Boolean(p.exclusive)
            row.priority = Number(p.priority ?? 100)
            break
          case "promotion.activated":
            row.active = true
            break
          case "promotion.deactivated":
            row.active = false
            break
          case "promotion.redeemed":
            row.usesCount = Number(p.usesCount ?? row.usesCount)
            break
        }
        row.updatedAt = event.occurredAt
        rows[idx] = row
        rows.sort((a, b) => a.priority - b.priority)
        return { rows }
      },
    },
    store,
    tenant,
  )
}

const defineSchema = z.object({
  promotionId: z.string().min(1).optional(),
  code: z.string().min(1),
  name: z.string().min(1),
  kind: z.enum(["percent", "amount", "freeItem"]),
  value: z.union([z.number().positive(), z.string().min(1)]),
  description: z.string().optional(),
  minSubtotal: z.number().nonnegative().optional(),
  maxUses: z.number().int().positive().nullable().optional(),
  startsAt: z.string().optional(),
  endsAt: z.string().optional(),
  exclusive: z.boolean().optional(),
  priority: z.number().int().optional(),
})

const definePromotion = defineCommand({
  commandType: "promotion.define",
  requiredPermission: "promotion:manage",
  schema: defineSchema,
  async execute(ctx) {
    const p = ctx.payload as z.infer<typeof defineSchema>
    const board = ctx.projections.get<PromotionsBoardState>("promotions.board").state
    const code = p.code.trim().toUpperCase()
    if (board.rows.some((r) => r.code === code)) {
      const { kernelError } = await import("@/kernel/types")
      throw kernelError("DUPLICATE_PROMOTION", `Promotion ${code} already exists`)
    }
    const id = p.promotionId ?? randomUUID()
    const agg = PromotionAggregate.define(ctx.tenant, {
      id,
      code,
      name: p.name,
      kind: p.kind,
      value: p.value,
      actor: ctx.actor,
      description: p.description,
      minSubtotal: p.minSubtotal,
      maxUses: p.maxUses,
      startsAt: p.startsAt,
      endsAt: p.endsAt,
      exclusive: p.exclusive,
      priority: p.priority,
    })
    await ctx.commit(agg)
    return id
  },
})

const setActive = defineCommand({
  commandType: "promotion.setActive",
  requiredPermission: "promotion:manage",
  schema: z.object({ promotionId: z.string().min(1), active: z.boolean() }),
  async execute(ctx) {
    const id = String(ctx.payload.promotionId)
    const agg = await ctx.load<PromotionAggregate>(PromotionAggregate.TYPE, id)
    agg.setActive(ctx.actor, Boolean(ctx.payload.active))
    await ctx.commit(agg)
    return id
  },
})

const recordRedemption = defineCommand({
  commandType: "promotion.recordRedemption",
  requiredPermission: "promotion:manage",
  schema: z.object({ promotionId: z.string().min(1), orderId: z.string().min(1) }),
  async execute(ctx) {
    const id = String(ctx.payload.promotionId)
    const agg = await ctx.load<PromotionAggregate>(PromotionAggregate.TYPE, id)
    agg.recordRedemption(ctx.actor, String(ctx.payload.orderId))
    await ctx.commit(agg)
    return id
  },
})

const getPromotion: QueryHandler = {
  queryType: "get.promotion",
  requiredPermission: "promotion:view",
  async handle(params, ctx) {
    const agg = await ctx.repository.load<PromotionAggregate>(
      PromotionAggregate.TYPE, ctx.tenant, String(params.promotionId),
    )
    return { id: agg.id, version: agg.version, state: agg.state }
  },
}

const listPromotions: QueryHandler = {
  queryType: "list.promotions",
  requiredPermission: "promotion:view",
  async handle(params, ctx) {
    const rows = ctx.projections.get<PromotionsBoardState>("promotions.board").state.rows
    const filtered = params.active !== undefined
      ? rows.filter((r) => r.active === (params.active === true || params.active === "true"))
      : rows
    return maybePaginate(filtered, params)
  },
}

/**
 * Price a code against a basket without writing anything. The till then
 * applies the discount through the existing `order.applyDiscount` (which owns
 * balance guards) and records usage with `promotion.recordRedemption`.
 */
const evaluate: QueryHandler = {
  queryType: "promotion.evaluate",
  requiredPermission: "promotion:view",
  async handle(params, ctx) {
    const code = String(params.code ?? "").trim().toUpperCase()
    const subtotal = Number(params.subtotal ?? 0)
    const board = ctx.projections.get<PromotionsBoardState>("promotions.board").state
    const row = board.rows.find((r) => r.code === code)
    if (!row) {
      const { kernelError } = await import("@/kernel/types")
      throw kernelError("PROMO_UNKNOWN", `No promotion ${code}`)
    }
    const agg = await ctx.repository.load<PromotionAggregate>(PromotionAggregate.TYPE, ctx.tenant, row.promotionId)
    const state: PromotionState = agg.state
    let itemPrice: number | undefined
    if (state.kind === "freeItem") {
      try {
        const menu = ctx.projections.get<{ items: Array<{ id: string; price: number }> }>("menu.board").state
        itemPrice = menu.items.find((i) => i.id === state.value)?.price
      } catch {
        itemPrice = undefined
      }
    }
    return { code: row.code, promotionId: row.promotionId, ...evaluatePromotion(state, { subtotal, itemPrice }) }
  },
}

export function promotionsModule(): RosModule {
  return {
    id: "ros.promotions",
    name: "Promotions",
    version: "1.0.0",
    capabilities: {
      commands: ["promotion.define", "promotion.setActive", "promotion.recordRedemption"],
      queries: ["get.promotion", "list.promotions", "promotion.evaluate"],
      eventTypes: ["promotion.defined", "promotion.activated", "promotion.deactivated", "promotion.redeemed"],
    },
    lifecycle: {
      async install(runtime: ModuleRuntime) {
        registerAggregate(PromotionAggregate.TYPE, PromotionAggregate)
        runtime.projections.register(promotionsBoardProjection(runtime.events, runtime.tenant))
      },
      async activate(runtime: ModuleRuntime) {
        runtime.commands.register(definePromotion)
        runtime.commands.register(setActive)
        runtime.commands.register(recordRedemption)
        runtime.queries.register(getPromotion)
        runtime.queries.register(listPromotions)
        runtime.queries.register(evaluate)
      },
    },
  }
}
