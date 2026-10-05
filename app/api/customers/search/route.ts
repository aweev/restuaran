import { type NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/middleware/auth-middleware"
import { sqlWrite, toNum, toIso } from "@/lib/db-helpers"

/**
 * Server-side search so the omnibar never has to pull the whole customer table
 * to the browser. The previous implementation used Prisma's `mode: "insensitive"`
 * `contains`, which has no plain-SQL equivalent — hence the explicit ILIKE.
 */
export const GET = withAuth(async (req: NextRequest) => {
  try {
    const { searchParams } = new URL(req.url)
    const q = (searchParams.get("q") ?? "").trim()
    const take = Math.min(Number(searchParams.get("take") ?? 20) || 20, 100)

    // Escape LIKE metacharacters so a query of "100%" cannot match everything.
    const escaped = q.replace(/[\\%_]/g, (c) => `\\${c}`)
    const pattern = `%${escaped}%`

    const rows = q
      ? await sqlWrite(
          `SELECT * FROM "Customer"
            WHERE name ILIKE $1 ESCAPE '\\'
               OR email ILIKE $1 ESCAPE '\\'
               OR phone ILIKE $1 ESCAPE '\\'
            ORDER BY LOWER(name) ASC
            LIMIT $2`,
          [pattern, take],
        )
      : await sqlWrite(
          `SELECT * FROM "Customer" ORDER BY LOWER(name) ASC LIMIT $1`,
          [take],
        )

    return NextResponse.json(
      rows.map((r) => ({
        ...r,
        visitCount: toNum(r.visitCount),
        totalSpent: toNum(r.totalSpent),
        lastVisit: toIso(r.lastVisit),
      })),
    )
  } catch (error) {
    console.error("[customers] search failed:", error)
    return NextResponse.json({ error: "Failed to search customers" }, { status: 500 })
  }
})

