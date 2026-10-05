import { AttributeBag, Id, kernelError, StoredEvent, TenantContext } from "@/kernel/types"
import { EventStore } from "@/kernel/event-store/event-store"

export type Reducer<TState> = (state: TState, event: StoredEvent) => TState

export interface ProjectionSpec<TState> {
  name: string
  initial: TState
  watchedEventTypes: string[]
  reduce: Reducer<TState>
  /** Persisted checkpoint: rebuild/catchUp resume after this globalPosition. */
  checkpoint?: number
}

export class Projection<TState> {
  private current: TState
  private cursor = 0
  private checkpoint: number | undefined
  private listeners = new Set<(state: TState) => void>()
  private unsubscribe: (() => void) | null = null

  constructor(readonly spec: ProjectionSpec<TState>, private store: EventStore, private tenant: TenantContext) {
    this.current = spec.initial
    this.checkpoint = spec.checkpoint
    if (spec.checkpoint != null) this.cursor = spec.checkpoint
  }

  get state(): TState {
    return this.current
  }

  get position(): number {
    return this.cursor
  }

  getPosition(): number {
    return this.cursor
  }

  setPosition(pos: number): void {
    this.cursor = pos
    this.checkpoint = pos
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
    this.checkpoint = this.cursor
    this.notify()
    return this.current
  }

  /** Incremental catch-up from the stored checkpoint (no full rebuild). */
  async catchUpFrom(position?: number): Promise<TState> {
    const from = position ?? this.checkpoint ?? this.cursor
    const events = await this.store.query({
      tenant: this.tenant,
      eventTypes: this.spec.watchedEventTypes,
      fromGlobalPosition: from,
    })
    for (const e of events) {
      if (e.globalPosition <= this.cursor) continue
      this.current = this.spec.reduce(this.current, e)
      this.cursor = Math.max(this.cursor, e.globalPosition)
    }
    this.checkpoint = this.cursor
    this.notify()
    return this.current
  }

  catchUp(): Promise<TState> {
    // Persisted checkpoint: incremental replay when we have one, full rebuild otherwise.
    if (this.checkpoint != null && this.checkpoint > 0) return this.catchUpFrom(this.checkpoint)
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

  async rebuildAll(concurrency = 4): Promise<void> {
    const all = [...this.projections.values()]
    for (let i = 0; i < all.length; i += concurrency) {
      await Promise.all(all.slice(i, i + concurrency).map((p) => p.rebuild()))
    }
  }

  /** Checkpoint-aware boot: projections with a saved cursor replay only what
   *  is new; the rest rebuild once. Falls back to full rebuild per projection. */
  async catchUpAll(concurrency = 4): Promise<void> {
    const all = [...this.projections.values()]
    for (let i = 0; i < all.length; i += concurrency) {
      await Promise.all(all.slice(i, i + concurrency).map((p) => p.catchUp()))
    }
  }

  positions(): Record<string, number> {
    const out: Record<string, number> = {}
    for (const [name, p] of this.projections) out[name] = p.position
    return out
  }

  applyCheckpoints(positions: Record<string, number>): void {
    for (const [name, pos] of Object.entries(positions)) {
      const p = this.projections.get(name)
      if (p && Number.isFinite(pos) && pos > 0) p.setPosition(pos)
    }
  }

  startAll(): void {
    for (const p of this.projections.values()) p.start()
  }

  stopAll(): void {
    for (const p of this.projections.values()) p.stop()
  }
}

export interface PageOptions {
  limit?: unknown
  cursor?: unknown
  defaultLimit?: number
  maxLimit?: number
}

export interface Page<T> {
  rows: T[]
  nextCursor: string | null
  total: number
}

function decodeCursor(cursor: unknown): number {
  if (typeof cursor !== "string" || cursor.length === 0) return 0
  try {
    const raw = Buffer.from(cursor, "base64").toString("utf8")
    const n = Number.parseInt(raw, 10)
    return Number.isFinite(n) && n >= 0 ? n : 0
  } catch {
    return 0
  }
}

/**
 * Cursor pagination over in-memory projection rows. `cursor` is an opaque
 * base64 offset; `limit` caps the page (default 50, max 200). Returns the
 * slice plus `nextCursor` (null when exhausted) and the full `total`.
 */
export function paginate<T>(rows: readonly T[], opts: PageOptions = {}): Page<T> {
  const max = opts.maxLimit ?? 200
  const def = opts.defaultLimit ?? 50
  const requested = typeof opts.limit === "string" ? Number(opts.limit) : Number(opts.limit)
  const limit = Number.isFinite(requested) ? Math.min(Math.max(Math.floor(requested), 1), max) : def
  const offset = decodeCursor(opts.cursor)
  const slice = rows.slice(offset, offset + limit)
  const next = offset + slice.length < rows.length
    ? Buffer.from(String(offset + slice.length), "utf8").toString("base64")
    : null
  return { rows: [...slice], nextCursor: next, total: rows.length }
}

/** Apply pagination only when the caller asked for it; otherwise passthrough. */
export function maybePaginate<T>(rows: T[], params: { limit?: unknown; cursor?: unknown }): T[] | Page<T> {
  if (params.limit == null && params.cursor == null) return rows
  return paginate(rows, { limit: params.limit, cursor: params.cursor })
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
