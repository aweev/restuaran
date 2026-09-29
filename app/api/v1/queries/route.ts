import { type NextRequest, NextResponse } from "next/server"
import { apiKeyFromHeaders, checkApiKey } from "@/kernel/server/api-key"
import { getKernel } from "@/kernel/server/kernel-singleton"

export const runtime = "nodejs"

/**
 * GET /api/v1/queries — run a kernel query (?query=get.order&orderId=...) or
 * read a projection (?projection=kitchen.queue) with an API key.
 */
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

  const { searchParams } = new URL(req.url)
  const kernel = await getKernel()

  const projectionName = searchParams.get("projection")
  if (projectionName) {
    try {
      const p = kernel.projections.get(projectionName)
      return NextResponse.json({ name: projectionName, position: p.position, state: p.state })
    } catch {
      return NextResponse.json(
        { success: false, error: { code: "UNKNOWN_PROJECTION", message: `Unknown projection "${projectionName}"` } },
        { status: 404 }
      )
    }
  }

  const queryType = searchParams.get("query")
  if (!queryType) {
    return NextResponse.json(
      { success: false, error: { code: "INVALID_REQUEST", message: "query or projection parameter is required" } },
      { status: 400 }
    )
  }

  const params: Record<string, unknown> = {}
  for (const [k, v] of searchParams.entries()) {
    if (k !== "query") params[k] = v
  }

  const result = await kernel.ask(queryType, params, auth.actor)
  return NextResponse.json(result, { status: result.success ? 200 : 422 })
}