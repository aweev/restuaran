import { NextResponse } from "next/server"
import { withAuth, type AuthenticatedRequest, type RouteContext } from "@/middleware/auth-middleware"
import { sqlWrite, toNum, toIso } from "@/lib/db-helpers"

type Ctx = RouteContext<{ id: string }>

/**
 * Full order graph.
 *
 * Two corrections against the old Prisma mapping: `Payment` has no `status`
 * column and dates its rows with `timestamp`, not `createdAt`; and `OrderItem`
 * has a `course`, which the kitchen needs and the previous `include` dropped.
 */
const ORDER_WITH_GRAPH = `
  SELECT o.*,
    COALESCE((
      SELECT json_agg(
        json_build_object(
          'id', oi.id, 'menuItemId', oi."menuItemId", 'title', oi.title,
          'price', oi.price, 'quantity', oi.quantity, 'totalPrice', oi."totalPrice",
          'specialInstructions', oi."specialInstructions", 'type', oi.type,
          'course', oi."course", 'sentToKitchenAt', oi."sentToKitchenAt",
          'modifierSelections', COALESCE((
            SELECT json_agg(
              json_build_object('id', ms.id, 'modifierId', ms."modifierId", 'optionIds', ms."optionIds")
            ) FROM "ModifierSelection" ms WHERE ms."orderItemId" = oi.id
          ), '[]'::json)
        ) ORDER BY oi."createdAt"
      ) FROM "OrderItem" oi WHERE oi."orderId" = o.id
    ), '[]'::json) AS items,
    COALESCE((
      SELECT json_agg(
        json_build_object(
          'id', p.id, 'method', p.method, 'amount', p.amount,
          'tip', p.tip, 'reference', p.reference, 'timestamp', p.timestamp
        ) ORDER BY p.timestamp
      ) FROM "Payment" p WHERE p."orderId" = o.id
    ), '[]'::json) AS payments,
    (SELECT row_to_json(t) FROM "Table" t WHERE t.id = o."tableId") AS table
  FROM "Order" o`

/**
 * Not exported: Next validates that a route module only exposes HTTP verb
 * handlers and a known set of config keys, so helper symbols must stay private.
 */
function shapeOrder(row: Record<string, unknown>) {
  return {
    ...row,
    subtotal: toNum(row.subtotal),
    tax: toNum(row.tax),
    discount: toNum(row.discount),
    tip: toNum(row.tip),
    total: toNum(row.total),
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
  }
}

export const GET = withAuth(async (_req: AuthenticatedRequest, { params }: Ctx) => {
  try {
    const { id } = await params
    const rows = await sqlWrite(`${ORDER_WITH_GRAPH} WHERE o.id = $1`, [id])
    const order = rows[0]
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 })
    return NextResponse.json(shapeOrder(order))
  } catch (error) {
    console.error("[orders] fetch failed:", error)
    return NextResponse.json({ error: "Failed to fetch order" }, { status: 500 })
  }
})