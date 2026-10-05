import { neon } from "@neondatabase/serverless"
import postgres from "postgres"

// Connection string is resolved lazily so importing this module during
// `next build` page-data collection never throws when DATABASE_URL is unset.
// The throw happens only on first actual query in production.
const isProduction = process.env.NODE_ENV === "production"

function getConnectionString(): string {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString && isProduction) {
    throw new Error("DATABASE_URL is required in production")
  }
  return connectionString || "postgresql://postgres:postgres@localhost:5432/restau_pos"
}

function connectionHost(connectionString: string): string {
  try {
    return new URL(connectionString).hostname.toLowerCase()
  } catch {
    return "localhost"
  }
}

/**
 * Driver selection.
 *
 * `@neondatabase/serverless` speaks HTTP and only works against Neon. Any
 * other Postgres — Supabase (remote), self-hosted, localhost dev — goes
 * through `postgres` (postgres.js) over the wire protocol. Override with
 * `ROS_DB_DRIVER=neon|pg` when auto-detection gets it wrong.
 */
function selectedDriver(connectionString: string): "neon" | "pg" {
  const forced = (process.env.ROS_DB_DRIVER ?? "").toLowerCase()
  if (forced === "neon" || forced === "pg") return forced
  const host = connectionHost(connectionString)
  return host.endsWith(".neon.tech") ? "neon" : "pg"
}

type NeonClient = ReturnType<typeof neon>
type PgClient = ReturnType<typeof postgres>

let rawSql: NeonClient | PgClient | null = null
function getRawSql(): NeonClient | PgClient {
  if (rawSql) return rawSql
  const connectionString = getConnectionString()
  if (selectedDriver(connectionString) === "neon") {
    rawSql = neon(connectionString)
    return rawSql
  }
  const host = connectionHost(connectionString)
  const isLocal = host === "localhost" || host === "127.0.0.1" || host === "::1"
  rawSql = postgres(connectionString, {
    // Supabase pooler (6543, PgBouncer transaction mode) cannot use prepared
    // statements; plain query mode works everywhere.
    prepare: false,
    // Supabase and any non-local host require TLS.
    ssl: isLocal ? false : "require",
    // Serverless-friendly pool footprint.
    max: 5,
    idle_timeout: 20,
    connect_timeout: 10,
  })
  return rawSql
}

/** A single row returned by a query. Column values are driver-defined, hence `unknown`. */
export type SqlRow = Record<string, unknown>

/** Minimal shape of the driver surface this module relies on (neon or postgres.js). */
interface RawSqlClient {
  (strings: TemplateStringsArray | string, ...values: unknown[]): Promise<SqlRow[]>
  unsafe(query: string, params?: unknown[]): Promise<SqlRow[]>
  transaction: unknown
}

interface ConnectionErrorLike {
  code?: string
  sourceError?: { code?: string }
  message?: string
}

// Dev-only resilience: with no local database running, degrade to empty data so
// the app boots. NEVER do this in production — an outage would be misread as
// empty results (phantom not-found errors, spurious version conflicts).
function swallowIfDev(err: unknown): SqlRow[] {
  const connectionError = err as ConnectionErrorLike
  const connectionDown =
    connectionError?.code === "ECONNREFUSED" ||
    connectionError?.sourceError?.code === "ECONNREFUSED" ||
    String(connectionError?.message ?? "").includes("fetch failed") ||
    String(connectionError?.message ?? "").includes("connect ECONNREFUSED")
  if (connectionDown && !isProduction) {
    console.warn("Database connection unavailable, falling back to safe empty dataset (dev only).")
    return []
  }
  throw err
}

const client = new Proxy({} as RawSqlClient, {
  get(_target, prop: string) {
    const sql = getRawSql() as unknown as RawSqlClient
    const value = (sql as unknown as Record<string, unknown>)[prop]
    return typeof value === "function" ? (value as (...a: never[]) => unknown).bind(sql) : value
  },
})

/**
 * Strict client: errors propagate.
 *
 * `sql` below is deliberately forgiving in development so the app boots without
 * a database, but that forgiveness must never apply to a write. This is the
 * escape hatch used by `sqlWrite` in lib/db-helpers.ts.
 */
export const strictSql = {
  unsafe: (query: string, params?: unknown[]): Promise<SqlRow[]> => client.unsafe(query, params ?? []),
}

export const sql = Object.assign(
  async (strings: TemplateStringsArray | string, ...values: unknown[]): Promise<SqlRow[]> => {
    try {
      return await client(strings, ...values)
    } catch (err: unknown) {
      return swallowIfDev(err)
    }
  },
  {
    unsafe: async (query: string, params?: unknown[]): Promise<SqlRow[]> => {
      try {
        return await client.unsafe(query, params)
      } catch (err: unknown) {
        return swallowIfDev(err)
      }
    },
    /**
     * Alias of {@link sql.unsafe} for raw, pre-built SQL strings.
     *
     * For callers that assemble a statement dynamically and pass it as a single
     * string. For anything that mutates, prefer `sqlWrite` in
     * lib/db-helpers.ts — this one degrades to an empty result in dev.
     */
    query: async (query: string, params?: unknown[]): Promise<SqlRow[]> => {
      try {
        return await client.unsafe(query, params)
      } catch (err: unknown) {
        return swallowIfDev(err)
      }
    },
    transaction: client.transaction,
  },
)

// Helper function to convert snake_case to camelCase
export function snakeToCamel(obj: Record<string, unknown> | unknown): Record<string, unknown> | unknown {
  if (obj === null || typeof obj !== "object") {
    return obj
  }

  if (Array.isArray(obj)) {
    return obj.map(snakeToCamel)
  }

  return Object.keys(obj).reduce((acc: Record<string, unknown>, key: string) => {
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())
    acc[camelKey] = snakeToCamel((obj as Record<string, unknown>)[key])
    return acc
  }, {} as Record<string, unknown>)
}

// Helper function to convert camelCase to snake_case
export function camelToSnake(obj: Record<string, unknown> | unknown): Record<string, unknown> | unknown {
  if (obj === null || typeof obj !== "object") {
    return obj
  }

  if (Array.isArray(obj)) {
    return obj.map(camelToSnake)
  }

  return Object.keys(obj).reduce((acc: Record<string, unknown>, key: string) => {
    const snakeKey = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)
    acc[snakeKey] = camelToSnake((obj as Record<string, unknown>)[key])
    return acc
  }, {} as Record<string, unknown>)
}
