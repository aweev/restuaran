import { kernelError } from "@/kernel/types"
import type { PaymentProvider } from "@/kernel/modules/payments.module"

/**
 * Real Stripe provider (Terminal + PaymentIntents, test mode ready).
 *
 * No card PAN ever touches our systems: the client collects via Stripe
 * Terminal/Stripe.js and hands us a payment-method id; we create and confirm
 * the PaymentIntent server-side. Keys via env:
 *   STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_TERMINAL_LOCATION (optional)
 */
export class StripeTerminalProvider implements PaymentProvider {
  name = "stripe-terminal"

  private get stripe(): {
    paymentIntents: {
      create(p: Record<string, unknown>): Promise<{ id: string; status: string }>
      confirm(id: string, p?: Record<string, unknown>): Promise<{ id: string; status: string }>
      capture(id: string, p?: Record<string, unknown>): Promise<{ id: string; status: string }>
    }
    refunds: { create(p: Record<string, unknown>): Promise<{ id: string }> }
  } {
    const key = process.env.STRIPE_SECRET_KEY
    if (!key) {
      throw kernelError("PAYMENT_NOT_CONFIGURED", "STRIPE_SECRET_KEY is not set")
    }
    // Lazy so kernel boot without the dep installed still works (sim/manual).
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Stripe = require("stripe") as new (key: string) => unknown
    return new Stripe(key) as never
  }

  async authorize(input: {
    paymentId: string
    orderId: string
    amount: number
    method: string
    paymentMethodId?: string
  }): Promise<{ ok: boolean; gatewayRef?: string }> {
    try {
      const stripe = this.stripe
      const amountCents = Math.round(input.amount * 100)
      const intent = await stripe.paymentIntents.create({
        amount: amountCents,
        currency: "usd",
        capture_method: "manual",
        description: `Order ${input.orderId}`,
        metadata: { paymentId: input.paymentId, orderId: input.orderId },
        ...(input.paymentMethodId ? { payment_method: input.paymentMethodId, confirm: true } : {}),
      })
      return { ok: true, gatewayRef: intent.id }
    } catch {
      return { ok: false }
    }
  }

  async capture(input: { paymentId: string; amount: number; gatewayRef?: string }): Promise<{ ok: boolean }> {
    try {
      if (!input.gatewayRef) return false as unknown as { ok: boolean }
      const stripe = this.stripe
      await stripe.paymentIntents.capture(input.gatewayRef)
      return { ok: true }
    } catch {
      return { ok: false }
    }
  }

  async refund(input: { paymentId: string; amount: number; gatewayRef?: string }): Promise<{ ok: boolean }> {
    try {
      const stripe = this.stripe
      await stripe.refunds.create({
        ...(input.gatewayRef ? { payment_intent: input.gatewayRef } : {}),
        amount: Math.round(input.amount * 100),
        metadata: { paymentId: input.paymentId },
      })
      return { ok: true }
    } catch {
      return { ok: false }
    }
  }
}

/**
 * Resolve the active provider from env. Defaults to manual (cash/POS);
 * `ROS_PAYMENT_PROVIDER=stripe-terminal` (with STRIPE_SECRET_KEY) for live cards,
 * `simulated-stripe` for demos/tests.
 */
export function resolveProviderName(): string {
  const raw = (process.env.ROS_PAYMENT_PROVIDER ?? "manual").toLowerCase()
  if (raw === "stripe" || raw === "stripe-terminal") return "stripe-terminal"
  if (raw === "sim" || raw === "simulated-stripe" || raw === "simulated") return "simulated-stripe"
  return "manual"
}
