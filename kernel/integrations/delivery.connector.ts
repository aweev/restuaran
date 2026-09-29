import { StoredEvent } from "@/kernel/types"
import { Connector, connectorBody } from "./connectors"
import { EnqueueInput } from "./outbound-queue"

const STATUS_BY_EVENT: Record<string, string> = {
  "platform.orderReceived": "accepted",
  "order.sentToKitchen": "preparing",
  "kitchen.lineReady": "ready",
  "order.closed": "completed",
  "platform.orderCancelled": "cancelled",
}

/**
 * Delivery connector: mirrors marketplace order progress back to the platform
 * (rider dispatch / ETA feeds). platform.* events always carry the external
 * mapping; plain order events only matter when the order came in on the
 * "platform" channel (stamped on every Order event).
 */
export function deliveryConnector(): Connector {
  return {
    id: "delivery",
    eventTypes: Object.keys(STATUS_BY_EVENT),
    build(event: StoredEvent): EnqueueInput | null {
      const p = event.payload as Record<string, unknown>
      const isPlatformEvent = event.eventType.startsWith("platform.")
      if (!isPlatformEvent && String(p.channel ?? "") !== "platform") return null
      return {
        channel: "connector",
        target: "delivery",
        eventType: event.eventType,
        tenant: event.tenant,
        eventId: event.eventId,
        position: event.globalPosition,
        body: connectorBody(event, {
          status: STATUS_BY_EVENT[event.eventType],
          orderId: String(p.orderId ?? (isPlatformEvent ? event.aggregateId : event.aggregateId)),
          platform: p.platform ?? null,
          externalOrderId: p.externalOrderId ?? null,
        }),
      }
    },
  }
}