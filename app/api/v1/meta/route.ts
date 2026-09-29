import { type NextRequest, NextResponse } from "next/server"
import { apiKeyFromHeaders, checkApiKey } from "@/kernel/server/api-key"
import { collectSurface } from "@/kernel"
import { getKernel, isSocketEnabled } from "@/kernel/server/kernel-singleton"

export const runtime = "nodejs"

/** GET /api/v1/meta — discovery: commands, queries, projections, modules. */
export async function GET(req: NextRequest) {
  const auth = checkApiKey(apiKeyFromHeaders(req.headers))
  if (auth.status === "disabled") {
    return NextResponse.json(
      { success: false, error: { code: "PUBLIC_API_DISABLED", message: "Public API is disabled — set ROS_PUBLIC_API_KEYS" } },
      { status: 503 }
    )
  }
  if (auth.status !== "ok") {
    return NextResponse.json(
      { success: false, error: { code: "UNAUTHORIZED", message: "Invalid API key" } },
      { status: 401 }
    )
  }

  const kernel = await getKernel()
  return NextResponse.json({
    ...collectSurface(kernel),
    socketEnabled: isSocketEnabled(),
  })
}