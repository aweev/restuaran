import { NextResponse } from "next/server"

/**
 * Marks a legacy direct-SQL write path as deprecated.
 * The kernel command bus is the canonical write path; these REST mutations
 * bypass event sourcing, policies and audit. They are kept for backwards
 * compat during migration and will be removed once all callers use /api/kernel.
 */
export function deprecated<T>(body: T, init?: number | ResponseInit): NextResponse<T> {
  const res = NextResponse.json(body, init as ResponseInit | undefined)
  res.headers.set("X-Deprecated", "true")
  res.headers.set("X-Migrate-To", "/api/kernel")
  res.headers.set("Sunset", "Sat, 01 Aug 2026 00:00:00 GMT")
  return res
}

export function deprecatedList<T>(rows: T[], extra?: Record<string, unknown>): NextResponse {
  return deprecated({ data: rows, deprecated: true, migrateTo: "/api/kernel", ...(extra ?? {}) })
}
