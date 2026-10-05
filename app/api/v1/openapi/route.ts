import { type NextRequest, NextResponse } from "next/server"
import { apiKeyFromHeaders, checkApiKey } from "@/kernel/server/api-key"
import { collectSurface } from "@/kernel"
import { getKernel } from "@/kernel/server/kernel-singleton"

export const runtime = "nodejs"

/** GET /api/v1/openapi — minimal OpenAPI 3.1 generated from the live kernel surface. */
export async function GET(req: NextRequest) {
  const auth = checkApiKey(apiKeyFromHeaders(req.headers))
  if (auth.status === "disabled") {
    return NextResponse.json(
      { success: false, error: { code: "PUBLIC_API_DISABLED", message: "Public API is disabled" } },
      { status: 503 },
    )
  }
  if (auth.status !== "ok") {
    return NextResponse.json(
      { success: false, error: { code: "UNAUTHORIZED", message: "Invalid API key" } },
      { status: 401 },
    )
  }
  const kernel = await getKernel()
  const surface = collectSurface(kernel)
  return NextResponse.json({
    openapi: "3.1.0",
    info: { title: "Maison Chili POS Kernel API", version: String(kernel.version) },
    paths: {
      "/api/v1/commands": {
        post: {
          summary: "Dispatch a kernel command",
          requestBody: { content: { "application/json": { schema: { type: "object" } } } },
          responses: { "200": { description: "CommandResult" } },
        },
      },
      "/api/v1/queries": {
        get: {
          summary: "Run a kernel query or read a projection",
          responses: { "200": { description: "QueryResult or projection envelope" } },
        },
      },
    },
    "x-kernel": surface,
  })
}
