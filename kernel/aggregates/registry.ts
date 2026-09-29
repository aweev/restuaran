import { ActorContext, AttributeBag, Id, kernelError, StoredEvent, TenantContext } from "@/kernel/types"
import { buildEvent, EventStore } from "@/kernel/event-store/event-store"
import { Aggregate } from "./aggregate"

type AggregateCtor<T extends Aggregate = Aggregate> = new (tenant: TenantContext) => T

const registry = new Map<string, AggregateCtor>()

export function registerAggregate(aggregateType: string, ctor: AggregateCtor): void {
  registry.set(aggregateType, ctor)
}

export function aggregateConstructor(aggregateType: string): AggregateCtor {
  const ctor = registry.get(aggregateType)
  if (!ctor) throw kernelError("UNKNOWN_AGGREGATE", `No aggregate registered for type "${aggregateType}"`)
  return ctor
}

interface Replayable {
  initialize(id: Id): void
  restoreFromSnapshot(version: number, state: object): void
  replay(event: object): void
}

export async function loadAggregate<T extends Aggregate>(
  store: EventStore,
  aggregateType: string,
  tenant: TenantContext,
  aggregateId: Id
): Promise<T> {
  const Ctor = aggregateConstructor(aggregateType)
  const agg = new Ctor(tenant) as unknown as T & Replayable
  agg.initialize(aggregateId)

  const snapshot = await store.loadSnapshot(tenant, aggregateType, aggregateId)
  if (snapshot) agg.restoreFromSnapshot(snapshot.version, snapshot.state)
  const events = await store.readAggregate(tenant, aggregateType, aggregateId, snapshot?.version ?? 0)
  for (const e of events) agg.replay(e)
  return agg
}

/**
 * Load for *mutation*: rejects ids that have no stream, so a typo/unknown id
 * yields AGGREGATE_NOT_FOUND instead of silently creating an orphan aggregate.
 */
export async function loadExisting<T extends Aggregate>(
  store: EventStore,
  aggregateType: string,
  tenant: TenantContext,
  aggregateId: Id
): Promise<T> {
  const agg = await loadAggregate<T>(store, aggregateType, tenant, aggregateId)
  if (agg.version === 0) {
    throw kernelError("AGGREGATE_NOT_FOUND", `No ${aggregateType} "${aggregateId}" exists in this venue`)
  }
  return agg
}

export async function saveAggregate(store: EventStore, agg: Aggregate): Promise<StoredEvent[]> {
  if (agg.uncommittedEvents.length === 0) return []
  const pending = [...agg.uncommittedEvents]
  const committed = await store.appendMany(pending, { expectedVersion: agg.expectedVersion })
  agg.markCommitted(committed)
  return committed
}

/**
 * Append a single event directly to an aggregate stream (e.g. kitchen
 * line-status updates on an Order stream). Bumps version with optimistic
 * locking; the aggregate's applyEvent is the reducer that decides its effect.
 */
export async function appendEvent(
  store: EventStore,
  tenant: TenantContext,
  aggregateType: string,
  aggregateId: Id,
  eventType: string,
  payload: AttributeBag,
  actor?: ActorContext
): Promise<StoredEvent> {
  const current = await store.readAggregate(tenant, aggregateType, aggregateId)
  const version = current.length > 0 ? current[current.length - 1].aggregateVersion : 0
  const event = buildEvent({
    eventType,
    aggregateType,
    aggregateId,
    aggregateVersion: version + 1,
    tenant,
    payload,
    actor,
  })
  return store.append(event, { expectedVersion: version })
}
