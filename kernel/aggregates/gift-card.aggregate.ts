import { ActorContext, AttributeBag, Id, kernelError, TenantContext } from "@/kernel/types"
import { Aggregate, AggregateEvent } from "./aggregate"

export type GiftCardStatus = "active" | "voided"

export interface GiftCardState extends AttributeBag {
  cardNumber: string
  balance: number
  initialBalance: number
  currency: string
  status: GiftCardStatus
  purchaserCustomerId: Id | null
  recipientEmail: string | null
  issuedAt: string | null
  lastTxAt: string | null
  txCount: number
  voidReason: string | null
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * Stored-value gift card. The balance is recomputed from the event stream on
 * every load — a projected balance that drifts from its ledger is how a venue
 * ends up honouring money it never collected.
 */
export class GiftCardAggregate extends Aggregate<GiftCardState> {
  static readonly TYPE = "GiftCard"

  constructor(tenant: TenantContext) {
    super(GiftCardAggregate.TYPE, tenant, {
      cardNumber: "",
      balance: 0,
      initialBalance: 0,
      currency: "USD",
      status: "active",
      purchaserCustomerId: null,
      recipientEmail: null,
      issuedAt: null,
      lastTxAt: null,
      txCount: 0,
      voidReason: null,
    })
  }

  static issue(tenant: TenantContext, opts: {
    id: Id
    cardNumber: string
    initialBalance: number
    currency?: string
    purchaserCustomerId?: Id
    recipientEmail?: string
    actor: ActorContext
  }): GiftCardAggregate {
    const agg = new GiftCardAggregate(tenant)
    agg.initialize(opts.id)
    if (!opts.cardNumber?.trim()) throw kernelError("INVALID_GIFTCARD", "Card number is required")
    if (!Number.isFinite(opts.initialBalance) || opts.initialBalance <= 0) {
      throw kernelError("INVALID_GIFTCARD", "Initial balance must be positive")
    }
    agg.raise("giftcard.issued", {
      cardNumber: opts.cardNumber.trim().toUpperCase(),
      balance: round2(opts.initialBalance),
      initialBalance: round2(opts.initialBalance),
      currency: opts.currency ?? "USD",
      status: "active" as GiftCardStatus,
      purchaserCustomerId: opts.purchaserCustomerId ?? null,
      recipientEmail: opts.recipientEmail ?? null,
      issuedAt: new Date().toISOString(),
    }, opts.actor)
    return agg
  }

  load(actor: ActorContext, amount: number): void {
    this.assertUsable()
    const value = round2(amount)
    if (!Number.isFinite(value) || value <= 0) throw kernelError("INVALID_GIFTCARD", "Load amount must be positive")
    this.raise("giftcard.loaded", { delta: value, balance: round2(this.state.balance + value) }, actor)
  }

  redeem(actor: ActorContext, orderId: Id, amount: number): void {
    this.assertUsable()
    const value = round2(amount)
    if (!Number.isFinite(value) || value <= 0) throw kernelError("INVALID_GIFTCARD", "Redeem amount must be positive")
    if (value > this.state.balance) {
      throw kernelError("INSUFFICIENT_BALANCE", `Card holds ${this.state.balance}, tried to redeem ${value}`)
    }
    this.raise("giftcard.redeemed", { delta: -value, balance: round2(this.state.balance - value), orderId }, actor)
  }

  refund(actor: ActorContext, orderId: Id, amount: number, reason?: string): void {
    if (this.state.status === "voided") throw kernelError("CARD_VOIDED", "Card is void")
    const value = round2(amount)
    if (!Number.isFinite(value) || value <= 0) throw kernelError("INVALID_GIFTCARD", "Refund amount must be positive")
    this.raise("giftcard.refunded", {
      delta: value, balance: round2(this.state.balance + value), orderId, reason: reason ?? null,
    }, actor)
  }

  void(actor: ActorContext, reason?: string): void {
    if (this.state.status === "voided") throw kernelError("CARD_VOIDED", "Card is already void")
    this.raise("giftcard.voided", { status: "voided" as GiftCardStatus, voidReason: reason ?? null }, actor)
  }

  private assertUsable(): void {
    if (this.state.status === "voided") throw kernelError("CARD_VOIDED", "Card is void")
  }

  protected applyEvent(event: AggregateEvent): GiftCardState {
    const s = this.state
    switch (event.eventType) {
      case "giftcard.issued":
        return { ...s, ...(event.payload as Partial<GiftCardState>), txCount: 1, lastTxAt: event.occurredAt }
      case "giftcard.loaded":
      case "giftcard.redeemed":
      case "giftcard.refunded":
        return {
          ...s,
          balance: Number((event.payload as { balance: number }).balance ?? s.balance),
          txCount: s.txCount + 1,
          lastTxAt: event.occurredAt,
        }
      case "giftcard.voided":
        return { ...s, ...(event.payload as Partial<GiftCardState>), lastTxAt: event.occurredAt }
      default:
        return s
    }
  }
}
