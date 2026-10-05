import { ActorContext, AttributeBag, Id, kernelError, TenantContext } from "@/kernel/types"
import { Aggregate, AggregateEvent } from "./aggregate"

/**
 * Loyalty membership and the points ledger.
 *
 * Points are an append-only ledger rather than a running balance: a projected
 * `points` field that drifts from its ledger is how a restaurant ends up
 * granting a free entree it cannot account for. Every movement is an entry with
 * a reason, and `points` is always the sum of the entries.
 */
export type LoyaltyTier = "bronze" | "silver" | "gold" | "platinum"

export interface LoyaltyEntry {
  entryId: Id
  /** Positive = earned, negative = redeemed or clawed back. */
  points: number
  reason: "signup" | "visit" | "review" | "redemption" | "adjustment"
  orderId: Id | null
  note: string
  at: string
  by: Id
}

export interface LoyaltyReward {
  rewardId: Id
  name: string
  cost: number
  /** null = unlimited stock; otherwise decremented on redemption. */
  remaining: number | null
}

export interface CustomerState extends AttributeBag {
  displayName: string
  email: string
  phone: string
  /** Visit-derived totals, all recomputed from the stream. */
  points: number
  lifetimeSpend: number
  visitCount: number
  tier: LoyaltyTier
  entries: LoyaltyEntry[]
  rewards: LoyaltyReward[]
  /** Reward ids already redeemed by this customer. */
  redeemed: Id[]
  notes: string
  dietaryRestrictions: string[]
  allergies: string[]
  /** Favourite dishes, free-text from the host stand. */
  favoriteItems: string[]
  /** e.g. "window", "quiet corner" — surfaced at seating time. */
  seatingPreferences: string[]
  marketingOptIn: boolean
  updatedAt: string | null
}

/** Thresholds are cumulative lifetime points, ascending. */
const TIERS: Array<{ tier: LoyaltyTier; at: number }> = [
  { tier: "bronze", at: 0 },
  { tier: "silver", at: 250 },
  { tier: "gold", at: 750 },
  { tier: "platinum", at: 2000 },
]

export function tierForPoints(points: number): LoyaltyTier {
  let tier: LoyaltyTier = "bronze"
  for (const t of TIERS) if (points >= t.at) tier = t.tier
  return tier
}

/** Points earned per currency unit. */
export const POINTS_PER_UNIT = 1

export class CustomerAggregate extends Aggregate<CustomerState> {
  static readonly TYPE = "Customer"

  constructor(tenant: TenantContext) {
    super(CustomerAggregate.TYPE, tenant, {
      displayName: "",
      email: "",
      phone: "",
      points: 0,
      lifetimeSpend: 0,
      visitCount: 0,
      tier: "bronze",
      entries: [],
      rewards: [],
      redeemed: [],
      notes: "",
      dietaryRestrictions: [],
      allergies: [],
      favoriteItems: [],
      seatingPreferences: [],
      marketingOptIn: false,
      updatedAt: null,
    })
  }

  static enrol(tenant: TenantContext, opts: {
    id: Id
    displayName: string
    email: string
    phone?: string
    notes?: string
    dietaryRestrictions?: string[]
    allergies?: string[]
    favoriteItems?: string[]
    seatingPreferences?: string[]
    marketingOptIn?: boolean
    actor: ActorContext
  }): CustomerAggregate {
    const agg = new CustomerAggregate(tenant)
    agg.initialize(opts.id)
    const email = opts.email.trim().toLowerCase()
    if (!email) throw kernelError("INVALID_CUSTOMER", "Email is required")
    if (!opts.displayName?.trim()) throw kernelError("INVALID_CUSTOMER", "Display name is required")
    agg.raise(
      "customer.enrolled",
      {
        displayName: opts.displayName.trim(), email, phone: opts.phone ?? "",
        notes: opts.notes ?? "",
        dietaryRestrictions: opts.dietaryRestrictions ?? [],
        allergies: opts.allergies ?? [],
        favoriteItems: opts.favoriteItems ?? [],
        seatingPreferences: opts.seatingPreferences ?? [],
        marketingOptIn: opts.marketingOptIn ?? false,
      },
      opts.actor,
    )
    // The welcome bonus is an explicit ledger entry rather than a starting
    // balance, so "why does this account start at 50?" has an answer.
    agg.credit(opts.actor, 50, "signup", null, "Welcome bonus")
    return agg
  }

  private credit(
    actor: ActorContext,
    points: number,
    reason: LoyaltyEntry["reason"],
    orderId: Id | null,
    note: string,
  ): void {
    const entry: LoyaltyEntry = {
      entryId: crypto.randomUUID(),
      points,
      reason,
      orderId,
      note,
      at: new Date().toISOString(),
      by: actor.userId,
    }
    const entries = [...this.state.entries, entry]
    const total = entries.reduce((s, e) => s + e.points, 0)
    this.raise("customer.pointsEarned", { entry, entries, points: total, tier: tierForPoints(total) }, actor)
  }

  /** Record a completed visit: the single source of loyalty accrual. */
  recordVisit(actor: ActorContext, orderId: Id, spend: number): void {
    if (!Number.isFinite(spend) || spend < 0) {
      throw kernelError("INVALID_SPEND", "Spend must be a non-negative number")
    }
    if (this.state.entries.some((e) => e.orderId === orderId && e.reason === "visit")) {
      throw kernelError("DUPLICATE_VISIT", "This visit has already been recorded")
    }
    this.raise(
      "customer.visitRecorded",
      {
        orderId,
        spend,
        lifetimeSpend: round2(this.state.lifetimeSpend + spend),
        visitCount: this.state.visitCount + 1,
      },
      actor,
    )
    this.credit(actor, Math.floor(spend * POINTS_PER_UNIT), "visit", orderId, `Visit on ${orderId}`)
  }

