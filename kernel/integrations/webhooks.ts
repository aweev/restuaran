import { createHmac, timingSafeEqual } from "crypto"
import { AttributeBag, StoredEvent } from "@/kernel/types"
import { EnqueueInput, OutboundMessage, OutboundTransport, isInfraEvent } from "./outbound-queue"
import { WebhookEndpointState, WILDCARD_EVENT_TYPE } from "./webhook-endpoint.aggregate"

export const SIGNATURE_HEADER = "X-ROS-Signature"
export const TIMESTAMP_HEADER = "X-ROS-Timestamp"
export const EVENT_HEADER = "X-ROS-Event"
export const DELIVERY_HEADER = "X-ROS-Delivery"

export type WebhookEndpointView = WebhookEndpointState & { id: string }

export interface SignedBody {
  timestamp: number
  raw: string
  signature: string
}

const PRIVATE_IP_PATTERNS = [
  /^10\./,
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
  /^192\.168\./,
  /^127\./,
  /^169\.254\./,
  /^::1$/,
  /^fc/,
  /^fd/,
]

function isPrivateIp(ip: string): boolean {
  return PRIVATE_IP_PATTERNS.some((p) => p.test(ip))
}

async function resolveAndValidateHostname(hostname: string): Promise<string[]> {
  try {
    const dns = await import("dns")
    const results = await dns.promises.lookup(hostname, { all: true })
    return results.map((r) => r.address)
  } catch {
    return []
  }
}

export async function validateTargetUrl(url: string): Promise<void> {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new Error(`Invalid webhook URL: ${url}`)
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`Webhook URL must be http(s): ${url}`)
  }

  const hostname = parsed.hostname
  const ips = await resolveAndValidateHostname(hostname)
  if (ips.length === 0) {
    throw new Error(`Could not resolve hostname: ${hostname}`)
  }
  for (const ip of ips) {
    if (isPrivateIp(ip)) {
      throw new Error(`Webhook target resolves to private IP: ${ip}`)
    }
  }
}

/** HMAC-SHA256 over `${timestamp}.${rawBody}` — the contract external receivers verify. */
export function signBody(secret: string, rawBody: string, timestamp = Math.floor(Date.now() / 1000)): SignedBody {
  const signature = `sha256=${createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex")}`
  return { timestamp, raw: rawBody, signature }
}

/** Constant-time verification helper for receivers (and our own smoke test). */
export function verifyWebhookSignature(
  secret: string,
  timestamp: number | string,
  rawBody: string,
  signature: string
): boolean {
  const expected = signBody(secret, rawBody, Number(timestamp))
  const a = Buffer.from(expected.signature)
  const b = Buffer.from(String(signature ?? ""))
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

/** Canonical envelope every webhook subscriber receives. */
export function webhookEnvelope(event: StoredEvent): AttributeBag {
  return {
    id: event.eventId,
    type: event.eventType,
    occurredAt: event.occurredAt,
    position: event.globalPosition,
    tenant: {
      orgId: event.tenant.orgId,
      venueId: event.tenant.venueId,
      ...(event.tenant.zoneId ? { zoneId: event.tenant.zoneId } : {}),
    },
    aggregate: { type: event.aggregateType, id: event.aggregateId, version: event.aggregateVersion },
    actor: event.actor?.userId ?? null,
    payload: event.payload,
    metadata: event.metadata,
  }
}

/**
 * Enqueue inputs for every active endpoint subscribed to this event.
 * Infra events (webhook./outbound.) are never delivered, even to wildcards.
 */
export function webhookDeliveriesFor(
  event: StoredEvent,
  endpoints: WebhookEndpointView[]
): EnqueueInput[] {
  if (isInfraEvent(event.eventType)) return []
  const matching = endpoints.filter(
    (ep) =>
      ep.active &&
      (ep.eventTypes.includes(WILDCARD_EVENT_TYPE) || ep.eventTypes.includes(event.eventType))
  )
  if (matching.length === 0) return []

  const body = webhookEnvelope(event)
  const raw = JSON.stringify(body)
  return matching.map((ep) => {
    const { timestamp, signature } = signBody(ep.secret, raw)
    return {
      channel: "webhook",
      target: ep.url,
      eventType: event.eventType,
      tenant: event.tenant,
      eventId: event.eventId,
      position: event.globalPosition,
      body,
      headers: {
        [EVENT_HEADER]: event.eventType,
        [TIMESTAMP_HEADER]: String(timestamp),
        [SIGNATURE_HEADER]: signature,
      },
    }
  })
}

/** Production transport: POSTs the signed envelope to the subscriber URL. */
export class HttpWebhookTransport implements OutboundTransport {
  private doFetch: typeof fetch
  private readonly timeoutMs: number
  private readonly maxResponseBytes: number

  constructor(fetchImpl?: typeof fetch, options?: { timeoutMs?: number; maxResponseBytes?: number }) {
    this.doFetch = fetchImpl ?? fetch
    this.timeoutMs = options?.timeoutMs ?? 10000
    this.maxResponseBytes = options?.maxResponseBytes ?? 1024 * 1024 // 1MB
  }

  async deliver(message: OutboundMessage): Promise<void> {
    await validateTargetUrl(message.target)

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs)

    try {
      const res = await this.doFetch(message.target, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...message.headers },
        body: JSON.stringify(message.body),
        signal: controller.signal,
      })

      if (!res.ok) {
        throw new Error(`webhook delivery failed: ${res.status} ${await res.text().catch(() => "")}`)
      }

      // Limit response body size
      const contentLength = res.headers.get("content-length")
      if (contentLength && parseInt(contentLength, 10) > this.maxResponseBytes) {
        throw new Error(`webhook response too large: ${contentLength} bytes`)
      }

      // Consume body to avoid connection issues
      await res.arrayBuffer()
    } finally {
      clearTimeout(timeoutId)
    }
  }
}
