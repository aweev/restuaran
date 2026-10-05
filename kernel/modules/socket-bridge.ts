import { AttributeBag, StoredEvent } from "@/kernel/types"

export interface SocketEmit {
  room: string | string[]
  event: string
  data: AttributeBag
}

/** Transport seam: in prod this POSTs to the standalone Socket.IO server. */
export interface SocketTransport {
  emit(emit: SocketEmit): Promise<void>
}

/** Semantic rooms the kernel broadcasts to, resolved to concrete socket rooms. */
export type SemanticRoom =
  | "allStations"
  | "management"
  | "kitchen"
  | "servers"
  | "reception"
  | "backOffice"

/** Default map onto the rooms the existing standalone server actually joins. */
export const DEFAULT_ROOM_MAP: Record<SemanticRoom, string[]> = {
  allStations: ["admin", "kitchen", "server"],
  management: ["admin"],
  kitchen: ["kitchen", "admin"],
  servers: ["server"],
  // host/reception and back-office stations are not separate rooms yet in the
  // legacy server; route to admin so the signal is never dropped.
  reception: ["admin"],
  backOffice: ["admin"],
}

export interface EventRoute {
  rooms: (event: StoredEvent, resolve: (r: SemanticRoom) => string[]) => string[]
  /** Legacy event name + payload for existing UI listeners (additive alias). */
  legacy?: (event: StoredEvent) => { event: string; data: AttributeBag } | null
  /** Skip bridging entirely (internal-only events). */
  silent?: boolean
}

const st = (e: StoredEvent) => (e.payload.serverId as string) ?? null
const cu = (e: StoredEvent) => (e.payload.customerId as string) ?? null

export const DEFAULT_ROUTES: Record<string, EventRoute> = {
  "order.created": {
    rooms: (_e, r) => [...r("allStations")],
    legacy: (e) => ({ event: "order_new", data: legacyOrder(e) }),
  },
  "order.lineAdded": {
    rooms: (e, r) => [...r("allStations"), ...withServer(e)],
    legacy: (e) => ({ event: "order_update", data: legacyOrder(e) }),
  },
  "order.sentToKitchen": {
    rooms: (e, r) => [...r("kitchen"), ...withServer(e)],
    legacy: (e) => ({ event: "order_preparing", data: { orderId: e.aggregateId, serverId: st(e) } }),
  },
  "order.paymentRecorded": { rooms: (e, r) => [...r("management"), ...withServer(e)] },
  "order.closed": {
    rooms: (e, r) => [...r("allStations"), ...withCustomer(e)],
    legacy: (e) => ({ event: "order_update", data: legacyOrder(e) }),
  },
  "order.voided": {
    rooms: (e, r) => [...r("allStations")],
    legacy: (e) => ({ event: "order_cancelled", data: legacyOrder(e) }),
  },
  "kitchen.lineBegan": { rooms: (_e, r) => [...r("kitchen")] },
  "kitchen.lineReady": {
    rooms: (e, r) => [...r("servers"), ...withServer(e)],
    legacy: (e) => ({ event: "order_ready", data: { orderId: e.aggregateId, serverId: st(e) } }),
  },
  "table.seated": { rooms: (_e, r) => [...r("allStations")] },
  "table.cleared": { rooms: (_e, r) => [...r("allStations")] },
  "table.cleaned": { rooms: (_e, r) => [...r("management")] },
  "reservation.booked": {
    rooms: (_e, r) => [...r("reception"), ...r("management")],
    legacy: (e) => ({ event: "reservation_new", data: legacyReservation(e) }),
  },
  "reservation.confirmed": {
    rooms: (_e, r) => [...r("reception")],
    legacy: (e) => ({ event: "reservation_update", data: legacyReservation(e) }),
  },
  "reservation.seated": { rooms: (_e, r) => [...r("allStations")] },
  "reservation.completed": { rooms: (_e, r) => [...r("reception")] },
  "reservation.cancelled": {
    rooms: (_e, r) => [...r("reception")],
    legacy: (e) => ({ event: "reservation_update", data: legacyReservation(e) }),
  },
  "reservation.noShow": { rooms: (_e, r) => [...r("reception")] },
  "reservation.rescheduled": { rooms: (_e, r) => [...r("reception")] },
  "reservation.detailsUpdated": { rooms: (_e, r) => [...r("reception")] },
  "waitlist.joined": { rooms: (_e, r) => [...r("reception")] },
  "waitlist.notified": { rooms: (_e, r) => [...r("reception")] },
  "waitlist.seated": { rooms: (_e, r) => [...r("allStations")] },
  "waitlist.removed": { rooms: (_e, r) => [...r("reception")] },
  "menu.eightySixed": { rooms: (_e, r) => [...r("kitchen"), ...r("servers")] },
  "menu.eightySixCleared": { rooms: (_e, r) => [...r("servers")] },
  "menu.priceChanged": { rooms: (_e, r) => [...r("servers")] },
  "shift.clockedIn": { rooms: (_e, r) => [...r("management")] },
  "shift.clockedOut": { rooms: (_e, r) => [...r("management")] },
  "inventory.consumed": { rooms: () => [], silent: true },
  "inventory.received": { rooms: (_e, r) => [...r("backOffice")] },
  "inventory.wasted": { rooms: (_e, r) => [...r("backOffice")] },
  "inventory.adjusted": { rooms: (_e, r) => [...r("backOffice")] },
  "inventory.itemUpdated": { rooms: (_e, r) => [...r("backOffice")] },
  "kitchen.stationAssigned": { rooms: (_e, r) => [...r("kitchen")] },
  "kitchen.stationCleared": { rooms: (_e, r) => [...r("kitchen")] },
  "customer.enrolled": { rooms: (_e, r) => [...r("reception")] },
  "giftcard.issued": { rooms: (_e, r) => [...r("management")] },
  "giftcard.redeemed": { rooms: (_e, r) => [...r("management")] },
  "giftcard.voided": { rooms: (_e, r) => [...r("management")] },
  "promotion.defined": { rooms: (_e, r) => [...r("management")] },
  "promotion.redeemed": { rooms: (_e, r) => [...r("management")] },
}

