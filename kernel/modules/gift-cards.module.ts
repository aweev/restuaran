import { randomUUID } from "crypto"
import { z } from "zod"
import { AttributeBag, StoredEvent } from "@/kernel/types"
import { defineCommand } from "@/kernel/commands/define-command"
import { QueryHandler } from "@/kernel/queries/query-bus"
import { GiftCardAggregate, GiftCardStatus } from "@/kernel/aggregates/gift-card.aggregate"
import { RosModule, ModuleRuntime } from "@/kernel/modules/module-registry"
import { defineProjection, Projection, maybePaginate } from "@/kernel/projections/projection"
import { registerAggregate } from "@/kernel/aggregates/registry"

export interface GiftCardRow {
  cardId: string
  cardNumber: string
  balance: number
  initialBalance: number
  currency: string
  status: GiftCardStatus
  txCount: number
  updatedAt: string | null
  purchaserCustomerId: string | null
  recipientEmail: string | null
  issuedAt: string | null
  voidReason: string | null
}

export interface GiftCardsBoardState extends AttributeBag {
  rows: GiftCardRow[]
}

export function giftCardsBoardProjection(
  store: ModuleRuntime["events"],
  tenant: ModuleRuntime["tenant"],
): Projection<GiftCardsBoardState> {
  return defineProjection<GiftCardsBoardState>(
    {
      name: "giftcards.board",
      initial: { rows: [] },
      watchedEventTypes: [
        "giftcard.issued",
        "giftcard.loaded",
        "giftcard.redeemed",
        "giftcard.refunded",
        "giftcard.voided",
      ],
      reduce: (state, event: StoredEvent): GiftCardsBoardState => {
        const rows = [...state.rows]
        const p = event.payload as Record<string, unknown>
        let idx = rows.findIndex((r) => r.cardId === event.aggregateId)
        if (idx < 0) {
          if (event.eventType !== "giftcard.issued") return state
          idx = rows.length
          rows.push({
            cardId: event.aggregateId,
            cardNumber: "",
            balance: 0,
            initialBalance: 0,
            currency: "USD",
            status: "active",
            txCount: 0,
            updatedAt: null,
            purchaserCustomerId: null,
            recipientEmail: null,
            issuedAt: null,
            voidReason: null,
          })
        }
        const row = { ...rows[idx] }
        switch (event.eventType) {
          case "giftcard.issued":
            row.cardNumber = String(p.cardNumber ?? "")
            row.balance = Number(p.balance ?? 0)
            row.initialBalance = Number(p.initialBalance ?? 0)
            row.currency = String(p.currency ?? "USD")
            row.status = "active"
            row.txCount = 1
            row.purchaserCustomerId = (p.purchaserCustomerId as string | null) ?? null
            row.recipientEmail = (p.recipientEmail as string | null) ?? null
            row.issuedAt = event.occurredAt
            row.voidReason = null
            break
          case "giftcard.loaded":
          case "giftcard.redeemed":
          case "giftcard.refunded":
            row.balance = Number(p.balance ?? row.balance)
            row.txCount += 1
            break
          case "giftcard.voided":
            row.status = "voided"
            row.voidReason = (p.reason as string | null) ?? null
            break
        }
        row.updatedAt = event.occurredAt
        rows[idx] = row
        return { rows }
      },
    },
    store,
    tenant,
  )
}

function randomCardNumber(): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
  let suffix = ""
  const bytes = randomUUID().replace(/-/g, "")
  for (let i = 0; i < 6; i += 1) {
    suffix += alphabet[parseInt(bytes.slice(i * 2, i * 2 + 2), 16) % alphabet.length]
  }
  return `GF-${suffix}`
}

const issueSchema = z.object({
  cardId: z.string().min(1).optional(),
  cardNumber: z.string().min(1).optional(),
  initialBalance: z.number().positive(),
  currency: z.string().min(1).optional(),
  purchaserCustomerId: z.string().min(1).optional(),
  recipientEmail: z.string().email().optional(),
})

const issue = defineCommand({
  commandType: "giftcard.issue",
  requiredPermission: "giftcard:manage",
  schema: issueSchema,
  async execute(ctx) {
    const p = ctx.payload as z.infer<typeof issueSchema>
    const board = ctx.projections.get<GiftCardsBoardState>("giftcards.board").state
    const cardNumber = (p.cardNumber ?? randomCardNumber()).trim().toUpperCase()
    if (board.rows.some((r) => r.cardNumber === cardNumber)) {
      const { kernelError } = await import("@/kernel/types")
      throw kernelError("DUPLICATE_CARD", `Card ${cardNumber} already exists`)
    }
    const id = p.cardId ?? randomUUID()
    const agg = GiftCardAggregate.issue(ctx.tenant, {
      id,
      cardNumber,
      initialBalance: p.initialBalance,
      currency: p.currency,
      purchaserCustomerId: p.purchaserCustomerId,
      recipientEmail: p.recipientEmail,
      actor: ctx.actor,
    })
    await ctx.commit(agg)
    return id
  },
})

