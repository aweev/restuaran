import { AttributeBag, StoredEvent } from "@/kernel/types"
import { EnqueueInput, isInfraEvent } from "./outbound-queue"

/**
 * A connector translates a slice of the kernel's event stream into outbound
 * messages (journal entries, delivery status pings, ...) that ride the same
 * retry + DLQ machinery as webhooks.
 */
export interface Connector {
  id: string
  eventTypes: string[]
  build(event: StoredEvent): EnqueueInput | EnqueueInput[] | null
}

export class ConnectorRegistry {
  private connectors = new Map<string, Connector>()

  register(connector: Connector): void {
    if (this.connectors.has(connector.id)) {
      throw new Error(`Connector already registered: ${connector.id}`)
    }
    this.connectors.set(connector.id, connector)
  }

  unregister(id: string): boolean {
    return this.connectors.delete(id)
  }

  ids(): string[] {
    return [...this.connectors.keys()]
  }

  match(eventType: string): Connector[] {
    if (isInfraEvent(eventType)) return []
    return [...this.connectors.values()].filter((c) => c.eventTypes.includes(eventType))
  }

  /** Build outbound messages for all connectors interested in this event. */
  fanout(event: StoredEvent): EnqueueInput[] {
    const inputs: EnqueueInput[] = []
    for (const connector of this.match(event.eventType)) {
      const built = connector.build(event)
      if (!built) continue
      inputs.push(...(Array.isArray(built) ? built : [built]))
    }
    return inputs
  }
}

/** Shared envelope for outbound connector messages. */
export function connectorBody(event: StoredEvent, extra: AttributeBag): AttributeBag {
  return {
    id: event.eventId,
    type: event.eventType,
    occurredAt: event.occurredAt,
    tenant: { orgId: event.tenant.orgId, venueId: event.tenant.venueId },
    aggregate: { type: event.aggregateType, id: event.aggregateId, version: event.aggregateVersion },
    payload: event.payload,
    ...extra,
  }
}