import { ActorContext, AttributeBag, Id, kernelError, TenantContext } from "@/kernel/types"
import { Aggregate, AggregateEvent } from "./aggregate"

export type PaymentStatus = "authorized" | "captured" | "partially_refunded" | "refunded" | "voided"

export interface PaymentState extends AttributeBag {
  paymentId: string
  orderId: Id
  amount: number
  /** Integer minor units (cents) — the authoritative money field. */
  amountCents: number
  capturedAmount: number
  refundedAmount: number
  method: string
  gateway: string
  /** Provider reference (e.g. Stripe pi_xxx). Undefined for manual/cash. */
  gatewayRef?: string
  status: PaymentStatus
}

const emptyPayment: PaymentState = {
  paymentId: "",
  orderId: "",
  amount: 0,
  amountCents: 0,
  capturedAmount: 0,
  refundedAmount: 0,
  method: "",
  gateway: "manual",
  gatewayRef: undefined,
  status: "authorized",
}

export class PaymentIntentAggregate extends Aggregate<PaymentState> {
  static readonly TYPE = "PaymentIntent"

  constructor(tenant: TenantContext) {
    super(PaymentIntentAggregate.TYPE, tenant, { ...emptyPayment })
  }

  static authorize(
    tenant: TenantContext,
    opts: { id: Id; orderId: Id; amount: number; method: string; gateway?: string; gatewayRef?: string; actor: ActorContext },
  ): PaymentIntentAggregate {
    if (!Number.isFinite(opts.amount) || opts.amount <= 0) {
      throw kernelError("INVALID_PAYMENT", "Payment amount must be positive")
    }
    const agg = new PaymentIntentAggregate(tenant)
    agg.initialize(opts.id)
    agg.raise(
      "payment.authorized",
      { paymentId: opts.id, orderId: opts.orderId, amount: opts.amount, amountCents: Math.round(opts.amount * 100), method: opts.method, gateway: opts.gateway ?? "manual", gatewayRef: opts.gatewayRef ?? null },
      opts.actor,
    )
    return agg
  }

  capture(actor: ActorContext): void {
    if (this.state.status !== "authorized") throw kernelError("BAD_PAYMENT_STATE", `Cannot capture from ${this.state.status}`)
    this.raise("payment.captured", { paymentId: this.id, amount: this.state.amount }, actor)
  }

  refund(actor: ActorContext, amount?: number): void {
    if (this.state.status !== "captured" && this.state.status !== "partially_refunded") {
      throw kernelError("BAD_PAYMENT_STATE", `Cannot refund from ${this.state.status}`)
    }
    const amt = amount ?? this.state.capturedAmount - this.state.refundedAmount
    if (!Number.isFinite(amt) || amt <= 0) throw kernelError("INVALID_REFUND", "Refund amount must be positive")
    if (amt - 1e-9 > this.state.capturedAmount - this.state.refundedAmount) {
      throw kernelError("REFUND_EXCEEDS_CAPTURED", "Refund exceeds captured amount")
    }
    this.raise("payment.refunded", { paymentId: this.id, amount: amt }, actor)
  }

  voidAuth(actor: ActorContext, reason: string): void {
    if (this.state.status !== "authorized") throw kernelError("BAD_PAYMENT_STATE", `Cannot void from ${this.state.status}`)
    this.raise("payment.voided", { paymentId: this.id, reason }, actor)
  }

  protected applyEvent(event: AggregateEvent): PaymentState {
    const s = this.state
    switch (event.eventType) {
      case "payment.authorized":
        return {
          ...s,
          paymentId: String(event.payload.paymentId ?? this.id),
          orderId: String(event.payload.orderId ?? ""),
          amount: Number(event.payload.amount ?? 0),
          amountCents: Number(event.payload.amountCents ?? Math.round(Number(event.payload.amount ?? 0) * 100)),
          method: String(event.payload.method ?? ""),
          gateway: String(event.payload.gateway ?? "manual"),
          gatewayRef: (event.payload.gatewayRef as string | null) ?? undefined,
          status: "authorized",
        }
      case "payment.captured":
        return { ...s, capturedAmount: Number(event.payload.amount ?? s.amount), status: "captured" }
      case "payment.refunded": {
        const refunded = s.refundedAmount + Number(event.payload.amount ?? 0)
        const fully = refunded + 1e-9 >= s.capturedAmount
        return { ...s, refundedAmount: refunded, status: fully ? "refunded" : "partially_refunded" }
      }
      case "payment.voided":
        return { ...s, status: "voided" }
      default:
        return s
    }
  }
}
