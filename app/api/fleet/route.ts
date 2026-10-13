import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { many, sqlWrite } from "@/lib/db-helpers"
import { getTokenFromRequest, verifyAccessToken } from "@/lib/jwt"

const MANAGERS = new Set(["admin", "manager", "owner"])

const beatSchema = z.object({
  deviceId: z.string().min(1).max(64),
  label: z.string().max(64).optional(),
  appVersion: z.string().max(32).optional(),
  role: z.string().max(32).optional(),
})

/**
 * Device fleet heartbeat. Any signed-in device reports (upsert keyed by
 * device id); managers read the fleet. Powers the stale-tablet check in
 * Settings → Devices. Authentication is the JWT — no extra secret to lose.
 */
export async function POST(req: NextRequest) {
  const token = getTokenFromRequest(req)
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const caller = await verifyAccessToken(token)
  if (!caller) return NextResponse.json({ error: "Invalid token" }, { status: 401 })

  const body = beatSchema.safeParse(await req.json().catch(() => ({})))
  if (!body.success) return NextResponse.json({ error: "Invalid heartbeat" }, { status: 400 })
  const { deviceId, label, appVersion, role } = body.data

  await sqlWrite(
    `INSERT INTO "DeviceHeartbeat" (device_id, label, app_version, role, user_id, last_seen)
     VALUES ($1, $2, $3, $4, $5, NOW())
     ON CONFLICT (device_id) DO UPDATE SET
       label = EXCLUDED.label, app_version = EXCLUDED.app_version, role = EXCLUDED.role,
       user_id = EXCLUDED.user_id, last_seen = NOW()`,
    [deviceId, label ?? null, appVersion ?? "dev", role ?? String(caller.role ?? ""), String(caller.sub ?? "")],
  )
  return NextResponse.json({ ok: true })
}

export async function GET(req: NextRequest) {
  const token = getTokenFromRequest(req)
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const caller = await verifyAccessToken(token)
  if (!caller) return NextResponse.json({ error: "Invalid token" }, { status: 401 })
  if (!MANAGERS.has(String(caller.role ?? ""))) {
    return NextResponse.json({ error: "Managers only" }, { status: 403 })
  }
  const rows = await many(
    `SELECT device_id AS "deviceId", label, app_version AS "appVersion", role,
            user_id AS "userId", last_seen AS "lastSeen"
     FROM "DeviceHeartbeat" ORDER BY last_seen DESC LIMIT 100`,
  )
  return NextResponse.json(rows)
}
