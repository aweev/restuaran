import { ActorContext } from "@/kernel/types"
import { actorFromAuthPayload } from "@/kernel/tenant/permission-map"

export type ApiKeyCheck =
  | { status: "disabled" }
  | { status: "unauthorized" }
  | { status: "ok"; actor: ActorContext; role: string }

/**
 * Static API keys for the public REST API (/api/v1).
 *
 * Configuration (either env works):
 *   ROS_PUBLIC_API_KEYS="key-one,key-two=manager"   // "key" or "key=role"
 *   ROS_PUBLIC_API_KEY="single-dev-key"            // shorthand (role: admin)
 *
 * No keys configured => the public API answers 503 PUBLIC_API_DISABLED.
 * Multi-tenant key -> venue mapping is a future concern; keys currently act on
 * the kernel's tenant (ROS_ORG_ID / ROS_VENUE_ID, or the dev default).
 */
export function configuredApiKeys(): Array<{ key: string; role: string }> {
  const raw = process.env.ROS_PUBLIC_API_KEYS ?? process.env.ROS_PUBLIC_API_KEY ?? ""
  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [key, role] = entry.split("=")
      return { key: key.trim(), role: (role ?? "admin").trim() }
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

export function checkApiKey(provided: string | null): ApiKeyCheck {
  const keys = configuredApiKeys()
  if (keys.length === 0) return { status: "disabled" }
  if (!provided) return { status: "unauthorized" }
  const match = keys.find((k) => k.key === provided)
  if (!match) return { status: "unauthorized" }
  return {
    status: "ok",
    role: match.role,
    actor: actorFromAuthPayload({ sub: `public-api:${match.role}`, role: match.role }),
  }
}