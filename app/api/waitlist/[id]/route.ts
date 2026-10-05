import { NextResponse } from "next/server"
import { withAuth, type AuthenticatedRequest, type RouteContext } from "@/middleware/auth-middleware"
import { one, sqlWrite, audit, toNum } from "@/lib/db-helpers"
import { z } from "zod"

type Ctx = RouteContext<{ id: string }>

function shape(row: Record<string, unknown>) {
  return { ...row, partySize: toNum(row.partySize), estimatedWaitTime: toNum(row.estimatedWaitTime) }
}

export const GET = withAuth(async (_req: AuthenticatedRequest, { params }: Ctx) => {
  try {
    const { id } = await params
    const row = await one(`SELECT * FROM "WaitlistEntry" WHERE id = $1`, [id])
    if (!row) return NextResponse.json({ error: "Wait list entry not found" }, { status: 404 })
    return NextResponse.json(shape(row))
  } catch (error) {
    console.error("[waitlist] fetch failed:", error)
    return NextResponse.json({ error: "Failed to fetch wait list entry" }, { status: 500 })
  }
})

const updateSchema = z.object({
  customerName: z.string().min(1).optional(),
  phoneNumber: z.string().optional().nullable(),
  partySize: z.number().int().positive().optional(),
  estimatedWaitTime: z.number().int().min(0).optional(),
  notes: z.string().optional().nullable(),
  notified: z.boolean().optional(),
})

export const PATCH = withAuth(async (req: AuthenticatedRequest, { params }: Ctx) => {
  try {
    const { id } = await params
    const validated = updateSchema.parse(await req.json())

    const existing = await one(`SELECT id FROM "WaitlistEntry" WHERE id = $1`, [id])
    if (!existing) return NextResponse.json({ error: "Wait list entry not found" }, { status: 404 })

    const keys = Object.keys(validated).filter((k) => (validated as Record<string, unknown>)[k] !== undefined)
    if (keys.length > 0) {
      const setClause = keys.map((k, i) => `"${k}" = $${i + 2}`).join(", ")
      await sqlWrite(
        `UPDATE "WaitlistEntry" SET ${setClause} WHERE id = $1`,
        [id, ...keys.map((k) => (validated as Record<string, unknown>)[k])],
      )
    }

    const row = await one(`SELECT * FROM "WaitlistEntry" WHERE id = $1`, [id])
    await audit({
      userId: req.user.sub,
      action: "UPDATE",
      entity: "WAITLIST",
      entityId: id,
      details: { customerName: row?.customerName, notified: row?.notified },
    })

    return NextResponse.json(shape(row ?? {}))
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }
    console.error("[waitlist] update failed:", error)
    return NextResponse.json({ error: "Failed to update wait list entry" }, { status: 500 })
  }
})

export const DELETE = withAuth(async (req: AuthenticatedRequest, { params }: Ctx) => {
  try {
    const { id } = await params
    const existing = await one(`SELECT * FROM "WaitlistEntry" WHERE id = $1`, [id])
    if (!existing) return NextResponse.json({ error: "Wait list entry not found" }, { status: 404 })

    await sqlWrite(`DELETE FROM "WaitlistEntry" WHERE id = $1`, [id])
    await audit({
      userId: req.user.sub,
      action: "DELETE",
      entity: "WAITLIST",
      entityId: id,
      details: { customerName: existing.customerName },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[waitlist] delete failed:", error)
    return NextResponse.json({ error: "Failed to delete wait list entry" }, { status: 500 })
  }
})

