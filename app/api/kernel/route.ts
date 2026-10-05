import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getTokenFromRequest, verifyJWT } from "@/lib/jwt"
import { actorFromAuthPayload } from "@/kernel/tenant/permission-map"
import { getKernel, isSocketEnabled } from "@/kernel/server/kernel-singleton"
import { assertProjectionAccess } from "@/kernel/projections/projection-acl"
import { suggestedActionsFor, type SuggestedAction } from "@/kernel/recovery"
import { rateLimit as sharedRateLimit } from "@/lib/rate-limiter"

export const runtime = "nodejs"

// ---- Per-token rate limit: 60 req/min via the shared limiter (Redis when
// UPSTASH_REDIS_REST_URL/TOKEN are set, in-memory fallback otherwise) so the
// cap holds across instances instead of per-process. ----
const RATE_LIMIT = 60
const WINDOW_MS = 60_000

function rateLimitHeaders(remaining: number, reset: number): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(RATE_LIMIT),
    "X-RateLimit-Remaining": String(Math.max(0, remaining)),
    "X-RateLimit-Reset": String(Math.ceil(reset / 1000)),
  }
}

async function kernelLimit(token: string): Promise<{ limited: NextResponse | null; remaining: number; reset: number }> {
  const reset = Date.now() + WINDOW_MS
  try {
    const r = await sharedRateLimit(token, { maxAttempts: RATE_LIMIT, windowMs: WINDOW_MS, keyPrefix: "kernel:" })
    if (r.blocked) {
      const retryAfter = Math.max(1, r.retryInMinutes * 60)
      return {
        limited: NextResponse.json(
          { error: "Rate limit exceeded (60 req/min)", retryAfter },
          { status: 429, headers: { ...rateLimitHeaders(0, reset), "Retry-After": String(retryAfter) } },
        ),
        remaining: 0,
        reset,
      }
    }
    return { limited: null, remaining: r.remaining, reset }
  } catch (err) {
    // A limiter outage must not brick the pass during rush: fail open and log.
    console.warn("[api/kernel] rate limiter error, failing open", err)
    return { limited: null, remaining: RATE_LIMIT, reset }
  }
}

const commandSchema = z.object({
  commandType: z.string().min(1, "commandType is required"),
  payload: z.record(z.unknown()).optional().default({}),
  requestId: z.string().min(1).optional(),
})

async function authenticate(req: NextRequest) {
  const token = getTokenFromRequest(req)
  if (!token) return null
  const payload = await verifyJWT(token)
  if (!payload) return null
  return { actor: actorFromAuthPayload(payload as never), token }
}

function maskReservationBoard<T extends { phone?: unknown; email?: unknown; specialRequests?: unknown }>(
  rows: T[],
  canSeePii: boolean,
): T[] {
  if (canSeePii) return rows
  const maskPhone = (v: unknown) =>
    typeof v === "string" && v.length > 4 ? `•••${v.slice(-4)}` : v == null ? v : "•••"
  const maskEmail = (v: unknown) =>
    typeof v === "string" && v.includes("@") ? `${v.slice(0, 1)}•••@${v.split("@")[1]}` : v == null ? v : "•••"
  return rows.map((r) => ({ ...r, phone: maskPhone(r.phone), email: maskEmail(r.email), specialRequests: r.specialRequests == null ? r.specialRequests : "•••" }))
}

