import { NextResponse } from "next/server"
import { sqlWrite, toNum } from "@/lib/db-helpers"

const RECOMMENDATION_COLUMNS = `
  id, title, description, price, image, category, type, available, popular,
  allergens, calories, "preparationMinutes", "spiceLevel", tags, "isChefPick"`

/**
 * "Popular" = sold often, with a chef's picks nudge so a slow-selling venue is
 * not left with an empty rail. Popularity is computed from order history rather
 * than the `popular` flag alone.
 */
export async function GET() {
  try {
    const rows = await sqlWrite(
      `SELECT ${RECOMMENDATION_COLUMNS},
              (SELECT COUNT(*) FROM "OrderItem" oi WHERE oi."menuItemId" = m.id) AS sold
         FROM "MenuItem" m
        WHERE m.available = TRUE
        ORDER BY sold DESC, m.popular DESC, m."sortOrder" ASC
        LIMIT 5`,
    )
    return NextResponse.json(
      rows.map((r) => ({ ...r, price: toNum(r.price) })),
    )
  } catch (error) {
    console.error("[customer/recommendations] popular failed:", error)
    return NextResponse.json({ error: "Failed to fetch popular items" }, { status: 500 })
  }
}

