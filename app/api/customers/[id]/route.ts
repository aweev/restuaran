import { NextResponse } from "next/server"
import { withAuth, type AuthenticatedRequest, type RouteContext } from "@/middleware/auth-middleware"
import { one, sqlWrite, audit, toNum, toIso } from "@/lib/db-helpers"
import { z } from "zod"

type Ctx = RouteContext<{ id: string }>

function shape(row: Record<string, unknown>) {
  return {
    ...row,
    visitCount: toNum(row.visitCount),
    totalSpent: toNum(row.totalSpent),
    lastVisit: toIso(row.lastVisit),
  }
}

export const GET = withAuth(async (_req: AuthenticatedRequest, { params }: Ctx) => {
  try {
    const { id } = await params
    const row = await one(`SELECT * FROM "Customer" WHERE id = $1`, [id])
    if (!row) return NextResponse.json({ error: "Customer not found" }, { status: 404 })
    return NextResponse.json(shape(row))
  } catch (error) {
    console.error("[customers] fetch failed:", error)
    return NextResponse.json({ error: "Failed to fetch customer" }, { status: 500 })
  }
})

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  allergies: z.string().optional().nullable(),
  dietaryRestrictions: z.string().optional().nullable(),
  favoriteItems: z.string().optional().nullable(),
  seatingPreferences: z.string().optional().nullable(),
  visitCount: z.number().int().min(0).optional(),
  lastVisit: z.string().datetime().optional().nullable(),
  totalSpent: z.number().min(0).optional(),
})

export const PUT = withAuth(async (req: AuthenticatedRequest, { params }: Ctx) => {
  try {
    const { id } = await params
    const validated = updateSchema.parse(await req.json())

    const existing = await one(`SELECT id FROM "Customer" WHERE id = $1`, [id])
    if (!existing) return NextResponse.json({ error: "Customer not found" }, { status: 404 })

    const columns: Record<string, unknown> = { ...validated }
    if (typeof columns.lastVisit === "string") columns.lastVisit = new Date(columns.lastVisit)

    const keys = Object.keys(columns).filter((k) => columns[k] !== undefined)
    if (keys.length > 0) {
      const setClause = keys.map((k, i) => `"${k}" = $${i + 2}`).join(", ")
      await sqlWrite(
        `UPDATE "Customer" SET ${setClause}, "updatedAt" = NOW() WHERE id = $1`,
        [id, ...keys.map((k) => columns[k])],
      )
    }

    const row = await one(`SELECT * FROM "Customer" WHERE id = $1`, [id])
    await audit({
      userId: req.user.sub,
      action: "UPDATE",
      entity: "CUSTOMER",
      entityId: id,
      details: { name: row?.name },
    })

    return NextResponse.json(shape(row ?? {}))
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }
    console.error("[customers] update failed:", error)
    return NextResponse.json({ error: "Failed to update customer" }, { status: 500 })
  }
})

export const DELETE = withAuth(async (req: AuthenticatedRequest, { params }: Ctx) => {
  try {
    const { id } = await params
    const existing = await one(`SELECT id, name FROM "Customer" WHERE id = $1`, [id])
    if (!existing) return NextResponse.json({ error: "Customer not found" }, { status: 404 })

    await sqlWrite(`DELETE FROM "Customer" WHERE id = $1`, [id])
    await audit({
      userId: req.user.sub,
      action: "DELETE",
      entity: "CUSTOMER",
      entityId: id,
      details: { name: existing.name },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[customers] delete failed:", error)
    return NextResponse.json({ error: "Failed to delete customer" }, { status: 500 })
  }
})

