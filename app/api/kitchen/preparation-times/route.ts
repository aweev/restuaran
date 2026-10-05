import { type NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/middleware/auth-middleware"
import { sqlWrite, toNum } from "@/lib/db-helpers"
import { z } from "zod"

/**
 * Ticket targets, returned as `{ [menuItemId]: minutes }` to match the shape the
 * KDS client already consumes. Sourced from "PreparationTime" (the promise made
 * per item) rather than being recomputed from the menu.
 */
export const GET = withAuth(async () => {
  try {
    const rows = await sqlWrite(`SELECT "menuItemId", "timeInMinutes" FROM "PreparationTime"`)
    const map: Record<string, number> = {}
    for (const r of rows) {
      map[String(r.menuItemId)] = toNum(r.timeInMinutes)
    }
    return NextResponse.json(map)
  } catch (error) {
    console.error("[kitchen] prep times fetch failed:", error)
    return NextResponse.json({ error: "Failed to fetch preparation times" }, { status: 500 })
  }
})

const prepTimeSchema = z.object({
  menuItemId: z.string().min(1),
  time: z.number().int().min(1).max(120),
})

export const POST = withAuth(async (req: NextRequest) => {
  try {
    const v = prepTimeSchema.parse(await req.json())

    const item = await sqlWrite(`SELECT id FROM "MenuItem" WHERE id = $1`, [v.menuItemId])
    if (item.length === 0) {
      return NextResponse.json({ error: "Menu item not found" }, { status: 404 })
    }

    const rows = await sqlWrite(
      `INSERT INTO "PreparationTime" ("menuItemId", "timeInMinutes")
       VALUES ($1, $2)
       ON CONFLICT ("menuItemId")
       DO UPDATE SET "timeInMinutes" = EXCLUDED."timeInMinutes"
       RETURNING *`,
      [v.menuItemId, v.time],
    )

    return NextResponse.json(rows[0] ?? {})
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }
    console.error("[kitchen] prep times upsert failed:", error)
    return NextResponse.json({ error: "Failed to create/update preparation time" }, { status: 500 })
  }
})

