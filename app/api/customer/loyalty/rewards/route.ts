import { NextResponse } from "next/server"
import { sqlWrite, toNum } from "@/lib/db-helpers"

export async function GET() {
  try {
    const rows = await sqlWrite(
      `SELECT id, name, description, "pointsCost", available
         FROM "LoyaltyReward"
        WHERE available = TRUE
        ORDER BY "pointsCost" ASC`,
    )
    return NextResponse.json(rows.map((r) => ({ ...r, pointsCost: toNum(r.pointsCost) })))
  } catch (error) {
    console.error("[loyalty] rewards fetch failed:", error)
    return NextResponse.json({ error: "Failed to fetch rewards" }, { status: 500 })
  }
}

