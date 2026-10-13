import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { randomUUID } from "crypto"
import { getTokenFromRequest, verifyAccessToken } from "@/lib/jwt"
import { actorFromAuthPayload } from "@/kernel/tenant/permission-map"
import { getKernel } from "@/kernel/server/kernel-singleton"

export const runtime = "nodejs"

const bodySchema = z.object({
  orderId: z.string().min(1),
  amount: z.number().positive(),
  method: z.string().min(1).default("card"),
  /** Stripe payment-method id from Terminal / Stripe.js. Optional in test mode. */
  paymentMethodId: z.string().min(1).optional(),
  paymentId: z.string().min(1).optional(),
})

/**
 * Authorize a card payment server-side (Stripe PaymentIntent with manual
 * capture). Never accepts PANs — only a Stripe payment-method id.
 * Idempotent: pass paymentId to safely retry.
 */
export async function POST(req: NextRequest) {
  const token = getTokenFromRequest(req)
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  let payload: { sub: string; role?: string; permissions?: string[] }
  try {
    const verified = await verifyAccessToken(token)
    if (!verified) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    payload = verified as never
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const actor = actorFromAuthPayload(payload)
  if (!actor.permissions.includes("order:pay")) {
    return NextResponse.json({ error: "Missing permission order:pay" }, { status: 403 })
  }
  const body = bodySchema.safeParse(await req.json().catch(() => ({})))
  if (!body.success) {
    return NextResponse.json({ error: "Invalid payload", issues: body.error.issues }, { status: 400 })
  }
  const kernel = await getKernel()
  const paymentId = body.data.paymentId ?? randomUUID()
  const result = await kernel.execute(
    "payment.authorize",
    {
      paymentId,
      orderId: body.data.orderId,
      amount: body.data.amount,
      method: body.data.method,
      ...(body.data.paymentMethodId ? { paymentMethodId: body.data.paymentMethodId } : {}),
    },
    actor,
    paymentId,
  )
  if (!result.success) {
    return NextResponse.json({ error: result.error.message, code: result.error.code }, { status: 402 })
  }
  return NextResponse.json({ paymentId: result.aggregateId ?? paymentId })
}
