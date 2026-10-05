import { type NextRequest, NextResponse } from "next/server"
import { one, sqlWrite, toNum, toIso } from "@/lib/db-helpers"

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    const customer = await one(`SELECT * FROM "LoyaltyCustomer" WHERE id = $1`, [id])
    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 })
    }

    const activities = await sqlWrite(
      `SELECT id, type, points, description, timestamp
         FROM "LoyaltyActivity"
        WHERE "customerId" = $1
        ORDER BY timestamp DESC
        LIMIT 10`,
      [id],
    )

    return NextResponse.json({
      ...customer,
      points: toNum(customer.points),
      totalSpent: toNum(customer.totalSpent),
      visitsCount: toNum(customer.visitsCount),
      joinDate: toIso(customer.joinDate),
      lastActivity: toIso(customer.lastActivity),
      activities: activities.map((a) => ({ ...a, points: toNum(a.points), timestamp: toIso(a.timestamp) })),
    })
  } catch (error) {
    console.error("[loyalty] fetch failed:", error)
    return NextResponse.json({ error: "Failed to fetch customer data" }, { status: 500 })
  }
}

