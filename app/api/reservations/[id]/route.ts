import { NextResponse } from "next/server"
import { withAuth, type AuthenticatedRequest, type RouteContext } from "@/middleware/auth-middleware"
import { one, sqlWrite, audit, toNum, toIso } from "@/lib/db-helpers"
import { emitToRoom } from "@/lib/socket-registry"
import { z } from "zod"

type Ctx = RouteContext<{ id: string }>

function shape(row: Record<string, unknown>) {
  return {
    ...row,
    partySize: toNum(row.partySize),
    date: typeof row.date === "string" ? row.date.slice(0, 10) : row.date,
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
  }
}

export const GET = withAuth(async (_req: AuthenticatedRequest, { params }: Ctx) => {
  try {
    const { id } = await params
    const row = await one(`SELECT * FROM "Reservation" WHERE id = $1`, [id])
    if (!row) return NextResponse.json({ error: "Reservation not found" }, { status: 404 })
    return NextResponse.json(shape(row))
  } catch (error) {
    console.error("[reservations] fetch failed:", error)
    return NextResponse.json({ error: "Failed to fetch reservation" }, { status: 500 })
  }
})

const STATUSES = ["pending", "confirmed", "seated", "completed", "cancelled", "no_show"] as const

const updateSchema = z.object({
  customerName: z.string().min(1).optional(),
  phone: z.string().nullable().optional(),
  email: z.string().email().nullable().optional(),
  partySize: z.number().int().positive().optional(),
  tableId: z.string().nullable().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD").optional(),
  time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, "Expected HH:MM").optional(),
  status: z.enum(STATUSES).optional(),
  notes: z.string().nullable().optional(),
})

/** PATCH body keys are whitelisted; see the note on inventory/[id] PATCH. */
const PATCHABLE = updateSchema

function toColumns(v: z.infer<typeof updateSchema>, startIndex: number) {
  const columns: Record<string, unknown> = { ...v }
  const keys = Object.keys(columns).filter((k) => columns[k] !== undefined)
  const setClause = keys.map((k, i) => `"${k}" = $${i + startIndex}`).join(", ")
  return { setClause, values: keys.map((k) => columns[k]), keys }
}

export const PUT = withAuth(async (req: AuthenticatedRequest, { params }: Ctx) => {
  try {
    const { id } = await params
    const v = updateSchema.parse(await req.json())

    const existing = await one(`SELECT id FROM "Reservation" WHERE id = $1`, [id])
    if (!existing) return NextResponse.json({ error: "Reservation not found" }, { status: 404 })

    const { setClause, values, keys } = toColumns(v, 2)
    const rows = keys.length
      ? await sqlWrite(
          `UPDATE "Reservation" SET ${setClause}, "updatedAt" = NOW() WHERE id = $1 RETURNING *`,
          [id, ...values],
        )
      : [existing]

    const updated = shape(rows[0] ?? {})
    emitToRoom("global", "reservation:update", updated)
    return NextResponse.json(updated)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }
    console.error("[reservations] update failed:", error)
    return NextResponse.json({ error: "Failed to update reservation" }, { status: 500 })
  }
})

export const PATCH = withAuth(async (req: AuthenticatedRequest, { params }: Ctx) => {
  try {
    const { id } = await params
    const raw = (await req.json()) as Record<string, unknown>
    const v = PATCHABLE.parse(raw)

    const existing = await one(`SELECT id FROM "Reservation" WHERE id = $1`, [id])
    if (!existing) return NextResponse.json({ error: "Reservation not found" }, { status: 404 })

    const unknownKeys = Object.keys(raw).filter((k) => !(k in PATCHABLE.shape))
    if (unknownKeys.length > 0) {
      return NextResponse.json(
        { error: `Unknown field(s): ${unknownKeys.join(", ")}` },
        { status: 400 },
      )
    }

    const { setClause, values, keys } = toColumns(v, 2)
    if (keys.length === 0) {
      return NextResponse.json({ error: "No updatable fields provided" }, { status: 400 })
    }

    const rows = await sqlWrite(
      `UPDATE "Reservation" SET ${setClause}, "updatedAt" = NOW() WHERE id = $1 RETURNING *`,
      [id, ...values],
    )

    const updated = shape(rows[0] ?? {})
    emitToRoom("global", "reservation:update", updated)
    return NextResponse.json(updated)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }
    console.error("[reservations] patch failed:", error)
    return NextResponse.json({ error: "Failed to update reservation" }, { status: 500 })
  }
})

export const DELETE = withAuth(async (req: AuthenticatedRequest, { params }: Ctx) => {
  try {
    const { id } = await params
    const existing = await one(`SELECT "customerName" FROM "Reservation" WHERE id = $1`, [id])
    if (!existing) return NextResponse.json({ error: "Reservation not found" }, { status: 404 })

    await sqlWrite(`DELETE FROM "Reservation" WHERE id = $1`, [id])
    emitToRoom("global", "reservation:delete", { id })

    await audit({
      userId: req.user.sub,
      action: "DELETE",
      entity: "RESERVATION",
      entityId: id,
      details: { customerName: existing.customerName },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[reservations] delete failed:", error)
    return NextResponse.json({ error: "Failed to delete reservation" }, { status: 500 })
  }
})