function withServer(e: StoredEvent): string[] {
  const s = st(e)
  return s ? [`server:${s}`] : []
}

function withCustomer(e: StoredEvent): string[] {
  const c = cu(e)
  return c ? [`customer:${c}`] : []
}

function legacyOrder(e: StoredEvent): AttributeBag {
  return {
    id: e.aggregateId,
    orderId: e.aggregateId,
    tableId: e.payload.tableId ?? null,
    serverId: st(e),
    status: String(e.payload.status ?? e.eventType.split(".")[1] ?? ""),
    updatedAt: e.occurredAt,
  }
}

function legacyReservation(e: StoredEvent): AttributeBag {
  return {
    id: e.aggregateId,
    customerName: e.payload.customerName ?? null,
    tableId: e.payload.tableId ?? null,
    status: e.payload.status ?? null,
    updatedAt: e.occurredAt,
  }
}

export interface SocketBridgeOptions {
  transport: SocketTransport
  routes?: Record<string, EventRoute>
  roomMap?: Record<SemanticRoom, string[]>
  /** Emit the canonical namespaced event alongside legacy aliases. Default true. */
  canonicalEvent?: boolean
  onError?: (err: unknown, emit: SocketEmit) => void
}

/**
 * Bridges kernel events to the socket layer:
 *  - canonical `ros.event` (tenant-scoped) for new OS-aware clients
 *  - legacy event names/rooms so existing UI keeps working unchanged
 */
export class SocketBridge {
  private routes: Record<string, EventRoute>
  private roomMap: Record<SemanticRoom, string[]>
  private canonical: boolean
  private onError?: (err: unknown, emit: SocketEmit) => void
  private published: SocketEmit[] = []

  constructor(private transport: SocketTransport, opts: Omit<SocketBridgeOptions, "transport"> = {}) {
    this.routes = opts.routes ?? DEFAULT_ROUTES
    this.roomMap = opts.roomMap ?? DEFAULT_ROOM_MAP
    this.canonical = opts.canonicalEvent ?? true
    this.onError = opts.onError
  }

