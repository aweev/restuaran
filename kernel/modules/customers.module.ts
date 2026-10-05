import { randomUUID } from "crypto"
import { AttributeBag, kernelError, StoredEvent } from "@/kernel/types"
import { defineCommand } from "@/kernel/commands/define-command"
import { QueryHandler } from "@/kernel/queries/query-bus"
import { CustomerAggregate, LoyaltyTier } from "@/kernel/aggregates/customer.aggregate"
import { RosModule, ModuleRuntime } from "@/kernel/modules/module-registry"
import { defineProjection, Projection, maybePaginate } from "@/kernel/projections/projection"
import { registerAggregate } from "@/kernel/aggregates/registry"

/**
 * Customers, loyalty and feedback.
 *
 * This domain previously had no kernel presence at all: `/api/customer/*` wrote
 * straight to the `Customer` and `LoyaltyLedger` tables with raw SQL, which
 * meant the loyalty balance and the member record could disagree, and a visit
 * was never an event. Here the points ledger *is* the history, so the balance
 * cannot drift from it.
 *
 * The projection deliberately omits email, phone, notes and dietary data: it
 * serves staff-facing lists. Full PII is only readable through the
 * permission-gated `get.customer` query.
 */

export interface CustomerBoardRow {
  customerId: string
  displayName: string
  tier: LoyaltyTier
  points: number
  visitCount: number
  lifetimeSpend: number
  /** 0-5 average across submitted reviews, or null when never reviewed. */
  averageRating: number | null
  reviewCount: number
  lastVisitAt: string | null
  lastOrderId: string | null
  allergiesCount: number
  updatedAt: string | null
}

export interface CustomersBoardState extends AttributeBag {
  rows: CustomerBoardRow[]
  totals: {
    members: number
    pointsOutstanding: number
    lifetimeSpend: number
    byTier: Record<string, number>
    /** Mean across every rating submitted, weighted by review count. */
    averageRating: number | null
  }
}

