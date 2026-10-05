import { NextResponse } from "next/server"
import { withAuth, type AuthenticatedRequest, type RouteContext } from "@/middleware/auth-middleware"
import { sqlWrite, toNum, toIso } from "@/lib/db-helpers"

type Ctx = RouteContext<{ id: string }>

function shape(row: Record<string, unknown>) {
  return { ...row, amount: toNum(row.amount), tip: toNum(row.tip), timestamp: toIso(row.timestamp) }
}

export const GET = withAuth(async (_req: AuthenticatedRequest, { params }: Ctx) => {
  try {
    const { id } = await params
    const rows = await sqlWrite(
      `SELECT * FROM "Payment" WHERE "orderId" = $1 ORDER BY timestamp DESC`,
      [id],
    )
    return NextResponse.json(rows.map(shape))
  } catch (error) {
    console.error("[payments] fetch failed:", error)
    return NextResponse.json({ error: "Failed to fetch payments" }, { status: 500 })
  }
})