  private resolve = (room: SemanticRoom): string[] => this.roomMap[room] ?? []

  private batch: SocketEmit[] = []
  private batchTimer: ReturnType<typeof setTimeout> | null = null
  private readonly batchWindowMs = 50
  private readonly maxBatchSize = 50

  /** Flushes coalesced emits: same (room-set, event) pairs merge into one payload. */
  async flush(): Promise<SocketEmit[]> {
    const pending = this.batch.splice(0, this.batch.length)
    if (this.batchTimer) { clearTimeout(this.batchTimer); this.batchTimer = null }
    if (pending.length === 0) return []
    const merged = new Map<string, SocketEmit>()
    for (const emit of pending) {
      const key = `${[...emit.room].sort().join(",")}::${emit.event}`
      const existing = merged.get(key)
      if (existing && Array.isArray((existing.data as { events?: unknown[] }).events)) {
        ;((existing.data as { events: unknown[] }).events as unknown[]).push(emit.data)
      } else if (existing) {
        existing.data = { events: [existing.data, emit.data] }
      } else {
        merged.set(key, { ...emit })
      }
      if (merged.size >= this.maxBatchSize) break
    }
    const out = [...merged.values()]
    for (const emit of out) {
      try {
        await this.transport.emit(emit)
      } catch (err) {
        if (this.onError) this.onError(err, emit)
        console.error(`[kernel:socket] failed to emit ${emit.event}`, err)
      }
    }
    this.published.push(...out)
    return out
  }

  private enqueue(emit: SocketEmit): void {
    this.batch.push(emit)
    if (this.batch.length >= this.maxBatchSize) { void this.flush(); return }
    if (!this.batchTimer) this.batchTimer = setTimeout(() => void this.flush(), this.batchWindowMs)
  }

  async handle(event: StoredEvent): Promise<SocketEmit[]> {
    const route = this.routes[event.eventType]
    if (!route || route.silent) return []
    const rooms = dedupe(route.rooms(event, this.resolve))
    if (rooms.length === 0) return []

    const emits: SocketEmit[] = []
    if (this.canonical) {
      emits.push({
        room: rooms,
        event: "ros.event",
        data: {
          orgId: event.tenant.orgId,
          venueId: event.tenant.venueId,
          eventType: event.eventType,
          aggregateType: event.aggregateType,
          aggregateId: event.aggregateId,
          occurredAt: event.occurredAt,
          payload: event.payload,
        },
      })
    }
    const legacy = route.legacy?.(event)
    if (legacy) emits.push({ room: rooms, event: legacy.event, data: legacy.data })

    for (const emit of emits) this.enqueue(emit)
    // Preserve the synchronous contract for tests: flush on next tick still
    // records immediately for the in-process transport.
    if (this.transport instanceof RecordingSocketTransport) await this.flush()
    return emits
  }

  /** Test/debug: every emit handled so far. */
  recentEmits(): SocketEmit[] {
    return [...this.published]
  }
}

function dedupe(arr: string[]): string[] {
  return [...new Set(arr)]
}

export interface HttpTransportOptions {
  url: string
  secret: string
  fetchImpl?: typeof fetch
}

/**
 * Production transport: POSTs to the standalone Socket.IO server's
 * /internal/emit endpoint (same contract as lib/socketEmitter.ts).
 */
export class HttpSocketTransport implements SocketTransport {
  private doFetch: typeof fetch
  constructor(private opts: HttpTransportOptions) {
    this.doFetch = opts.fetchImpl ?? fetch
  }

  async emit(payload: SocketEmit): Promise<void> {
    const res = await this.doFetch(`${this.opts.url.replace(/\/$/, "")}/internal/emit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, secret: this.opts.secret }),
    })
    if (!res.ok) {
      throw new Error(`socket emit failed: ${res.status} ${await res.text().catch(() => "")}`)
    }
  }
}

/** Transport that records emits in-process — tests, offline mode, embedded deployments. */
export class RecordingSocketTransport implements SocketTransport {
  readonly emitted: SocketEmit[] = []
  async emit(payload: SocketEmit): Promise<void> {
    this.emitted.push(payload)
  }
}
