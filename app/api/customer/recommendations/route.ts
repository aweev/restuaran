import { type NextRequest, NextResponse } from "next/server"
import { one, sqlWrite, toNum } from "@/lib/db-helpers"

const RECOMMENDATION_COLUMNS = `
  id, title, description, price, image, category, type, available, popular,
  allergens, calories, "preparationMinutes", "spiceLevel", tags, "isChefPick"`

const LIMIT = 5

/**
 * Recommendations for a guest identified by name (their QR session).
 *
 * Strategy: find the categories this guest actually orders from, then surface
 * available items in those categories they have *not* tried. Falls back to
 * chef's picks / best sellers so the rail is never empty.
 *
 * The previous implementation computed `frequentItemIds`, then queried with
 * `id: { in: frequentItemIds }` where that variable was empty (the arrays it
 * built were never bound), and repeated the same interface declaration five
 * times — it silently returned arbitrary items.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const customerName = (searchParams.get("customerId") ?? "").trim()
    if (!customerName) {
      return NextResponse.json({ error: "Customer ID is required" }, { status: 400 })
    }

    const known = await one<{ exists: boolean }>(
      `SELECT EXISTS (SELECT 1 FROM "Customer" WHERE LOWER(name) = LOWER($1)) AS exists`,
      [customerName],
    )
    const name = known?.exists ? customerName : null

    if (name) {
      // What this guest has ordered, and how often.
      const history = await sqlWrite(
        `SELECT oi."menuItemId", COUNT(*) AS n,
                (SELECT category FROM "MenuItem" m WHERE m.id = oi."menuItemId") AS category
           FROM "OrderItem" oi
           JOIN "Order" o ON o.id = oi."orderId"
          WHERE o."customerName" = $1
          GROUP BY oi."menuItemId", category
          ORDER BY n DESC
          LIMIT 20`,
        [name],
      )

      const triedIds = history.map((h) => h.menuItemId as string).filter(Boolean)
      const categories = [...new Set(history.map((h) => h.category as string).filter(Boolean))]

      if (categories.length > 0) {
        const rows = await sqlWrite(
          `SELECT ${RECOMMENDATION_COLUMNS}
             FROM "MenuItem" m
            WHERE m.available = TRUE
              AND m.category = ANY($1::text[])
              AND NOT (m.id = ANY($2::text[]))
            ORDER BY m.popular DESC, m."sortOrder" ASC
            LIMIT $3`,
          [categories, triedIds, LIMIT],
        )
        if (rows.length > 0) {
          return NextResponse.json(
            rows.map((r) => ({ ...r, price: toNum(r.price), reason: "based-on-history" })),
          )
        }
      }
    }

    // Cold start: no history, or nothing untried left in those categories.
    const fallback = await sqlWrite(
      `SELECT ${RECOMMENDATION_COLUMNS},
              (SELECT COUNT(*) FROM "OrderItem" oi WHERE oi."menuItemId" = m.id) AS sold
         FROM "MenuItem" m
        WHERE m.available = TRUE
        ORDER BY m."isChefPick" DESC, sold DESC, m.popular DESC
        LIMIT $1`,
      [LIMIT],
    )
    return NextResponse.json(
      fallback.map((r) => ({ ...r, price: toNum(r.price), reason: "chef-picks" })),
    )
  } catch (error) {
    console.error("[customer/recommendations] failed:", error)
    return NextResponse.json({ error: "Failed to fetch recommendations" }, { status: 500 })
  }
}
