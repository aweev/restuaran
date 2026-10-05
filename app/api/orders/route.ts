import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { getTokenFromRequest, verifyJWT } from "@/lib/jwt"

export async function GET(req: NextRequest) {
  try {
    // Verify authentication
    const token = getTokenFromRequest(req)
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const payload = await verifyJWT(token)
    if (!payload) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const status = searchParams.get("status")
    const tableId = searchParams.get("tableId")
    const serverId = searchParams.get("serverId")
    const rawLimit = searchParams.get("limit") ? Number.parseInt(searchParams.get("limit")!) : 50
    const limit = Math.min(Math.max(Number.isFinite(rawLimit) ? rawLimit : 50, 1), 100)
    const rawOffset = searchParams.get("offset") ? Number.parseInt(searchParams.get("offset")!) : 0
    const offset = Math.max(Number.isFinite(rawOffset) ? rawOffset : 0, 0)

    let query = `
      SELECT o.*,
        (
          SELECT json_agg(
            json_build_object(
              'id', oi.id,
              'menuItemId', oi."menuItemId",
              'title', oi.title,
              'price', oi.price,
              'quantity', oi.quantity,
              'totalPrice', oi."totalPrice",
              'specialInstructions', oi."specialInstructions",
              'type', oi.type,
              'modifierSelections', (
                SELECT json_agg(
                  json_build_object(
                    'id', ms.id,
                    'modifierId', ms."modifierId",
                    'optionIds', ms."optionIds"
                  )
                )
                FROM "ModifierSelection" ms
                WHERE ms."orderItemId" = oi.id
              )
            )
          )
          FROM "OrderItem" oi
          WHERE oi."orderId" = o.id
        ) as items,
        (
          SELECT json_agg(
            json_build_object(
              'id', p.id,
              'method', p.method,
              'amount', p.amount,
              'reference', p.reference,
              'timestamp', p.timestamp
            )
          )
          FROM "Payment" p
          WHERE p."orderId" = o.id
        ) as payments,
        (
          SELECT row_to_json(t)
          FROM "Table" t
          WHERE t.id = o."tableId"
        ) as table
      FROM "Order" o
      WHERE 1=1
    `

    const params: unknown[] = []
    let paramIndex = 1

    if (status) {
      query += ` AND o.status = $${paramIndex}::${'"OrderStatus"'}`
      params.push(status)
      paramIndex++
    }

    if (tableId) {
      query += ` AND o."tableId" = $${paramIndex}`
      params.push(tableId)
      paramIndex++
    }

    // If not admin or manager, only show orders for the current user
    if (!["admin", "manager"].includes(payload.role as string)) {
      if (payload.role === "server") {
        query += ` AND o."serverId" = $${paramIndex}`
        params.push(payload.sub)
        paramIndex++
      } else if (payload.role === "kitchen") {
        // Kitchen staff can see all pending, preparing, and ready orders
        query += ` AND o.status IN ('pending', 'preparing', 'ready')`
      }
    } else if (serverId) {
      // Admin/manager can filter by server.
      // This was missing its `$` prefix, so it emitted a literal number
      // (`AND o."serverId" = 4`) instead of a placeholder, silently ignoring
      // the filter while still appending a param.
      query += ` AND o."serverId" = $${paramIndex}`
      params.push(serverId)
      paramIndex++
    }

    query += ` ORDER BY o."createdAt" DESC`

    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`
    params.push(limit, offset)

    const orders = await sql.unsafe(query)

    const res = NextResponse.json(Array.isArray(orders) ? orders : [])
    res.headers.set("X-Pagination-Limit", String(limit))
    res.headers.set("X-Pagination-Offset", String(offset))
    return res
  } catch (error) {
    console.error("Error fetching orders:", error)
    return NextResponse.json({ error: "Failed to fetch orders" }, { status: 500 })
  }
}