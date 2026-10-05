import { createHash, timingSafeEqual } from "crypto"
import { ActorContext } from "@/kernel/types"
import { actorFromAuthPayload } from "@/kernel/tenant/permission-map"

function timingSafeEqualStr(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a, "utf8").digest()
  const hb = createHash("sha256").update(b, "utf8").digest()
  return ha.length === hb.length && timingSafeEqual(ha, hb)
}

export interface ApiKeyRecord {
  /** Raw key value (compared in constant time; never logged). */
  key: string
  role: string
  /** Capabilities granted to this key. `*` means full access for the role. */
  scopes: string[]
  /** ISO timestamp the key was issued/rotated. From env or process start. */
  createdAt: string
  /** Optional ISO expiry; expired keys are rejected as unauthorized. */
  expiresAt?: string
}

export type ApiKeyCheck =
  | { status: "disabled" }
  | { status: "unauthorized" }
  | { status: "expired" }
  | { status: "ok"; actor: ActorContext; role: string; scopes: string[]; createdAt: string }

/** Default scopes per role when the env entry carries no explicit scope list. */
export function defaultScopesForRole(role: string): string[] {
  if (role === "admin") return ["*"]
  if (role === "manager") return ["order:*", "table:*", "reservation:*", "menu:view", "inventory:view"]
  return [`role:${role}`]
}

/**
 * Static API keys for the public REST API (/api/v1).
 *
 * Configuration (either env works):
 *   ROS_PUBLIC_API_KEYS="key-one,key-two=manager,key-three=staff:order:view+order:create"
 *   ROS_PUBLIC_API_KEY="single-dev-key"            // shorthand (role: admin)
 *   ROS_PUBLIC_API_KEYS_CREATED_AT="2026-01-01T00:00:00Z"  // rotation timestamp
 *   ROS_PUBLIC_API_KEYS_EXPIRES_AT="2027-01-01T00:00:00Z"  // optional expiry
 *
 * Entry shape: `key`, `key=role`, or `key=role:scope1+scope2`.
 * No keys configured => the public API answers 503 PUBLIC_API_DISABLED.
 * Multi-tenant key -> venue mapping is a future concern; keys currently act on
 * the kernel's tenant (ROS_ORG_ID / ROS_VENUE_ID, or the dev default).
 */
export function configuredApiKeys(): ApiKeyRecord[] {
  const raw = process.env.ROS_PUBLIC_API_KEYS ?? process.env.ROS_PUBLIC_API_KEY ?? ""
  const createdAt = process.env.ROS_PUBLIC_API_KEYS_CREATED_AT ?? new Date().toISOString()
  const expiresAt = process.env.ROS_PUBLIC_API_KEYS_EXPIRES_AT || undefined
  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [keyPart, rest] = entry.split("=")
      const key = keyPart.trim()
      if (!rest) return { key, role: "admin", scopes: defaultScopesForRole("admin"), createdAt, expiresAt }
      const [rolePart, scopePart] = rest.split(":")
      const role = (rolePart ?? "admin").trim() || "admin"
      const scopes = scopePart
        ? scopePart.split("+").map((s) => s.trim()).filter(Boolean)
        : defaultScopesForRole(role)
      return { key, role, scopes, createdAt, expiresAt }
    })
    .filter((entry) => entry.key.length > 0)
}

/** Extract "..." from `Authorization: Bearer ...` or the x-api-key header. */
export function apiKeyFromHeaders(headers: Headers): string | null {
  const auth = headers.get("authorization")
  if (auth) {
    const match = /^Bearer\s+(.+)$/i.exec(auth.trim())
    if (match) return match[1].trim()
  }
  return headers.get("x-api-key")
}

/** True when the key's scopes permit a capability (`*` or prefix match). */
export function keyHasScope(scopes: readonly string[], capability: string): boolean {
  if (scopes.includes("*")) return true
  return scopes.some((s) => {
    if (s === capability) return true
    if (s.endsWith(":*") && capability.startsWith(s.slice(0, -1))) return true
    return false
  })
}

export function checkApiKey(provided: string | null): ApiKeyCheck {
  const keys = configuredApiKeys()
  if (keys.length === 0) return { status: "disabled" }
  if (!provided) return { status: "unauthorized" }
  const match = keys.find((k) => timingSafeEqualStr(k.key, provided))
  if (!match) return { status: "unauthorized" }
  if (match.expiresAt && new Date(match.expiresAt).getTime() <= Date.now()) return { status: "expired" }
  return {
    status: "ok",
    role: match.role,
    scopes: match.scopes,
    createdAt: match.createdAt,
    actor: actorFromAuthPayload({ sub: `public-api:${match.role}`, role: match.role }),
  }
}
