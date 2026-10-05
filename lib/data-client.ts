/**
 * Result of a data fetch that knows whether it came from the API.
 *
 * `live: false` means the request failed and the caller is looking at whatever
 * fallback it supplied. The UI surfaces this — a POS must never let a staff
 * member believe a screen is current when the database is unreachable.
 */
export interface Fetched<T> {
  data: T
  live: boolean
  error?: string
}

export async function apiGet<T>(url: string, fallback: T, init?: RequestInit): Promise<Fetched<T>> {
  try {
    const res = await fetch(url, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
      cache: "no-store",
    })
    if (!res.ok) return { data: fallback, live: false, error: `HTTP ${res.status}` }
    const json = await res.json()
    return { data: (json?.data ?? json) as T, live: true }
  } catch (err) {
    return {
      data: fallback,
      live: false,
      error: err instanceof Error ? err.message : "Network request failed",
    }
  }
}

