import { NextResponse } from "next/server"
import { withAuth } from "@/middleware/auth-middleware"
import { sqlWrite, audit, toNum } from "@/lib/db-helpers"
import { z } from "zod"

function shape(row: Record<string, unknown>) {
  const currentStock = toNum(row.currentStock)
  const reorderLevel = toNum(row.reorderLevel)
  return {
    ...row,
    currentStock,
    reorderLevel,
    unitCost: toNum(row.unitCost),
    /** Surfaced so the UI can flag low stock without re-deriving the rule. */
    lowStock: currentStock <= reorderLevel,
  }
}

export const GET = withAuth(async () => {
  try {
    const rows = await sqlWrite(
      `SELECT * FROM "Ingredient" WHERE "isActive" = TRUE ORDER BY LOWER(name) ASC`,
    )
    return NextResponse.json(rows.map(shape))
  } catch (error) {
    console.error("[inventory] list failed:", error)
    return NextResponse.json({ error: "Failed to fetch ingredients" }, { status: 500 })
  }
})

const createSchema = z.object({
  name: z.string().min(1, "Ingredient name is required"),
  category: z.string().min(1).default("general"),
  unit: z.string().min(1).default("ea"),
  currentStock: z.number().min(0).default(0),
  reorderLevel: z.number().min(0).default(0),
  unitCost: z.number().min(0).default(0),
  isActive: z.boolean().default(true),
})

export const POST = withAuth(async (req) => {
  try {
    const v = createSchema.parse(await req.json())
    const id = crypto.randomUUID()

    const rows = await sqlWrite(
      `INSERT INTO "Ingredient"
         (id, name, category, unit, "currentStock", "reorderLevel", "unitCost", "isActive")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING *`,
      [id, v.name, v.category, v.unit, v.currentStock, v.reorderLevel, v.unitCost, v.isActive],
    )

    await audit({
      userId: req.user.sub,
      action: "CREATE",
      entity: "INGREDIENT",
      entityId: id,
      details: { name: v.name },
    })

    return NextResponse.json(shape(rows[0] ?? {}), { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }
    console.error("[inventory] create failed:", error)
    return NextResponse.json({ error: "Failed to create ingredient" }, { status: 500 })
  }
})
