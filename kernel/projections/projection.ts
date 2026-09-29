import { AttributeBag, Id, kernelError, StoredEvent, TenantContext } from "@/kernel/types"
import { EventStore } from "@/kernel/event-store/event-store"

export type Reducer<TState> = (state: TState, event: StoredEvent) => TState

export interface ProjectionSpec<TState> {
  name: string
  initial: TState
  watchedEventTypes: string[]
  reduce: Reducer<TState>
}

export class Projection<TState> {
  private current: TState
  private cursor = 0
  private listeners = new Set<(state: TState) => void>()
  private unsubscribe: (() => void) | null = null

  constructor(readonly spec: ProjectionSpec<TState>, private store: EventStore, private tenant: TenantContext) {
    this.current = spec.initial
  }

  get state(): TState {
    return this.current
  }

  get position(): number {
    return this.cursor
  }

  matches(event: StoredEvent): boolean {
    return (
      event.tenant.orgId === this.tenant.orgId &&
      event.tenant.venueId === this.tenant.venueId &&
      this.spec.watchedEventTypes.includes(event.eventType)
    )
  }

  async rebuild(): Promise<TState> {
    this.current = this.spec.initial
    this.cursor = 0
    const events = await this.store.query({
      tenant: this.tenant,
      eventTypes: this.spec.watchedEventTypes,
    })
    for (const e of events) {
      this.current = this.spec.reduce(this.current, e)
      this.cursor = Math.max(this.cursor, e.globalPosition)
    }
    this.notify()
    return this.current
  }

  catchUp(): Promise<TState> {
    return this.rebuild()
  }

  apply(event: StoredEvent): void {
    if (!this.matches(event)) return
    if (event.globalPosition <= this.cursor) return
    this.current = this.spec.reduce(this.current, event)
    this.cursor = event.globalPosition
    this.notify()
  }

  start(): void {
    if (this.unsubscribe) return
    this.unsubscribe = this.store.subscribe((event) => this.apply(event))
  }

  stop(): void {
    this.unsubscribe?.()
    this.unsubscribe = null
  }

  onChange(listener: (state: TState) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private notify(): void {
    for (const l of this.listeners) {
      try {
        l(this.current)
      } catch (err) {
        console.error(`[kernel:projection:${this.spec.name}] onChange failed:`, err)
      }
    }
  }
}

export class ProjectionRegistry {
  private projections = new Map<string, Projection<unknown>>()

  register<TState>(projection: Projection<TState>): Projection<TState> {
    if (this.projections.has(projection.spec.name)) {
      throw kernelError("DUPLICATE_PROJECTION", `Projection already registered: ${projection.spec.name}`)
    }
    this.projections.set(projection.spec.name, projection as Projection<unknown>)
    return projection
  }

  get<TState>(name: string): Projection<TState> {
    const p = this.projections.get(name)
    if (!p) throw kernelError("UNKNOWN_PROJECTION", `No projection registered named "${name}"`)
    return p as Projection<TState>
  }

  names(): string[] {
    return [...this.projections.keys()]
  }

  async rebuildAll(): Promise<void> {
    for (const p of this.projections.values()) {
      await p.rebuild()
    }
  }

  startAll(): void {
    for (const p of this.projections.values()) p.start()
  }

  stopAll(): void {
    for (const p of this.projections.values()) p.stop()
  }
}

// Convenience factory: define a projection from a plain spec.
export function defineProjection<TState extends AttributeBag>(
  spec: ProjectionSpec<TState>,
  store: EventStore,
  tenant: TenantContext
): Projection<TState> {
  return new Projection(spec, store, tenant)
}

export type { Id, AttributeBag }