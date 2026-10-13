import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { audit } from "@/lib/db-helpers"
import { getTokenFromRequest, verifyAccessToken } from "@/lib/jwt"
import { rateLimit, getClientIp } from "@/lib/rate-limiter"

const schema = z.object({
  message: z.string().min(1).max(2000),
  stack: z.string().max(8000).optional(),
  url: z.string().max(500).optional(),
  build: z.string().max(32).optional(),
})

/**
 * Client crash telemetry. Signed-in devices only, 20/min/IP. Lands in
 * AuditLog as CLIENT_ERROR (best-effort, like all audit writes) so a field
 * failure is visible to whoever reads the log — instead of dying in a
 * tablet's console where nobody will ever see it.
 */
export async function POST(req: NextRequest) {
  const token = getTokenFromRequest(req)
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const caller = await verifyAccessToken(token)
  if (!caller) return NextResponse.json({ error: "Invalid token" }, { status: 401 })

  const limited = await rateLimit(`err:${getClientIp(req)}`, {
    maxAttempts: 20,
    windowMs: 60 * 1000,
    keyPrefix: "errors:",
  })
  if (limited.blocked) return NextResponse.json({ error: "Slow down" }, { status: 429 })

  const body = schema.safeParse(await req.json().catch(() => ({})))
  if (!body.success) return NextResponse.json({ error: "Invalid report" }, { status: 400 })

  await audit({
    userId: String(caller.sub ?? ""),
    action: "CLIENT_ERROR",
    entity: "CLIENT_ERROR",
    entityId: String(caller.sub ?? ""),
    details: {
      ...body.data,
      role: caller.role,
      ua: req.headers.get("user-agent")?.slice(0, 200),
    },
  })
  return NextResponse.json({ ok: true })
}
