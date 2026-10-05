import { NextResponse } from "next/server"
import { withAuth, type AuthenticatedRequest, type RouteContext } from "@/middleware/auth-middleware"
import { one, toIso, toNum } from "@/lib/db-helpers"

/**
 * Next 15 delivers dynamic segment params as the *second* argument of the
 * handler. The previous implementation read `req.params`, which does not exist
 * on a NextRequest, so every PUT/DELETE here threw on the first line and the
 * route only ever returned 500. Params now come from the context, as
 * `withAuth` already threads through.
 */
function shapeTable(row: Record<string, unknown>) {
  return {
    ...row,
    capacity: toNum(row.capacity),
    customerCount: row.customerCount === null ? null : toNum(row.customerCount),
    positionX: toNum(row.positionX),
    positionY: toNum(row.positionY),
    startTime: toIso(row.startTime),
  }
}

export const GET = withAuth(async (_req: AuthenticatedRequest, { params }: RouteContext<{ id: string }>) => {
  try {
    const { id } = await params
    const table = await one(`SELECT * FROM "Table" WHERE id = $1`, [id])
    if (!table) return NextResponse.json({ error: "Table not found" }, { status: 404 })
    return NextResponse.json(shapeTable(table))
  } catch (error) {
    console.error("[tables] fetch failed:", error)
    return NextResponse.json({ error: "Failed to fetch table" }, { status: 500 })
  }
})