const loadFunds = defineCommand({
  commandType: "giftcard.load",
  requiredPermission: "giftcard:manage",
  schema: z.object({ cardId: z.string().min(1), amount: z.number().positive() }),
  async execute(ctx) {
    const id = String(ctx.payload.cardId)
    const agg = await ctx.load<GiftCardAggregate>(GiftCardAggregate.TYPE, id)
    agg.load(ctx.actor, Number(ctx.payload.amount))
    await ctx.commit(agg)
    return id
  },
})

const redeem = defineCommand({
  commandType: "giftcard.redeem",
  requiredPermission: "giftcard:manage",
  schema: z.object({
    cardId: z.string().min(1),
    orderId: z.string().min(1),
    amount: z.number().positive(),
  }),
  async execute(ctx) {
    const id = String(ctx.payload.cardId)
    const agg = await ctx.load<GiftCardAggregate>(GiftCardAggregate.TYPE, id)
    agg.redeem(ctx.actor, String(ctx.payload.orderId), Number(ctx.payload.amount))
    await ctx.commit(agg)
    return id
  },
})

const refund = defineCommand({
  commandType: "giftcard.refund",
  requiredPermission: "giftcard:manage",
  schema: z.object({
    cardId: z.string().min(1),
    orderId: z.string().min(1),
    amount: z.number().positive(),
    reason: z.string().optional(),
  }),
  async execute(ctx) {
    const id = String(ctx.payload.cardId)
    const agg = await ctx.load<GiftCardAggregate>(GiftCardAggregate.TYPE, id)
    agg.refund(
      ctx.actor,
      String(ctx.payload.orderId),
      Number(ctx.payload.amount),
      ctx.payload.reason ? String(ctx.payload.reason) : undefined,
    )
    await ctx.commit(agg)
    return id
  },
})

const voidCard = defineCommand({
  commandType: "giftcard.void",
  requiredPermission: "giftcard:manage",
  schema: z.object({ cardId: z.string().min(1), reason: z.string().optional() }),
  async execute(ctx) {
    const id = String(ctx.payload.cardId)
    const agg = await ctx.load<GiftCardAggregate>(GiftCardAggregate.TYPE, id)
    agg.void(ctx.actor, ctx.payload.reason ? String(ctx.payload.reason) : undefined)
    await ctx.commit(agg)
    return id
  },
})

const getGiftCard: QueryHandler = {
  queryType: "get.giftcard",
  requiredPermission: "giftcard:view",
  async handle(params, ctx) {
    const agg = await ctx.repository.load<GiftCardAggregate>(
      GiftCardAggregate.TYPE, ctx.tenant, String(params.cardId),
    )
    return { id: agg.id, version: agg.version, state: agg.state }
  },
}

const listGiftCards: QueryHandler = {
  queryType: "list.giftcards",
  requiredPermission: "giftcard:view",
  async handle(params, ctx) {
    const rows = ctx.projections.get<GiftCardsBoardState>("giftcards.board").state.rows
    const filtered = params.status ? rows.filter((r) => r.status === String(params.status)) : rows
    return maybePaginate(filtered, params)
  },
}

const lookupByNumber: QueryHandler = {
  queryType: "get.giftcardByNumber",
  requiredPermission: "giftcard:view",
  async handle(params, ctx) {
    const code = String(params.cardNumber ?? "").trim().toUpperCase()
    const row = ctx.projections.get<GiftCardsBoardState>("giftcards.board").state.rows
      .find((r) => r.cardNumber === code)
    if (!row) {
      const { kernelError } = await import("@/kernel/types")
      throw kernelError("CARD_NOT_FOUND", `No gift card ${code}`)
    }
    return row
  },
}

export function giftCardsModule(): RosModule {
  return {
    id: "ros.giftcards",
    name: "Gift cards",
    version: "1.0.0",
    capabilities: {
      commands: ["giftcard.issue", "giftcard.load", "giftcard.redeem", "giftcard.refund", "giftcard.void"],
      queries: ["get.giftcard", "list.giftcards", "get.giftcardByNumber"],
      eventTypes: ["giftcard.issued", "giftcard.loaded", "giftcard.redeemed", "giftcard.refunded", "giftcard.voided"],
    },
    lifecycle: {
      async install(runtime: ModuleRuntime) {
        registerAggregate(GiftCardAggregate.TYPE, GiftCardAggregate)
        runtime.projections.register(giftCardsBoardProjection(runtime.events, runtime.tenant))
      },
      async activate(runtime: ModuleRuntime) {
        runtime.commands.register(issue)
        runtime.commands.register(loadFunds)
        runtime.commands.register(redeem)
        runtime.commands.register(refund)
        runtime.commands.register(voidCard)
        runtime.queries.register(getGiftCard)
        runtime.queries.register(listGiftCards)
        runtime.queries.register(lookupByNumber)
      },
    },
  }
}