  /** Award points outside a purchase — service recovery, promotion, good will. */
  awardPoints(actor: ActorContext, points: number, note: string): void {
    if (!Number.isInteger(points) || points === 0) {
      throw kernelError("INVALID_POINTS", "Award must be a non-zero whole number")
    }
    this.credit(actor, points, "adjustment", null, note)
  }

  /** Redeem a reward, refusing if the customer cannot afford it. */
  redeemReward(actor: ActorContext, rewardId: Id): void {
    const reward = this.state.rewards.find((r) => r.rewardId === rewardId)
    if (!reward) throw kernelError("UNKNOWN_REWARD", "No such reward")
    if (reward.remaining !== null && reward.remaining <= 0) {
      throw kernelError("REWARD_EXHAUSTED", "That reward is out of stock")
    }
    // The balance check lives here, in the aggregate, so a double-tap on
    // "redeem" cannot overdraw the member.
    if (this.state.points < reward.cost) {
      throw kernelError("INSUFFICIENT_POINTS", `Needs ${reward.cost} points; member has ${this.state.points}`)
    }
    this.credit(actor, -reward.cost, "redemption", null, `Redeemed: ${reward.name}`)
    this.raise(
      "customer.rewardRedeemed",
      {
        rewardId,
        rewards: this.state.rewards.map((r) =>
          r.rewardId === rewardId && r.remaining !== null ? { ...r, remaining: r.remaining - 1 } : r,
        ),
        redeemed: [...this.state.redeemed, rewardId],
      },
      actor,
    )
  }

  addReward(actor: ActorContext, reward: Omit<LoyaltyReward, "rewardId"> & { rewardId?: Id }): void {
    const id = reward.rewardId ?? crypto.randomUUID()
    if (this.state.rewards.some((r) => r.rewardId === id)) {
      throw kernelError("DUPLICATE_REWARD", "A reward with that id already exists")
    }
    if (!Number.isInteger(reward.cost) || reward.cost <= 0) {
      throw kernelError("INVALID_REWARD", "Reward cost must be a positive whole number of points")
    }
    this.raise(
      "customer.rewardAdded",
      { reward: { ...reward, rewardId: id }, rewards: [...this.state.rewards, { ...reward, rewardId: id }] },
      actor,
    )
  }


  /**
   * Record a guest review. Points are awarded only on the first review per
   * order, and only for a positive rating: rewarding complaints would be
   * perverse, while a 1-2 star claws back to fund service recovery.
   */
  submitFeedback(actor: ActorContext, input: {
    orderId: Id
    rating: number
    comment?: string
    wouldReturn?: boolean
  }): void {
    const rating = Number(input.rating)
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw kernelError("INVALID_RATING", "Rating must be a whole number from 1 to 5")
    }
    const already = this.state.entries.some((e) => e.orderId === input.orderId && e.reason === "review")
    this.raise(
      "customer.feedbackSubmitted",
      {
        orderId: input.orderId,
        rating,
        comment: input.comment ?? "",
        wouldReturn: input.wouldReturn ?? rating >= 4,
      },
      actor,
    )
    if (!already) {
      if (rating >= 4) {
        this.credit(actor, 25, "review", input.orderId, `Positive review on ${input.orderId}`)
      } else if (rating <= 2) {
        this.credit(actor, -25, "adjustment", input.orderId, `Service recovery on ${input.orderId}`)
      }
    }
  }

  updateProfile(
    actor: ActorContext,
    patch: {
      displayName?: string
      phone?: string
      notes?: string
      dietaryRestrictions?: string[]
      allergies?: string[]
      favoriteItems?: string[]
      seatingPreferences?: string[]
      marketingOptIn?: boolean
    },
  ): void {
    if (patch.displayName !== undefined && !patch.displayName.trim()) {
      throw kernelError("INVALID_CUSTOMER", "Display name is required")
    }
    this.raise("customer.profileUpdated", patch, actor)
  }

  protected applyEvent(event: AggregateEvent): CustomerState {
    const s = this.state
    switch (event.eventType) {
      case "customer.enrolled":
        return { ...s, ...event.payload, updatedAt: event.occurredAt }
      case "customer.pointsEarned":
        return {
          ...s,
          entries: (event.payload.entries as LoyaltyEntry[]) ?? [...s.entries, event.payload.entry as LoyaltyEntry],
          points: Number(event.payload.points ?? s.points),
          tier: (event.payload.tier as LoyaltyTier) ?? s.tier,
          updatedAt: event.occurredAt,
        }
      case "customer.visitRecorded":
        return {
          ...s,
          lifetimeSpend: Number(event.payload.lifetimeSpend ?? s.lifetimeSpend),
          visitCount: Number(event.payload.visitCount ?? s.visitCount),
          updatedAt: event.occurredAt,
        }
      case "customer.rewardAdded":
        return { ...s, rewards: (event.payload.rewards as LoyaltyReward[]) ?? s.rewards, updatedAt: event.occurredAt }
      case "customer.rewardRedeemed":
        return {
          ...s,
          rewards: (event.payload.rewards as LoyaltyReward[]) ?? s.rewards,
          redeemed: (event.payload.redeemed as Id[]) ?? s.redeemed,
          updatedAt: event.occurredAt,
        }
      case "customer.feedbackSubmitted":
      case "customer.profileUpdated":
        return { ...s, ...event.payload, updatedAt: event.occurredAt }
      default:
        return s
    }
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