function emptyRow(customerId: string): CustomerBoardRow {
  return {
    customerId,
    displayName: "",
    tier: "bronze",
    points: 0,
    visitCount: 0,
    lifetimeSpend: 0,
    averageRating: null,
    reviewCount: 0,
    lastVisitAt: null,
    lastOrderId: null,
    allergiesCount: 0,
    updatedAt: null,
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function summarize(rows: CustomerBoardRow[]): CustomersBoardState["totals"] {
  const byTier: Record<string, number> = {}
  let points = 0
  let spend = 0
  let ratingSum = 0
  let ratingCount = 0
  for (const r of rows) {
    byTier[r.tier] = (byTier[r.tier] ?? 0) + 1
    points += r.points
    spend += r.lifetimeSpend
    if (r.averageRating != null) {
      ratingSum += r.averageRating * r.reviewCount
      ratingCount += r.reviewCount
    }
  }
  return {
    members: rows.length,
    pointsOutstanding: points,
    lifetimeSpend: round2(spend),
    byTier,
    averageRating: ratingCount === 0 ? null : round2(ratingSum / ratingCount),
  }
}

export function customersBoardProjection(
  store: ModuleRuntime["events"],
  tenant: ModuleRuntime["tenant"],
): Projection<CustomersBoardState> {
  return defineProjection<CustomersBoardState>(
    {
      name: "customers.board",
      initial: {
        rows: [],
        totals: { members: 0, pointsOutstanding: 0, lifetimeSpend: 0, byTier: {}, averageRating: null },
      },
      watchedEventTypes: [
        "customer.enrolled",
        "customer.pointsEarned",
        "customer.visitRecorded",
        "customer.rewardRedeemed",
        "customer.feedbackSubmitted",
        "customer.profileUpdated",
      ],
      reduce: (state, event: StoredEvent): CustomersBoardState => {
        const rows = [...state.rows]
        const p = event.payload as Record<string, unknown>
        // Only enrolment may open a row; a later event for an unknown customer
        // would otherwise invent a member who was never created.
        let idx = rows.findIndex((r) => r.customerId === event.aggregateId)
        if (idx < 0) {
          if (event.eventType !== "customer.enrolled") return state
          idx = rows.length
          rows.push(emptyRow(event.aggregateId))
        }
        const row = { ...rows[idx] }

        switch (event.eventType) {
          case "customer.enrolled":
            row.displayName = String(p.displayName ?? "")
            break
          case "customer.pointsEarned":
            row.points = Number(p.points ?? row.points)
            row.tier = (p.tier as LoyaltyTier) ?? row.tier
            break
          case "customer.visitRecorded":
            row.visitCount = Number(p.visitCount ?? row.visitCount)
            row.lifetimeSpend = round2(Number(p.lifetimeSpend ?? row.lifetimeSpend))
            row.lastOrderId = (p.orderId as string) ?? row.lastOrderId
            row.lastVisitAt = event.occurredAt
            break
          case "customer.feedbackSubmitted": {
            const rating = Number(p.rating)
            if (Number.isFinite(rating)) {
              // Running mean, so the board never replays the review history.
              const n = row.reviewCount
              row.averageRating = round2(((row.averageRating ?? 0) * n + rating) / (n + 1))
              row.reviewCount = n + 1
            }
            break
          }
          case "customer.profileUpdated":
            if (Array.isArray(p.allergies)) row.allergiesCount = (p.allergies as string[]).length
            break
        }

        row.updatedAt = event.occurredAt
        rows[idx] = row
        const kept = evictCustomersBoard(rows)
        return { rows: kept, totals: summarize(kept) }
      },
    },
    store,
    tenant,
  )
}

const CUSTOMERS_BOARD_MAX_ROWS = 10000;

/** Identity rows are never dropped while under the cap; beyond it the least
 *  recently active members fall out of the hot board (history stays in the log). */
function evictCustomersBoard<T extends { lastVisitAt?: string | null; updatedAt?: string | null }>(rows: T[]): T[] {
  if (rows.length <= CUSTOMERS_BOARD_MAX_ROWS) return rows
  const overflow = rows.length - CUSTOMERS_BOARD_MAX_ROWS
  const order = rows
    .map((r, i) => ({ k: r.lastVisitAt ?? r.updatedAt ?? "", i }))
    .sort((a, b) => (a.k < b.k ? -1 : a.k > b.k ? 1 : a.i - b.i))
    .map((x) => x.i)
  const drop = new Set(order.slice(0, overflow))
  return rows.filter((_, i) => !drop.has(i))
}

const strArr = (v: unknown): string[] | undefined =>
  Array.isArray(v) ? v.map(String) : undefined

const enrol = defineCommand({
  commandType: "customer.enrol",
  requiredPermission: "customer:manage",
  async execute(ctx) {
    const id = String(ctx.payload.customerId ?? randomUUID())
    const agg = CustomerAggregate.enrol(ctx.tenant, {
      id,
      displayName: String(ctx.payload.displayName ?? ""),
      email: String(ctx.payload.email ?? ""),
      phone: ctx.payload.phone ? String(ctx.payload.phone) : undefined,
      notes: ctx.payload.notes ? String(ctx.payload.notes) : undefined,
      dietaryRestrictions: strArr(ctx.payload.dietaryRestrictions),
      allergies: strArr(ctx.payload.allergies),
      favoriteItems: strArr(ctx.payload.favoriteItems),
      seatingPreferences: strArr(ctx.payload.seatingPreferences),
      marketingOptIn: ctx.payload.marketingOptIn != null ? Boolean(ctx.payload.marketingOptIn) : undefined,
      actor: ctx.actor,
    })
    await ctx.commit(agg)
    return id
  },
})

const recordVisit = defineCommand({
  commandType: "customer.recordVisit",
  requiredPermission: "customer:manage",
  async execute(ctx) {
    const id = String(ctx.payload.customerId)
    const agg = await ctx.load<CustomerAggregate>(CustomerAggregate.TYPE, id)
    agg.recordVisit(ctx.actor, String(ctx.payload.orderId), Number(ctx.payload.spend))
    await ctx.commit(agg)
    return id
  },
})

const awardPoints = defineCommand({
  commandType: "customer.awardPoints",
  requiredPermission: "customer:manage",
  async execute(ctx) {
    const id = String(ctx.payload.customerId)
    const agg = await ctx.load<CustomerAggregate>(CustomerAggregate.TYPE, id)
    agg.awardPoints(ctx.actor, Number(ctx.payload.points), String(ctx.payload.note ?? ""))
    await ctx.commit(agg)
    return id
  },
})

const addReward = defineCommand({
  commandType: "customer.addReward",
  requiredPermission: "customer:manage",
  async execute(ctx) {
    const id = String(ctx.payload.customerId)
    const agg = await ctx.load<CustomerAggregate>(CustomerAggregate.TYPE, id)
    agg.addReward(ctx.actor, {
      name: String(ctx.payload.name ?? ""),
      cost: Number(ctx.payload.cost),
      remaining: ctx.payload.remaining != null ? Number(ctx.payload.remaining) : null,
    })
    await ctx.commit(agg)
    return id
  },
})

const redeemReward = defineCommand({
  commandType: "customer.redeemReward",
  requiredPermission: "customer:manage",
  async execute(ctx) {
    const id = String(ctx.payload.customerId)
    const agg = await ctx.load<CustomerAggregate>(CustomerAggregate.TYPE, id)
    agg.redeemReward(ctx.actor, String(ctx.payload.rewardId))
    await ctx.commit(agg)
    return id
  },
})

const submitFeedback = defineCommand({
  commandType: "customer.submitFeedback",
  requiredPermission: "feedback:submit",
  async execute(ctx) {
    const id = String(ctx.payload.customerId)
    const agg = await ctx.load<CustomerAggregate>(CustomerAggregate.TYPE, id)
    agg.submitFeedback(ctx.actor, {
      orderId: String(ctx.payload.orderId),
      rating: Number(ctx.payload.rating),
      comment: ctx.payload.comment ? String(ctx.payload.comment) : undefined,
      wouldReturn: ctx.payload.wouldReturn != null ? Boolean(ctx.payload.wouldReturn) : undefined,
    })
    await ctx.commit(agg)
    return id
  },
})

const updateCustomer = defineCommand({
  commandType: "customer.update",
  requiredPermission: "customer:manage",
  async execute(ctx) {
    const id = String(ctx.payload.customerId)
    const agg = await ctx.load<CustomerAggregate>(CustomerAggregate.TYPE, id)
    agg.updateProfile(ctx.actor, {
      displayName: ctx.payload.displayName != null ? String(ctx.payload.displayName) : undefined,
      phone: ctx.payload.phone != null ? String(ctx.payload.phone) : undefined,
      notes: ctx.payload.notes != null ? String(ctx.payload.notes) : undefined,
      dietaryRestrictions: strArr(ctx.payload.dietaryRestrictions),
      allergies: strArr(ctx.payload.allergies),
      favoriteItems: strArr(ctx.payload.favoriteItems),
      seatingPreferences: strArr(ctx.payload.seatingPreferences),
      marketingOptIn: ctx.payload.marketingOptIn != null ? Boolean(ctx.payload.marketingOptIn) : undefined,
    })
    await ctx.commit(agg)
    return id
  },
})

const getCustomer: QueryHandler = {
  queryType: "get.customer",
  requiredPermission: "customer:view",
  async handle(params, ctx) {
    // The PII-bearing read. Deliberately a query rather than part of the board,
    // so a list endpoint can never leak phone numbers or allergies.
    const agg = await ctx.repository.load<CustomerAggregate>(
      CustomerAggregate.TYPE,
      ctx.tenant,
      String(params.customerId),
    )
    return { id: agg.id, version: agg.version, state: agg.state }
  },
}

const listCustomers: QueryHandler = {
  queryType: "list.customers",
  requiredPermission: "customer:view",
  async handle(params, ctx) {
    const board = ctx.projections.get<CustomersBoardState>("customers.board").state
    let rows = board.rows
    if (params.tier) rows = rows.filter((r) => r.tier === String(params.tier))
    // Host-stand search is substring match on the display name. Contact-detail
    // search stays behind `get.customer` (PII-gated) rather than the board.
    if (params.q) {
      const q = String(params.q).toLowerCase()
      rows = rows.filter((r) => r.displayName.toLowerCase().includes(q))
    }
    return maybePaginate(rows, params)
  },
}

const listRewards: QueryHandler = {
  queryType: "list.loyalty.rewards",
  requiredPermission: "customer:view",
  async handle(params, ctx) {
    const agg = await ctx.repository.load<CustomerAggregate>(
      CustomerAggregate.TYPE,
      ctx.tenant,
      String(params.customerId),
    )
    return maybePaginate([...agg.state.rewards], params)
  },
}

export function customersModule(): RosModule {
  return {
    id: "ros.customers",
    name: "Customers, Loyalty & Feedback",
    version: "1.0.0",
    capabilities: {
      commands: [
        "customer.enrol", "customer.recordVisit", "customer.awardPoints",
        "customer.addReward", "customer.redeemReward", "customer.submitFeedback", "customer.update",
      ],
      queries: ["get.customer", "list.customers", "list.loyalty.rewards"],
      eventTypes: [
        "customer.enrolled", "customer.pointsEarned", "customer.visitRecorded",
        "customer.rewardAdded", "customer.rewardRedeemed",
        "customer.feedbackSubmitted", "customer.profileUpdated",
      ],
    },
    lifecycle: {
      async install(runtime: ModuleRuntime) {
        registerAggregate(CustomerAggregate.TYPE, CustomerAggregate)
        runtime.projections.register(customersBoardProjection(runtime.events, runtime.tenant))
      },
      async activate(runtime: ModuleRuntime) {
        runtime.commands.register(enrol)
        runtime.commands.register(recordVisit)
        runtime.commands.register(awardPoints)
        runtime.commands.register(addReward)
        runtime.commands.register(redeemReward)
        runtime.commands.register(submitFeedback)
        runtime.commands.register(updateCustomer)
        runtime.queries.register(getCustomer)
        runtime.queries.register(listCustomers)
        runtime.queries.register(listRewards)
      },
    },
  }
}
