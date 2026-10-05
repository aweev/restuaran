import { randomUUID } from "crypto"
import {
  AggregateSnapshot,
  AttributeBag,
  DomainEvent,
  DomainEventMetadata,
  Id,
  StoredEvent,
  TenantContext,
} from "@/kernel/types"

export interface AppendOptions {
  expectedVersion?: number
}

export interface EventQuery {
  tenant: TenantContext
  aggregateType?: string
  aggregateId?: Id
  eventTypes?: string[]
  fromGlobalPosition?: number
  limit?: number
}

export interface EventStore {
  append<TPayload extends AttributeBag>(
    event: Omit<DomainEvent<TPayload>, "globalPosition">,
    options?: AppendOptions
  ): Promise<StoredEvent<TPayload>>

  appendMany(
    events: Array<Omit<DomainEvent, "globalPosition">>,
    options?: AppendOptions
  ): Promise<StoredEvent[]>

  query(q: EventQuery): Promise<StoredEvent[]>

  readAggregate(
    tenant: TenantContext,
    aggregateType: string,
    aggregateId: Id,
    fromVersion?: number,
    limit?: number
  ): Promise<StoredEvent[]>

  saveSnapshot(snapshot: AggregateSnapshot): Promise<void>
  loadSnapshot(tenant: TenantContext, aggregateType: string, aggregateId: Id): Promise<AggregateSnapshot | null>

  subscribe(listener: (event: StoredEvent) => void): () => void
}

export interface NewEventInput<TPayload extends AttributeBag> {
  eventType: string
  aggregateType: string
  aggregateId: Id
  aggregateVersion: number
  tenant: TenantContext
  payload: TPayload
  actor?: DomainEvent["actor"]
  metadata?: DomainEventMetadata
  occurredAt?: string
}

export function buildEvent<TPayload extends AttributeBag>(input: NewEventInput<TPayload>): DomainEvent<TPayload> {
  return {
    eventId: randomUUID(),
    eventType: input.eventType,
    aggregateType: input.aggregateType,
    aggregateId: input.aggregateId,
    aggregateVersion: input.aggregateVersion,
    tenant: input.tenant,
    actor: input.actor,
    occurredAt: input.occurredAt ?? new Date().toISOString(),
    payload: input.payload,
    metadata: { source: "system", ...input.metadata },
  }
}

export function eventTopic(event: Pick<DomainEvent, "tenant" | "eventType">): string {
  return `${event.tenant.orgId}.${event.tenant.venueId}.${event.eventType}`
}

export function versionConflictError(
  expected: number,
  current: number,
  scope?: string,
): { code: string; message: string; details: AttributeBag } {
  const where = scope ? ` on ${scope}` : ""
  return {
    code: "VERSION_CONFLICT",
    message: `Optimistic concurrency conflict${where}: expected v${expected}, current v${current}`,
    details: { expectedVersion: expected, currentVersion: current },
  }
}
