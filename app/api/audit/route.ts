import { type NextRequest, NextResponse } from "next/server"
import { getTokenFromRequest, verifyAccessToken } from "@/lib/jwt"
import { actorFromAuthPayload } from "@/kernel/tenant/permission-map"
import { many } from "@/lib/db-helpers"

export const runtime = "nodejs"

/**
 * Money-trail reader. The kernel writes every financial event to AuditLog
 * best-effort (see kernel/index.ts money-audit hook); this is the screen
 * managers use to answer "who voided / comped / refunded what, when".
 * Gated by audit:view. Fails closed with an error — never an empty list
 * masquerading as "nothing happened".
 */
export async function GET(req: NextRequest) {
  const token = getTokenFromRequest(req)
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  let payload: { sub: string; role?: string; permissions?: string[] }
  try {
    const verified = await verifyAccessToken(token)
    if (!verified) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    payload = verified as never
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const actor = actorFromAuthPayload(payload)
  if (!actor.permissions.includes("audit:view")) {
    return NextResponse.json({ error: "Missing permission audit:view" }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const limit = Math.min(Math.max(Number(searchParams.get("limit")) || 100, 1), 500)
  const action = (searchParams.get("action") || "").trim()
  const q = (searchParams.get("q") || "").trim()

  const where: string[] = []
  const params: unknown[] = []
  if (action) {
    params.push(action)
    where.push(`action = $${params.length}`)
  }
  if (q) {
    params.push(`%${q}%`)
    const i = params.length
    where.push(`("entityId" ILIKE $${i} OR "userId" ILIKE $${i} OR details::text ILIKE $${i})`)
  }
  params.push(limit)
  try {
    const rows = await many(
      `SELECT id, "userId", action, entity, "entityId", details, timestamp
       FROM "AuditLog"
       ${where.length > 0 ? `WHERE ${where.join(" AND ")}` : ""}
       ORDER BY timestamp DESC
       LIMIT $${params.length}`,
      params,
    )
    return NextResponse.json({ rows })
  } catch (err) {
    return NextResponse.json(
      { error: "Audit store unavailable", detail: err instanceof Error ? err.message : undefined },
      { status: 503 },
    )
  }
}
