import { type NextRequest, NextResponse } from "next/server"
import { one, toNum, toIso } from "@/lib/db-helpers"

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    const order = await one(
      `SELECT o.*,
              (SELECT row_to_json(t) FROM "Table" t WHERE t.id = o."tableId") AS table,
              (SELECT row_to_json(d) FROM "DeliveryInfo" d WHERE d."orderId" = o.id) AS delivery
         FROM "Order" o WHERE o.id = $1`,
      [id],
    )
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 })

    const items = await one<{ items: unknown }>(
      `SELECT COALESCE((
         SELECT json_agg(
           json_build_object(
             'id', oi.id, 'menuItemId', oi."menuItemId", 'title', oi.title,
             'price', oi.price, 'quantity', oi.quantity, 'totalPrice', oi."totalPrice",
             'specialInstructions', oi."specialInstructions", 'type', oi.type,
             'course', oi."course", 'sentToKitchenAt', oi."sentToKitchenAt",
             'modifierSelections', COALESCE((
               SELECT json_agg(json_build_object('id', ms.id, 'modifierId', ms."modifierId", 'optionIds', ms."optionIds"))
               FROM "ModifierSelection" ms WHERE ms."orderItemId" = oi.id
             ), '[]'::json)
           ) ORDER BY oi."createdAt"
         ) FROM "OrderItem" oi WHERE oi."orderId" = o.id
       ), '[]'::json) AS items
       FROM "Order" o WHERE o.id = $1`,
      [id],
    )

    const payments = await one<{ payments: unknown }>(
      `SELECT COALESCE((
         SELECT json_agg(json_build_object(
           'id', p.id, 'method', p.method, 'amount', p.amount, 'tip', p.tip,
           'reference', p.reference, 'timestamp', p.timestamp
         ) ORDER BY p.timestamp) FROM "Payment" p WHERE p."orderId" = o.id
       ), '[]'::json) AS payments
       FROM "Order" o WHERE o.id = $1`,
      [id],
    )

    return NextResponse.json({
      ...order,
      subtotal: toNum(order.subtotal),
      tax: toNum(order.tax),
      discount: toNum(order.discount),
      tip: toNum(order.tip),
      total: toNum(order.total),
      createdAt: toIso(order.createdAt),
      updatedAt: toIso(order.updatedAt),
      items: items?.items ?? [],
      payments: payments?.payments ?? [],
    })
  } catch (error) {
    console.error("[customer/orders] fetch failed:", error)
    return NextResponse.json({ error: "Failed to fetch order" }, { status: 500 })
  }
}

