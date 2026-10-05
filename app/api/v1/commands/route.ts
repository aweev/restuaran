import { type NextRequest, NextResponse } from "next/server"
import { apiKeyFromHeaders, checkApiKey } from "@/kernel/server/api-key"
import { getKernel } from "@/kernel/server/kernel-singleton"
import { rateLimit, getClientIp } from "@/lib/rate-limiter"

export const runtime = "nodejs"

/** POST /api/v1/commands — dispatch a kernel command with an API key. */
export async function POST(req: NextRequest) {
  const auth = checkApiKey(apiKeyFromHeaders(req.headers))
  if (auth.status === "disabled") {
    return NextResponse.json(
      { success: false, commandId: "", error: { code: "PUBLIC_API_DISABLED", message: "Public API is disabled — set ROS_PUBLIC_API_KEYS" } },
      { status: 503 }
    )
  }
  if (auth.status !== "ok") {
    return NextResponse.json(
      { success: false, commandId: "", error: { code: "UNAUTHORIZED", message: "Invalid API key" } },
      { status: 401 }
    )
  }

  const body = (await req.json().catch(() => null)) as {
    commandType?: string
    payload?: Record<string, unknown>
    requestId?: string
  } | null
  if (!body?.commandType) {
    return NextResponse.json(
      { success: false, commandId: "", error: { code: "INVALID_REQUEST", message: "commandType is required" } },
      { status: 400 }
    )
  }

  const limited = await rateLimit(`v1:${auth.role}:${getClientIp(req)}`, {
    maxAttempts: 120,
    windowMs: 60 * 1000,
    keyPrefix: "v1:commands:",
  })
  if (limited.blocked) {
    return NextResponse.json(
      { success: false, commandId: "", error: { code: "RATE_LIMITED", message: "Too many requests" } },
      { status: 429 },
    )
  }

  const kernel = await getKernel()
  const result = await kernel.execute(body.commandType, body.payload ?? {}, auth.actor, body.requestId)
  return NextResponse.json(result, { status: result.success ? 200 : 422 })
}
