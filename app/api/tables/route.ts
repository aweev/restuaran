import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get("status")

    let query = `SELECT * FROM "Table"`
    const params: unknown[] = []

    if (status) {
      query += ` WHERE status = $1::${'"TableStatus"'}`
      params.push(status)
    }

    query += ` ORDER BY number ASC`

    const tables = await sql.unsafe(
      params.length > 0 ? query.replace("$1", `'${params[0]}'`) : query
    )

    return NextResponse.json(tables)
  } catch (error) {
    console.error("Error fetching tables:", error)
    return NextResponse.json({ error: "Failed to fetch tables" }, { status: 500 })
  }
}