import { type NextRequest, NextResponse } from "next/server"
import { getTokenFromRequest, verifyJWT } from "@/lib/jwt"
import { actorFromAuthPayload } from "@/kernel/tenant/permission-map"
import { getKernel, isSocketEnabled } from "@/kernel/server/kernel-singleton"
import { assertProjectionAccess } from "@/kernel/projections/projection-acl"

export const runtime = "nodejs"

async function authenticate(req: NextRequest) {
  const token = getTokenFromRequest(req)
  if (!token) return null
  const payload = await verifyJWT(token)
  if (!payload) return null
  return actorFromAuthPayload(payload as never)
}

export async function POST(req: NextRequest) {
  const actor = await authenticate(req)
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = (await req.json()) as { commandType?: string; payload?: Record<string, unknown>; requestId?: string }
  if (!body.commandType) {
    return NextResponse.json({ error: "commandType is required" }, { status: 400 })
  }

  const kernel = await getKernel()
  const result = await kernel.execute(body.commandType, body.payload ?? {}, actor, body.requestId)
  return NextResponse.json(result, { status: result.success ? 200 : 422 })
}

export async function GET(req: NextRequest) {
  const actor = await authenticate(req)
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const kernel = await getKernel()

  const projectionName = searchParams.get("projection")
  if (projectionName) {
    try {
      assertProjectionAccess(actor.permissions, projectionName)
    } catch (err) {
      const e = err as { code?: string; message?: string }
      return NextResponse.json({ success: false, error: { code: e.code ?? "FORBIDDEN", message: e.message ?? "Forbidden" } }, { status: 403 })
    }
    try {
      const p = kernel.projections.get(projectionName)
      return NextResponse.json({ name: projectionName, position: p.position, state: p.state })
    } catch {
      return NextResponse.json({ error: `Unknown projection "${projectionName}"` }, { status: 404 })
    }
  }

  const queryType = searchParams.get("query")
  if (!queryType) {
    // Discovery enumerates the operational surface; admin only.
    if (!actor.permissions.includes("audit:view")) {
      return NextResponse.json({ success: false, error: { code: "FORBIDDEN", message: 'Missing permission "audit:view"' } }, { status: 403 })
    }
    return NextResponse.json({
      schemaVersion: kernel.version,
      socketEnabled: isSocketEnabled(),
      commands: kernel.commands.registeredCommands(),
      queries: kernel.queries.registeredQueries(),
      projections: kernel.projections.names(),
      modules: kernel.modules.list(),
      integrations: kernel.integrations
        ? {
            webhooks: kernel.integrations.webhooks.stats(),
            connectors: kernel.integrations.connectors.stats(),
          }
        : null,
    })
  }

  const params: Record<string, unknown> = {}
  for (const [k, v] of searchParams.entries()) {
    if (k !== "query") params[k] = v
  }

  const result = await kernel.ask(queryType, params, actor)
  return NextResponse.json(result, { status: result.success ? 200 : 422 })
}
