import { type NextRequest, NextResponse } from "next/server"
import { many } from "@/lib/db-helpers"
import { getTokenFromRequest, verifyAccessToken } from "@/lib/jwt"

const MANAGERS = new Set(["admin", "manager", "owner"])

/**
 * Real staff roster for managers (replaces the old mock list). Returns id,
 * name, email, role, active flag and whether a login PIN is set — never
 * password or PIN hashes.
 */
export async function GET(req: NextRequest) {
  const token = getTokenFromRequest(req)
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const caller = await verifyAccessToken(token)
  if (!caller) return NextResponse.json({ error: "Invalid token" }, { status: 401 })
  if (!MANAGERS.has(String(caller.role ?? ""))) {
    return NextResponse.json({ error: "Managers only" }, { status: 403 })
  }
  const rows = await many(
    `SELECT id, name, email, role, "isActive", ("pinHash" IS NOT NULL) AS "hasPin",
            ("pinLockedUntil" IS NOT NULL AND "pinLockedUntil" > NOW()) AS "pinLocked"
     FROM "User" ORDER BY name ASC`,
  )
  return NextResponse.json(rows)
}
