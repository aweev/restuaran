import { type NextRequest, NextResponse } from "next/server"
import { systemActor } from "@/kernel/tenant/tenant"
import { getKernel } from "@/kernel/server/kernel-singleton"

export const runtime = "nodejs"

/**
 * Stripe webhook: signature-verified, idempotent via Stripe event id as the
 * kernel requestId (replayed deliveries collapse to the same command).
 * Handles payment_intent.succeeded (capture) and charge.refunded (refund).
 */
export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) return NextResponse.json({ error: "Webhooks not configured" }, { status: 503 })
  const sig = req.headers.get("stripe-signature")
  if (!sig) return NextResponse.json({ error: "Missing signature" }, { status: 400 })
  const raw = await req.text()

  let event: { id: string; type: string; data: { object: Record<string, unknown> } }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Stripe = require("stripe") as new (k: string) => {
      webhooks: { constructEvent(raw: string, sig: string, secret: string): unknown }
    }
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "")
    event = stripe.webhooks.constructEvent(raw, sig, secret) as never
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
  }

  const kernel = await getKernel()
  const actor = systemActor({ userId: "system:stripe-webhook" })
  const obj = event.data.object
  const paymentId =
    ((obj.metadata as Record<string, unknown> | undefined)?.paymentId as string | undefined) ??
    (obj.id as string | undefined)
  if (!paymentId) return NextResponse.json({ received: true })

  if (event.type === "payment_intent.succeeded") {
    await kernel.execute("payment.capture", { paymentId }, actor, `stripe:${event.id}`)
  } else if (event.type === "charge.refunded") {
    const amount = (obj.amount_refunded as number | undefined) ?? undefined
    await kernel.execute(
      "payment.refund",
      { paymentId, ...(amount != null ? { amount: amount / 100 } : {}) },
      actor,
      `stripe:${event.id}`,
    )
  }
  return NextResponse.json({ received: true })
}
