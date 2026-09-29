import type { ConnectorRegistry } from "./connectors"
import type { OutboundQueue } from "./outbound-queue"

/**
 * Phase 3 integration fabric: two bounded-retry queues (webhooks + connectors)
 * fanned out from the `event:published` hook, plus the connector registry that
 * translates domain events into outbound payloads. Wired by the integrations
 * module and exposed as `kernel.integrations`.
 */
export interface IntegrationFabric {
  webhooks: OutboundQueue
  connectors: OutboundQueue
  registry: ConnectorRegistry
}