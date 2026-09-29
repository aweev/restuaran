import { StoredEvent } from "@/kernel/types"
import { Connector, connectorBody } from "./connectors"
import { EnqueueInput } from "./outbound-queue"

/**
 * Accounting connector: turns closed sales, payments and voids into journal
 * entry messages an external ledger (QuickBooks / Xero / ...) ingests.
 * `order.closed` carries totals (total/paid) stamped by the aggregate, so the
 * connector never loads state — the event is self-contained.
 */
export function accountingConnector(): Connector {
  return {
    id: "accounting",
    eventTypes: ["order.closed", "order.paymentRecorded", "order.voided"],
    build(event: StoredEvent): EnqueueInput | null {
      const p = event.payload as Record<string, unknown>
      const common = {
        channel: "connector",
        target: "accounting",
        eventType: event.eventType,
        tenant: event.tenant,
        eventId: event.eventId,
        position: event.globalPosition,
      }
      switch (event.eventType) {
        case "order.closed":
          return {
            ...common,
            body: connectorBody(event, {
              entry: "sale",
              orderId: event.aggregateId,
              channel: String(p.channel ?? "pos"),
              gross: Number(p.total ?? 0),
              paid: Number(p.paid ?? 0),
              currency: "USD",
            }),
          }
        case "order.paymentRecorded": {
          const payment = (p.payment ?? {}) as Record<string, unknown>
          return {
            ...common,
            body: connectorBody(event, {
              entry: "payment",
              orderId: event.aggregateId,
              method: String(payment.method ?? "unknown"),
              amount: Number(payment.amount ?? 0),
              gateway: payment.gateway ?? null,
              currency: "USD",
            }),
          }
        }
        case "order.voided":
          return {
            ...common,
            body: connectorBody(event, {
              entry: "void",
              orderId: event.aggregateId,
              reason: String(p.reason ?? "voided"),
              channel: String(p.channel ?? "pos"),
              currency: "USD",
            }),
          }
        default:
          return null
      }
    },
  }
}