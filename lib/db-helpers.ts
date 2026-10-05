import { strictSql, type SqlRow } from "@/lib/db";

/**
 * Strict SQL for WRITE paths.
 *
 * `sql` (lib/db.ts) degrades to an empty result set in development when the
 * database is unreachable, which is the right behaviour for a read: the UI can
 * render an empty state. It is the *wrong* behaviour for a write. A POS that
 * swallows a failed INSERT and returns 201 has told the cashier the order was
 * taken when it was not.
 *
 * Every mutating route uses this so a database outage surfaces as a 503.
 */
export async function sqlWrite(
  query: string,
  params: unknown[] = [],
): Promise<SqlRow[]> {
  return strictSql.unsafe(query, params);
}

/*
 * ---------------------------------------------------------------------------
 * Transactions: an important caveat
 * ---------------------------------------------------------------------------
 * Both drivers serve each `unsafe()` call independently: `@neondatabase/serverless`
 * talks to Postgres over HTTP (each call its own request), and `postgres`
 * (Supabase / self-hosted path) draws from a pool. Explicit `BEGIN` / `COMMIT`
 * issued as separate calls therefore CANNOT be relied on to share a session.
 *
 * What this means in practice:
 *
 *   - A single statement is atomic. Always is. Rely on this.
 *   - `sqlWrite("BEGIN")` … `sqlWrite("COMMIT")` across several calls is NOT a
 *     guarantee. Treat it as a best-effort grouping only.
 *
 * The multi-statement paths in this codebase (order updates, waitlist seating,
 * loyalty redemption, payments) are therefore written so that the *invariant*
 * lives inside one statement, and the remaining statements are either
 * idempotent or safe to repeat. Examples:
 *
 *   - Loyalty redemption guards on `UPDATE … WHERE points >= $2 RETURNING`.
 *     A zero-row result is the "insufficient" answer, decided by Postgres
 *     itself — the balance can never go negative regardless of grouping.
 *   - Payments recompute the balance with `SUM(...)` after the insert; a
 *     retried insert is caught by the caller's idempotency handling.
 *
 * If genuine multi-statement transactions are ever needed, use a reserved
 * `postgres` connection (`sql.begin(...)` on the pg driver path) instead of
 * spreading BEGIN/COMMIT across calls, and revisit these comments.
 * ---------------------------------------------------------------------------
 */


/** First row, or `null`. Never throws on "no rows". */
export async function one<T = SqlRow>(query: string, params: unknown[] = []): Promise<T | null> {
  const rows = await sqlWrite(query, params);
  return (rows[0] as T) ?? null;
}

/** All rows. */
export async function many<T = SqlRow>(query: string, params: unknown[] = []): Promise<T[]> {
  return (await sqlWrite(query, params)) as T[];
}

/**
 * Best-effort audit write. Never fails the caller's request — a failed audit
 * line must not roll back a sale that already happened, but it is logged.
 */
export async function audit(input: {
  userId: string | null | undefined;
  action: string;
  entity: string;
  entityId?: string | null;
  details?: unknown;
}): Promise<void> {
  try {
    await sqlWrite(
      `INSERT INTO "AuditLog" (id, "userId", action, entity, "entityId", details, timestamp)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, NOW())`,
      [
        crypto.randomUUID(),
        input.userId ?? null,
        input.action,
        input.entity,
        input.entityId ?? null,
        JSON.stringify(input.details ?? {}),
      ],
    );
  } catch (err) {
    console.error("[audit] failed to record", input.entity, input.action, err);
  }
}

/** Map a `pg-` numeric/string decimal to a JS number, defaulting to 0. */
export function toNum(v: unknown): number {
  if (v === null || v === undefined) return 0;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Postgres returns TIMESTAMPTZ/DATE/TIME as JS `Date` or strings depending on
 * driver and column type. Normalise to an ISO string (or null) so the API
 * contract is stable for the client.
 */
export function toIso(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "string") {
    // Bare DATE / TIME have no timezone; anchor them so parsing cannot fail.
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return new Date(`${v}T00:00:00Z`).toISOString();
    if (/^\d{2}:\d{2}(:\d{2})?$/.test(v)) return new Date(`1970-01-01T${v}Z`).toISOString();
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  return null;
}

/**
 * Build `SET "col" = $n, ...` from a validated object, skipping undefined.
 * Returns the fragment and the values in the order they were bound, so the
 * caller can append them to its WHERE params.
 */
export function buildUpdate(
  data: Record<string, unknown>,
  startIndex: number,
): { clause: string; values: unknown[] } {
  const values: unknown[] = [];
  const parts: string[] = [];
  let i = startIndex;
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) continue;
    parts.push(`"${key}" = $${i}`);
    values.push(value);
    i += 1;
  }
  return { clause: parts.join(", "), values };
}
