import { type NextRequest, NextResponse } from "next/server"
import { sqlWrite, audit } from "@/lib/db-helpers"
import { z } from "zod"

/** Public by design: a guest rating an experience on their own phone. */
const feedbackSchema = z.object({
  orderId: z.string().nullable().optional(),
  tableNumber: z.string().nullable().optional(),
  rating: z.number().int().min(1).max(5),
  foodQuality: z.number().int().min(1).max(5).nullable().optional(),
  serviceQuality: z.number().int().min(1).max(5).nullable().optional(),
  ambience: z.number().int().min(1).max(5).nullable().optional(),
  comments: z.string().max(2000).optional(),
  timestamp: z.string().datetime().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const v = feedbackSchema.parse(await req.json())
    const id = crypto.randomUUID()

    await sqlWrite(
      `INSERT INTO "Feedback"
         (id, "orderId", "tableId", rating, "foodQuality", "serviceQuality", ambience, comments, timestamp)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,COALESCE($9::timestamptz, NOW()))
       RETURNING id`,
      [
        id,
        v.orderId ?? null,
        v.tableNumber ?? null,
        v.rating,
        v.foodQuality ?? null,
        v.serviceQuality ?? null,
        v.ambience ?? null,
        v.comments ?? null,
        v.timestamp ?? null,
      ],
    )

    await audit({
      userId: null,
      action: "CREATE",
      entity: "FEEDBACK",
      entityId: id,
      details: { orderId: v.orderId, tableId: v.tableNumber, rating: v.rating },
    })

    return NextResponse.json({ success: true, id }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }
    console.error("[feedback] submit failed:", error)
    return NextResponse.json({ error: "Failed to submit feedback" }, { status: 500 })
  }
}

