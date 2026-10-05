import { NextResponse } from "next/server"
import { withAuth, type AuthenticatedRequest, type RouteContext } from "@/middleware/auth-middleware"
import { sqlWrite, toNum } from "@/lib/db-helpers"

type Ctx = RouteContext<{ id: string }>

const MENU_ITEM_WITH_MODIFIERS = `
  SELECT m.*,
    COALESCE((
      SELECT json_agg(
        json_build_object(
          'id', mm.id,
          'name', mm.name,
          'required', mm.required,
          'multiple', mm.multiple,
          'maxSelect', mm."maxSelect",
          'options', COALESCE((
            SELECT json_agg(
              json_build_object('id', o.id, 'name', o.name, 'price', o.price, 'isDefault', o."isDefault")
              ORDER BY o."sortOrder"
            ) FROM "MenuItemModifierOption" o WHERE o."modifierId" = mm.id
          ), '[]'::json)
        ) ORDER BY mm."sortOrder"
      ) FROM "MenuItemModifier" mm WHERE mm."menuItemId" = m.id
    ), '[]'::json) AS modifiers
  FROM "MenuItem" m`

function shapeMenuItem(row: Record<string, unknown>) {
  return {
    ...row,
    price: toNum(row.price),
    cost: toNum(row.cost),
    discount: row.discount === null ? null : toNum(row.discount),
    calories: row.calories === null ? null : toNum(row.calories),
    preparationMinutes: toNum(row.preparationMinutes),
    spiceLevel: toNum(row.spiceLevel),
    sortOrder: toNum(row.sortOrder),
  }
}

export const GET = withAuth(async (_req: AuthenticatedRequest, { params }: Ctx) => {
  try {
    const { id } = await params
    const rows = await sqlWrite(`${MENU_ITEM_WITH_MODIFIERS} WHERE m.id = $1`, [id])
    const menuItem = rows[0]
    if (!menuItem) return NextResponse.json({ error: "Menu item not found" }, { status: 404 })
    return NextResponse.json(shapeMenuItem(menuItem))
  } catch (error) {
    console.error("[menu] fetch failed:", error)
    return NextResponse.json({ error: "Failed to fetch menu item" }, { status: 500 })
  }
})