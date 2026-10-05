import { NextResponse } from "next/server"
import { withAuth, type AuthenticatedRequest } from "@/middleware/auth-middleware"
import { sqlWrite, audit, toNum } from "@/lib/db-helpers"
import { z } from "zod"

function shape(row: Record<string, unknown>) {
  return { ...row, partySize: toNum(row.partySize), estimatedWaitTime: toNum(row.estimatedWaitTime) }
}

export const GET = withAuth(async () => {
  try {
    const rows = await sqlWrite(`SELECT * FROM "WaitlistEntry" ORDER BY "createdAt" ASC`)
    return NextResponse.json(rows.map(shape))
  } catch (error) {
    console.error("[waitlist] list failed:", error)
    return NextResponse.json({ error: "Failed to fetch wait list" }, { status: 500 })
  }
})

const createSchema = z.object({
  customerName: z.string().min(1, "Customer name is required"),
  phoneNumber: z.string().optional(),
  partySize: z.number().int().positive(),
  estimatedWaitTime: z.number().int().min(0),
  notes: z.string().optional(),
})

export const POST = withAuth(async (req: AuthenticatedRequest) => {
  try {
    const validated = createSchema.parse(await req.json())
    const id = crypto.randomUUID()

    const rows = await sqlWrite(
      `INSERT INTO "WaitlistEntry"
         (id, "customerName", "phoneNumber", "partySize", "estimatedWaitTime", notes, notified)
       VALUES ($1,$2,$3,$4,$5,$6,FALSE)
       RETURNING *`,
      [
        id,
        validated.customerName,
        validated.phoneNumber || null,
        validated.partySize,
        validated.estimatedWaitTime,
        validated.notes || null,
      ],
    )

    await audit({
      userId: req.user.sub,
      action: "CREATE",
      entity: "WAITLIST",
      entityId: id,
      details: { customerName: validated.customerName, partySize: validated.partySize },
    })

    return NextResponse.json(shape(rows[0] ?? {}), { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }
    console.error("[waitlist] create failed:", error)
    return NextResponse.json({ error: "Failed to create wait list entry" }, { status: 500 })
  }
})

