import { type NextRequest, NextResponse } from "next/server"
import { one, sqlWrite, audit } from "@/lib/db-helpers"
import { z } from "zod"

const deliverySchema = z.object({
  provider: z.enum(["doordash", "ubereats", "grubhub", "restaurant"]),
  address: z.object({
    street: z.string().min(1),
    city: z.string().min(1),
    state: z.string().min(1),
    zipCode: z.string().min(1),
    instructions: z.string().optional(),
  }),
})

const ETA_MINUTES = 45

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const v = deliverySchema.parse(await req.json())

    const order = await one(`SELECT id FROM "Order" WHERE id = $1`, [id])
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 })

    await sqlWrite("BEGIN")
    try {
      await sqlWrite(
        `UPDATE "Order" SET "diningMode" = 'Delivery', "updatedAt" = NOW() WHERE id = $1`,
        [id],
      )
      await sqlWrite(
        `INSERT INTO "DeliveryInfo"
           (id, "orderId", provider, status, street, city, state, "zipCode", instructions,
            "estimatedDeliveryTime")
         VALUES ($1,$2,$3,'pending',$4,$5,$6,$7,$8, NOW() + ($9 || ' minutes')::interval)
         ON CONFLICT ("orderId")
         DO UPDATE SET provider = EXCLUDED.provider, status = 'pending',
                       street = EXCLUDED.street, city = EXCLUDED.city, state = EXCLUDED.state,
                       "zipCode" = EXCLUDED."zipCode", instructions = EXCLUDED.instructions,
                       "estimatedDeliveryTime" = EXCLUDED."estimatedDeliveryTime",
                       "updatedAt" = NOW()`,
        [
          crypto.randomUUID(), id, v.provider, v.address.street, v.address.city,
          v.address.state, v.address.zipCode, v.address.instructions ?? null,
          String(ETA_MINUTES),
        ],
      )
      await sqlWrite("COMMIT")
    } catch (txErr) {
      await sqlWrite("ROLLBACK").catch(() => undefined)
      throw txErr
    }

    await audit({
      userId: null,
      action: "UPDATE",
      entity: "ORDER",
      entityId: id,
      details: { update: "delivery_setup", provider: v.provider },
    })

    // Third-party tracking is not wired to a live provider yet; the redirect is
    // a placeholder the client treats as optional.
    const redirectUrl =
      v.provider === "restaurant" ? null : `https://${v.provider}.com/tracking?orderId=${id}`

    return NextResponse.json({ success: true, provider: v.provider, redirectUrl })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }
    console.error("[customer/delivery] setup failed:", error)
    return NextResponse.json({ error: "Failed to set up delivery" }, { status: 500 })
  }
}

