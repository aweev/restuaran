import { ActorContext, AttributeBag, Id, kernelError, TenantContext } from "@/kernel/types"
import { Aggregate, AggregateEvent } from "./aggregate"

export type PromotionKind = "percent" | "amount" | "freeItem"

export interface PromotionState extends AttributeBag {
  code: string
  name: string
  description: string | null
  kind: PromotionKind
  /** percent 0-100 | fixed money off | menuItemId of the free item. */
  value: number | string
  minSubtotal: number
  maxUses: number | null
  usesCount: number
  active: boolean
  startsAt: string | null
  endsAt: string | null
  exclusive: boolean
  priority: number
}

/**
 * Marketing promotion definition. Definitions are event-sourced so "what was
 * the offer on Dec 24?" is answerable; discount *application* still flows
 * through the existing `order.applyDiscount` (which owns balance guards), and
 * `promotion.recordRedemption` tracks usage afterwards. BxGy and stacking
 * engines are deliberately deferred — percent/amount/freeItem cover the
 * venue's actual flyers.
 */
export class PromotionAggregate extends Aggregate<PromotionState> {
  static readonly TYPE = "Promotion"

  constructor(tenant: TenantContext) {
    super(PromotionAggregate.TYPE, tenant, {
      code: "",
      name: "",
      description: null,
      kind: "percent",
      value: 0,
      minSubtotal: 0,
      maxUses: null,
      usesCount: 0,
      active: true,
      startsAt: null,
      endsAt: null,
      exclusive: false,
      priority: 100,
    })
  }

  static define(tenant: TenantContext, opts: {
    id: Id
    code: string
    name: string
    kind: PromotionKind
    value: number | string
    actor: ActorContext
    description?: string
    minSubtotal?: number
    maxUses?: number | null
    startsAt?: string | null
    endsAt?: string | null
    exclusive?: boolean
    priority?: number
  }): PromotionAggregate {
    const agg = new PromotionAggregate(tenant)
    agg.initialize(opts.id)
    const code = opts.code.trim().toUpperCase()
    if (!code) throw kernelError("INVALID_PROMOTION", "Code is required")
    if (!opts.name?.trim()) throw kernelError("INVALID_PROMOTION", "Name is required")
    assertValue(opts.kind, opts.value)
    if (opts.minSubtotal != null && opts.minSubtotal < 0) {
      throw kernelError("INVALID_PROMOTION", "Minimum subtotal cannot be negative")
    }
    agg.raise("promotion.defined", {
      code,
      name: opts.name.trim(),
      description: opts.description ?? null,
      kind: opts.kind,
      value: opts.value,
      minSubtotal: opts.minSubtotal ?? 0,
      maxUses: opts.maxUses ?? null,
      usesCount: 0,
      active: true,
      startsAt: opts.startsAt ?? null,
      endsAt: opts.endsAt ?? null,
      exclusive: opts.exclusive ?? false,
      priority: opts.priority ?? 100,
    }, opts.actor)
    return agg
  }

  setActive(actor: ActorContext, active: boolean): void {
    if (active === this.state.active) return
    this.raise(active ? "promotion.activated" : "promotion.deactivated", { active }, actor)
  }

  recordRedemption(actor: ActorContext, orderId: Id): void {
    assertRedeemable(this.state, new Date())
    this.raise("promotion.redeemed", { orderId, usesCount: this.state.usesCount + 1 }, actor)
  }

  protected applyEvent(event: AggregateEvent): PromotionState {
    const s = this.state
    switch (event.eventType) {
      case "promotion.defined":
        return { ...s, ...(event.payload as Partial<PromotionState>) }
      case "promotion.activated":
      case "promotion.deactivated":
        return { ...s, active: Boolean((event.payload as { active: boolean }).active) }
      case "promotion.redeemed":
        return { ...s, usesCount: Number((event.payload as { usesCount: number }).usesCount ?? s.usesCount) }
      default:
        return s
    }
  }
}

export function assertValue(kind: PromotionKind, value: number | string): void {
  if (kind === "percent") {
    if (typeof value !== "number" || !(value > 0) || value > 100) {
      throw kernelError("INVALID_PROMOTION", "Percent must be within (0, 100]")
    }
  } else if (kind === "amount") {
    if (typeof value !== "number" || !(value > 0)) {
      throw kernelError("INVALID_PROMOTION", "Amount must be positive")
    }
  } else if (kind === "freeItem") {
    if (typeof value !== "string" || !value.trim()) {
      throw kernelError("INVALID_PROMOTION", "freeItem value must be a menu item id")
    }
  } else {
    throw kernelError("INVALID_PROMOTION", `Unknown kind "${kind}"`)
  }
}

export function assertRedeemable(state: PromotionState, now: Date): void {
  if (!state.active) throw kernelError("PROMO_INACTIVE", `Promotion ${state.code} is not active`)
  if (state.startsAt && now < new Date(state.startsAt)) throw kernelError("PROMO_INACTIVE", "Promotion has not started")
  if (state.endsAt && now > new Date(state.endsAt)) throw kernelError("PROMO_EXPIRED", "Promotion has ended")
  if (state.maxUses != null && state.usesCount >= state.maxUses) {
    throw kernelError("PROMO_EXHAUSTED", "Promotion usage limit reached")
  }
}

export interface EvaluateInput {
  subtotal: number
  itemPrice?: number
}

/** Pure pricing: returns the money-off for a basket, or the reason it misses. */
export function evaluatePromotion(
  state: PromotionState, input: EvaluateInput, now = new Date(),
): { eligible: boolean; discount: number; reason: string } {
  try {
    assertRedeemable(state, now)
  } catch (e) {
    const err = e as { message?: string }
    return { eligible: false, discount: 0, reason: err.message ?? "Not eligible" }
  }
  if (input.subtotal < state.minSubtotal) {
    return { eligible: false, discount: 0, reason: `Requires subtotal of ${state.minSubtotal}` }
  }
  if (state.kind === "percent") {
    return {
      eligible: true,
      discount: Math.round(input.subtotal * (Number(state.value) / 100) * 100) / 100,
      reason: `${state.value}% off`,
    }
  }
  if (state.kind === "amount") {
    return {
      eligible: true,
      discount: Math.min(Number(state.value), input.subtotal),
      reason: `${state.value} off`,
    }
  }
  const price = Number(input.itemPrice ?? 0)
  if (!(price > 0)) return { eligible: false, discount: 0, reason: "Free-item price unknown for this basket" }
  return { eligible: true, discount: Math.min(price, input.subtotal), reason: "Free item" }
}
