import { neon } from "@neondatabase/serverless"

// Connection string is required in production; the localhost fallback exists
// only so `next dev` runs without infra.
const isProduction = process.env.NODE_ENV === "production"
const connectionString = process.env.DATABASE_URL
if (!connectionString && isProduction) {
  throw new Error("DATABASE_URL is required in production")
}
const rawSql = neon(connectionString || "postgresql://postgres:postgres@localhost:5432/restau_pos")

/** A single row returned by a query. Column values are driver-defined, hence `unknown`. */
export type SqlRow = Record<string, unknown>

/** Minimal shape of the Neon driver surface this module relies on. */
interface RawSqlClient {
  (strings: TemplateStringsArray | string, ...values: unknown[]): Promise<SqlRow[]>
  unsafe(query: string, params?: unknown[]): Promise<SqlRow[]>
  transaction: unknown
}

interface ConnectionErrorLike {
  sourceError?: { code?: string }
  message?: string
}

// Dev-only resilience: with no local database running, degrade to empty data so
// the app boots. NEVER do this in production — an outage would be misread as
// empty results (phantom not-found errors, spurious version conflicts).
function swallowIfDev(err: unknown): SqlRow[] {
  const connectionError = err as ConnectionErrorLike
  const connectionDown =
    connectionError?.sourceError?.code === "ECONNREFUSED" ||
    String(connectionError?.message ?? "").includes("fetch failed")
  if (connectionDown && !isProduction) {
    console.warn("Database connection unavailable, falling back to safe empty dataset (dev only).")
    return []
  }
  throw err
}

const client = rawSql as unknown as RawSqlClient

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
     * Several routes call `sql.query(...)`, but this method was never defined on the
     * object -- it only type-checked because `sql` was typed `any`, and would have
     * thrown "sql.query is not a function" at runtime.
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