export async function POST(req: NextRequest) {
  const auth = await authenticate(req)
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { limited, remaining, reset } = await kernelLimit(auth.token)
  if (limited) return limited

  const parsed = commandSchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", issues: parsed.error.issues },
      { status: 400 },
    )
  }
  const { commandType, payload, requestId } = parsed.data

  const kernel = await getKernel()
  const result = await kernel.execute(commandType, payload as Record<string, unknown>, auth.actor, requestId)
  if (result.success) {
    return NextResponse.json(result, {
      status: 200,
      headers: rateLimitHeaders(remaining, reset),
    })
  }
  // Rejection: attach server-suggested recovery actions. Generic mapping first,
  // then concrete candidates (e.g. *which* free table) best-effort — enrichment
  // must never fail the response itself.
  let suggestedActions: SuggestedAction[] = []
  try {
    suggestedActions = suggestedActionsFor(result.error?.code, payload as Record<string, unknown>)
    const code = result.error?.code
    if (code === "TABLE_NOT_AVAILABLE" || code === "TABLE_OCCUPIED") {
      const p = kernel.projections.get("tables.board")
      const rows = (p.state as { rows?: Array<{ tableId: string; label: string; capacity: number; status: string }> }).rows ?? []
      const covers = Number((payload as Record<string, unknown>)?.covers ?? (payload as Record<string, unknown>)?.customerCount ?? 0) || 0
      const free = rows
        .filter((r) => r.status === "available")
        .sort((a, b) => {
          if (covers > 0) {
            const da = a.capacity >= covers ? a.capacity - covers : 1000 + (covers - a.capacity)
            const db = b.capacity >= covers ? b.capacity - covers : 1000 + (covers - b.capacity)
            return da - db
          }
          return a.capacity - b.capacity
        })
        .slice(0, 3)
      const concrete: SuggestedAction[] = free.map((t) => ({
        label: `Seat at ${t.label} (${t.capacity} seats)`,
        commandType,
        payload: { ...(payload as Record<string, unknown>), tableId: t.tableId },
      }))
      suggestedActions = [...concrete, ...suggestedActions]
    }
  } catch {
    /* enrichment is advisory only */
  }
  return NextResponse.json({ ...result, suggestedActions }, {
    status: 422,
    headers: rateLimitHeaders(remaining, reset),
  })
}

export async function GET(req: NextRequest) {
  const auth = await authenticate(req)
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const gate = await kernelLimit(auth.token)
  if (gate.limited) return gate.limited
  const headers = rateLimitHeaders(gate.remaining, gate.reset)

  const { searchParams } = new URL(req.url)
  const kernel = await getKernel()

  if (searchParams.get("health") === "1") {
    if (!auth.actor.permissions.includes("audit:view")) {
      return NextResponse.json({ success: false, error: { code: "FORBIDDEN", message: "Missing audit:view" } }, { status: 403, headers })
    }
    return NextResponse.json({
      schemaVersion: kernel.version,
      projections: kernel.projections.names().map((name) => {
        try {
          const p = kernel.projections.get(name)
          return { name, position: p.position }
        } catch {
          return { name, position: -1 }
        }
      }),
      commands: kernel.commands.registeredCommands().length,
      queries: kernel.queries.registeredQueries().length,
    }, { headers })
  }

  const projectionName = searchParams.get("projection")
  if (projectionName) {
    try {
      assertProjectionAccess(auth.actor.permissions, projectionName)
    } catch (err) {
      const e = err as { code?: string; message?: string }
      return NextResponse.json({ success: false, error: { code: e.code ?? "FORBIDDEN", message: e.message ?? "Forbidden" } }, { status: 403, headers })
    }
    try {
      const p = kernel.projections.get(projectionName)
      let state: unknown = p.state
      // PII gate: the reservations board carries phone/email; mask unless
      // the caller holds customer:view_pii (mirrors the query-layer gate).
      if (projectionName === "reservations.board") {
        const canSeePii = auth.actor.permissions.includes("customer:view_pii")
        const s = state as { rows?: Array<{ phone?: unknown; email?: unknown; specialRequests?: unknown }> }
        state = { ...s, rows: maskReservationBoard(s.rows ?? [], canSeePii) }
      }
      return NextResponse.json({ name: projectionName, position: p.position, state }, { headers })
    } catch {
      return NextResponse.json({ error: `Unknown projection "${projectionName}"` }, { status: 404, headers })
    }
  }

  const queryType = searchParams.get("query")
  if (!queryType) {
    // Discovery enumerates the operational surface; admin only.
    if (!auth.actor.permissions.includes("audit:view")) {
      return NextResponse.json({ success: false, error: { code: "FORBIDDEN", message: 'Missing permission "audit:view"' } }, { status: 403, headers })
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
    }, { headers })
  }

  const params: Record<string, unknown> = {}
  for (const [k, v] of searchParams.entries()) {
    if (k !== "query") params[k] = v
  }

  const result = await kernel.ask(queryType, params, auth.actor)
  return NextResponse.json(result, { status: result.success ? 200 : 422, headers })
}
