import { createHash } from "crypto"
import { ActorContext, AttributeBag, Id, kernelError, TenantContext } from "@/kernel/types"
import { Aggregate, AggregateEvent } from "./aggregate"

export interface PlatformOrderState extends AttributeBag {
  platform: string
  externalOrderId: string
  orderId: Id | null
  status: "received" | "completed" | "cancelled"
  fulfillment: "delivery" | "pickup"
  customerName: string | null
  itemsSubtotal: number
  itemCount: number
  receivedAt: string
  closedAt: string | null
  reason: string | null
}

const emptyState: PlatformOrderState = {
  platform: "",
  externalOrderId: "",
  orderId: null,
  status: "received",
  fulfillment: "delivery",
  customerName: null,
  itemsSubtotal: 0,
  itemCount: 0,
  receivedAt: "",
  closedAt: null,
  reason: null,
}

/**
 * Deterministic UUID-shaped id for `(platform, externalOrderId)`, so re-ingesting
 * the same marketplace order maps onto the same stream — idempotency falls out
 * of aggregate identity instead of a side table. UUID-shaped to fit PG uuid columns.
 */
export function platformOrderId(platform: string, externalOrderId: string): Id {
  const hex = createHash("sha256").update(`${platform}#${externalOrderId}`).digest("hex").slice(0, 32)
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`
}

/**
 * Marketplace order injection record: maps an external platform order onto the
 * internal POS Order. The POS order is created through the command bus (so
 * cross-module policies like the 86 veto apply); this aggregate tracks the
 * external identity + lifecycle (received -> completed | cancelled).
 */
export class PlatformOrderAggregate extends Aggregate<PlatformOrderState> {
  static readonly TYPE = "PlatformOrder"

  constructor(tenant: TenantContext) {
    super(PlatformOrderAggregate.TYPE, tenant, { ...emptyState })
  }

  static create(
    tenant: TenantContext,
    opts: {
      id: Id
      platform: string
      externalOrderId: string
      orderId: Id
      fulfillment?: "delivery" | "pickup"
      customerName?: string | null
      itemsSubtotal: number
      itemCount: number
      actor?: ActorContext
    }
  ): PlatformOrderAggregate {
    const agg = new PlatformOrderAggregate(tenant)
    agg.initialize(opts.id)
    agg.raise(
      "platform.orderReceived",
      {
        platform: opts.platform,
        externalOrderId: opts.externalOrderId,
        orderId: opts.orderId,
        fulfillment: opts.fulfillment ?? "delivery",
        customerName: opts.customerName ?? null,
        itemsSubtotal: opts.itemsSubtotal,
        itemCount: opts.itemCount,
        receivedAt: new Date().toISOString(),
      },
      opts.actor
    )
    return agg
  }

  cancel(actor: ActorContext, reason: string): void {
    if (this.state.status !== "received") {
      throw kernelError("PLATFORM_ORDER_TERMINAL", `Platform order is ${this.state.status}`)
    }
    this.raise("platform.orderCancelled", { reason }, actor)
  }

  complete(actor: ActorContext): void {
    if (this.state.status !== "received") {
      throw kernelError("PLATFORM_ORDER_TERMINAL", `Platform order is ${this.state.status}`)
    }
    this.raise("platform.orderCompleted", {}, actor)
  }

  protected applyEvent(event: AggregateEvent): PlatformOrderState {
    const s = this.state
    switch (event.eventType) {
      case "platform.orderReceived":
        return {
          ...s,
          platform: String(event.payload.platform ?? ""),
          externalOrderId: String(event.payload.externalOrderId ?? ""),
          orderId: (event.payload.orderId as Id) ?? null,
          fulfillment: (event.payload.fulfillment as "delivery" | "pickup") ?? "delivery",
          customerName: (event.payload.customerName as string) ?? null,
          itemsSubtotal: Number(event.payload.itemsSubtotal ?? 0),
          itemCount: Number(event.payload.itemCount ?? 0),
          receivedAt: String(event.payload.receivedAt ?? event.occurredAt),
          status: "received",
          closedAt: null,
          reason: null,
        }
      case "platform.orderCancelled":
        return {
          ...s,
          status: "cancelled",
          reason: String(event.payload.reason ?? "cancelled"),
          closedAt: event.occurredAt,
        }
      case "platform.orderCompleted":
        return { ...s, status: "completed", closedAt: event.occurredAt }
      default:
        return s
    }
  }
}