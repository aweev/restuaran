import {
  ActorContext,
  AttributeBag,
  DomainEvent,
  Id,
  kernelError,
  TenantContext,
} from "@/kernel/types"
import { buildEvent } from "@/kernel/event-store/event-store"

export type AggregateEvent<TPayload extends AttributeBag = AttributeBag> = Omit<
  DomainEvent<TPayload>,
  "globalPosition"
>

export abstract class Aggregate<TState extends AttributeBag = AttributeBag> {
  readonly aggregateType: string
  readonly tenant: TenantContext

  private _id: Id | null = null
  private _version = 0
  private _state: TState
  private _uncommitted: AggregateEvent[] = []

  protected constructor(aggregateType: string, tenant: TenantContext, initialState: TState) {
    this.aggregateType = aggregateType
    this.tenant = tenant
    this._state = initialState
  }

  get id(): Id {
    if (!this._id) throw kernelError("AGGREGATE_UNINITIALIZED", `${this.aggregateType} has no id yet`)
    return this._id
  }

  get version(): number {
    return this._version
  }

  /**
   * True once the stream has history (committed events / snapshot) or a
   * genesis event raised this same unit of work. A loaded aggregate with no
   * events and no pending creation does NOT exist — callers use
   * requireAggregate() to reject mutations against unknown ids instead of
   * silently spawning an orphan stream.
   */
  get exists(): boolean {
    return this._version > 0 || this._uncommitted.length > 0
  }

  get state(): Readonly<TState> {
    return this._state
  }

  get uncommittedEvents(): readonly AggregateEvent[] {
    return this._uncommitted
  }

  get expectedVersion(): number {
    return this._version
  }

  protected raise<TPayload extends AttributeBag>(
    eventType: string,
    payload: TPayload,
    actor?: ActorContext
  ): void {
    const event = buildEvent({
      eventType,
      aggregateType: this.aggregateType,
      aggregateId: this.id,
      aggregateVersion: this._version + this._uncommitted.length + 1,
      tenant: this.tenant,
      payload,
      actor,
    })
    this._uncommitted.push(event)
    this._state = this.applyEvent(event)
  }

  markCommitted(committed: readonly AggregateEvent[]): void {
    if (committed.length > this._uncommitted.length) {
      throw kernelError("COMMIT_MISMATCH", "More committed events than pending")
    }
    this._uncommitted = this._uncommitted.slice(committed.length)
    this._version = Math.max(this._version, ...committed.map((e) => e.aggregateVersion))
  }

  restoreFromSnapshot(version: number, state: TState): void {
    this._version = version
    this._state = state
  }

  replay(event: AggregateEvent): void {
    if (event.aggregateVersion <= this._version) return
    if (event.aggregateVersion !== this._version + 1) {
      throw kernelError(
        "VERSION_GAP",
        `Missing event for ${this.aggregateType}/${this.id}: expected v${this._version + 1}, got v${event.aggregateVersion}`
      )
    }
    this._state = this.applyEvent(event)
    this._version = event.aggregateVersion
  }

  protected initialize(id: Id): void {
    this._id = id
  }

  protected abstract applyEvent(event: AggregateEvent): TState
}
