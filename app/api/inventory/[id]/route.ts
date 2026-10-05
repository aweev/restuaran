import { NextResponse } from "next/server"
import { withAuth, type AuthenticatedRequest, type RouteContext } from "@/middleware/auth-middleware"
import { one, sqlWrite, audit, toNum } from "@/lib/db-helpers"
import { z } from "zod"

type Ctx = RouteContext<{ id: string }>

function shape(row: Record<string, unknown>) {
  return {
    ...row,
    currentStock: toNum(row.currentStock),
    reorderLevel: toNum(row.reorderLevel),
    unitCost: toNum(row.unitCost),
  }
}

export const GET = withAuth(async (_req: AuthenticatedRequest, { params }: Ctx) => {
  try {
    const { id } = await params
    const row = await one(`SELECT * FROM "Ingredient" WHERE id = $1`, [id])
    if (!row) return NextResponse.json({ error: "Ingredient not found" }, { status: 404 })
    return NextResponse.json(shape(row))
  } catch (error) {
    console.error("[inventory] fetch failed:", error)
    return NextResponse.json({ error: "Failed to fetch ingredient" }, { status: 500 })
  }
})

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  category: z.string().min(1).optional(),
  unit: z.string().min(1).optional(),
  currentStock: z.number().min(0).optional(),
  reorderLevel: z.number().min(0).optional(),
  unitCost: z.number().min(0).optional(),
  isActive: z.boolean().optional(),
})

export const PUT = withAuth(async (req: AuthenticatedRequest, { params }: Ctx) => {
  try {
    const { id } = await params
    const v = updateSchema.parse(await req.json())

    const existing = await one(`SELECT id FROM "Ingredient" WHERE id = $1`, [id])
    if (!existing) return NextResponse.json({ error: "Ingredient not found" }, { status: 404 })

    const columns: Record<string, unknown> = { ...v }
    const keys = Object.keys(columns).filter((k) => columns[k] !== undefined)
    if (keys.length > 0) {
      const setClause = keys.map((k, i) => `"${k}" = $${i + 2}`).join(", ")
      await sqlWrite(
        `UPDATE "Ingredient" SET ${setClause}, "updatedAt" = NOW() WHERE id = $1`,
        [id, ...keys.map((k) => columns[k])],
      )
    }

    const row = await one(`SELECT * FROM "Ingredient" WHERE id = $1`, [id])
    return NextResponse.json(shape(row ?? {}))
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }
    console.error("[inventory] update failed:", error)
    return NextResponse.json({ error: "Failed to update ingredient" }, { status: 500 })
  }
})

/**
 * PATCH accepts a partial body and builds its SET clause from a *whitelist*.
 *
 * The previous implementation did `${column} = ${value}` with the column name
 * derived from the body key and the value interpolated raw into the SQL string —
 * both halves were attacker-controlled, so this endpoint was directly
 * injectable. Column names can never be parameterised, so they must be selected
 * from a fixed set; values are always bound.
 */
const PATCHABLE = updateSchema

export const PATCH = withAuth(async (req: AuthenticatedRequest, { params }: Ctx) => {
  try {
    const { id } = await params
    const raw = (await req.json()) as Record<string, unknown>
    const v = PATCHABLE.parse(raw)

    const existing = await one(`SELECT id FROM "Ingredient" WHERE id = $1`, [id])
    if (!existing) return NextResponse.json({ error: "Ingredient not found" }, { status: 404 })

    // Reject unknown keys rather than silently ignoring them.
    const unknownKeys = Object.keys(raw).filter((k) => !(k in PATCHABLE.shape))
    if (unknownKeys.length > 0) {
      return NextResponse.json(
        { error: `Unknown field(s): ${unknownKeys.join(", ")}` },
        { status: 400 },
      )
    }

    const columns: Record<string, unknown> = { ...v }
    const keys = Object.keys(columns).filter((k) => columns[k] !== undefined)
    if (keys.length === 0) {
      return NextResponse.json({ error: "No updatable fields provided" }, { status: 400 })
    }

    const setClause = keys.map((k, i) => `"${k}" = $${i + 2}`).join(", ")
    const rows = await sqlWrite(
      `UPDATE "Ingredient" SET ${setClause}, "updatedAt" = NOW() WHERE id = $1 RETURNING *`,
      [id, ...keys.map((k) => columns[k])],
    )

    await audit({
      userId: req.user.sub,
      action: "UPDATE",
      entity: "INGREDIENT",
      entityId: id,
      details: { fields: keys },
    })

    return NextResponse.json(shape(rows[0] ?? {}))
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }
    console.error("[inventory] patch failed:", error)
    return NextResponse.json({ error: "Failed to update ingredient" }, { status: 500 })
  }
})

export const DELETE = withAuth(async (req: AuthenticatedRequest, { params }: Ctx) => {
  try {
    const { id } = await params
    const existing = await one(`SELECT name FROM "Ingredient" WHERE id = $1`, [id])
    if (!existing) return NextResponse.json({ error: "Ingredient not found" }, { status: 404 })

    await sqlWrite(`DELETE FROM "Ingredient" WHERE id = $1`, [id])
    await audit({
      userId: req.user.sub,
      action: "DELETE",
      entity: "INGREDIENT",
      entityId: id,
      details: { name: existing.name },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[inventory] delete failed:", error)
    return NextResponse.json({ error: "Failed to delete ingredient" }, { status: 500 })
  }
})

