import { randomUUID } from "crypto"
import { ActorContext, AttributeBag, Id, kernelError, TenantContext } from "@/kernel/types"
import { Aggregate, AggregateEvent } from "@/kernel/aggregates/aggregate"
import { validateTargetUrl } from "./webhooks"

export const WILDCARD_EVENT_TYPE = "*"

export interface WebhookEndpointState extends AttributeBag {
  url: string
  secret: string
  eventTypes: string[]
  active: boolean
  createdAt: string
  updatedAt: string
}

const emptyEndpointState: WebhookEndpointState = {
  url: "",
  secret: "",
  eventTypes: [],
  active: false,
  createdAt: "",
  updatedAt: "",
}

export function assertWebhookUrl(url: string): void {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw kernelError("INVALID_WEBHOOK_URL", `Not a valid URL: "${url}"`)
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw kernelError("INVALID_WEBHOOK_URL", `Webhook URL must be http(s): "${url}"`)
  }
  // Validate against SSRF - this is synchronous check, full validation happens at delivery time
  const hostname = parsed.hostname
  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") {
    throw kernelError("INVALID_WEBHOOK_URL", `Webhook URL cannot target localhost: "${url}"`)
  }
  // Check for private IP ranges in URL directly
  const privateIpPatterns = [
    /^10\./,
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
    /^192\.168\./,
    /^127\./,
    /^169\.254\./,
    /^::1$/,
    /^fc/,
    /^fd/,
  ]
  if (privateIpPatterns.some((p) => p.test(hostname))) {
    throw kernelError("INVALID_WEBHOOK_URL", `Webhook URL cannot target private IP: "${url}"`)
  }
}

function normalizeEventTypes(eventTypes?: string[]): string[] {
  if (!eventTypes || eventTypes.length === 0) return [WILDCARD_EVENT_TYPE]
  return [...new Set(eventTypes.map((t) => String(t).trim()).filter(Boolean))]
}

/**
 * Event-sourced webhook subscription. Survives restarts via replay; the secret
 * used to sign deliveries lives on the aggregate (queries redact it).
 */
export class WebhookEndpointAggregate extends Aggregate<WebhookEndpointState> {
  static readonly TYPE = "WebhookEndpoint"

  constructor(tenant: TenantContext) {
    super(WebhookEndpointAggregate.TYPE, tenant, { ...emptyEndpointState })
  }

  static create(
    tenant: TenantContext,
    opts: {
      id: Id
      url: string
      secret?: string
      eventTypes?: string[]
      actor?: ActorContext
    }
  ): WebhookEndpointAggregate {
    assertWebhookUrl(opts.url)
    const agg = new WebhookEndpointAggregate(tenant)
    agg.initialize(opts.id)
    agg.raise(
      "webhook.subscribed",
      {
        url: opts.url,
        secret: opts.secret ?? randomUUID(),
        eventTypes: normalizeEventTypes(opts.eventTypes),
        subscribedAt: new Date().toISOString(),
      },
      opts.actor
    )
    return agg
  }

  update(actor: ActorContext, changes: { url?: string; eventTypes?: string[]; secret?: string }): void {
    if (!this.state.active) {
      throw kernelError("WEBHOOK_INACTIVE", `Endpoint ${this.id} is unsubscribed`)
    }
    const payload: AttributeBag = {}
    if (changes.url !== undefined) {
      assertWebhookUrl(changes.url)
      payload.url = changes.url
    }
    if (changes.eventTypes !== undefined) payload.eventTypes = normalizeEventTypes(changes.eventTypes)
    if (changes.secret !== undefined) payload.secret = changes.secret
    if (Object.keys(payload).length === 0) {
      throw kernelError("NO_CHANGES", "Provide url, eventTypes and/or secret to update")
    }
    this.raise("webhook.updated", payload, actor)
  }

  unsubscribe(actor: ActorContext): void {
    if (!this.state.active) {
      throw kernelError("WEBHOOK_INACTIVE", `Endpoint ${this.id} is already unsubscribed`)
    }
    this.raise("webhook.unsubscribed", {}, actor)
  }

  /** Does an (active) endpoint want this event type? Infra events never match. */
  matches(eventType: string): boolean {
    if (!this.state.active) return false
    if (this.state.eventTypes.includes(WILDCARD_EVENT_TYPE)) return true
    return this.state.eventTypes.includes(eventType)
  }

  protected applyEvent(event: AggregateEvent): WebhookEndpointState {
    const s = this.state
    switch (event.eventType) {
      case "webhook.subscribed":
        return {
          ...s,
          url: String(event.payload.url ?? ""),
          secret: String(event.payload.secret ?? ""),
          eventTypes: (event.payload.eventTypes as string[]) ?? [],
          active: true,
          createdAt: String(event.payload.subscribedAt ?? event.occurredAt),
          updatedAt: event.occurredAt,
        }
      case "webhook.updated":
        return {
          ...s,
          url: event.payload.url !== undefined ? String(event.payload.url) : s.url,
          secret: event.payload.secret !== undefined ? String(event.payload.secret) : s.secret,
          eventTypes:
            event.payload.eventTypes !== undefined
              ? ((event.payload.eventTypes as string[]) ?? [])
              : s.eventTypes,
          updatedAt: event.occurredAt,
        }
      case "webhook.unsubscribed":
        return { ...s, active: false, updatedAt: event.occurredAt }
      default:
        return s
    }
  }
}
