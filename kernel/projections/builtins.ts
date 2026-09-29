import { AttributeBag, Id, StoredEvent, TenantContext } from "@/kernel/types"
import { EventStore } from "@/kernel/event-store/event-store"
import { Projection, defineProjection } from "./projection"

export interface KitchenTicketLine {
  lineId: Id
  name: string
  quantity: number
  modifiers: string[]
  course?: number
  status: "sent" | "preparing" | "ready"
}

export interface KitchenTicket {
  orderId: Id
  tableLabel: string
  dinerName: string | null
  sentAt: string
  lines: KitchenTicketLine[]
  status: "queued" | "in_progress" | "ready"
}

export interface KitchenQueueState extends AttributeBag {
  tickets: KitchenTicket[]
}

export function kitchenQueueProjection(store: EventStore, tenant: TenantContext): Projection<KitchenQueueState> {
  return defineProjection<KitchenQueueState>(
    {
      name: "kitchen.queue",
      initial: { tickets: [] },
      watchedEventTypes: [
        "order.sentToKitchen",
        "kitchen.lineBegan",
        "kitchen.lineReady",
        "kitchen.lineServed",
        "order.lineVoided",
        "order.voided",
        "order.closed",
      ],
      reduce: (state, event): KitchenQueueState => {
        switch (event.eventType) {
          case "order.sentToKitchen": {
            const p = event.payload as {
              lineIds: Id[]
              lines: Array<Omit<KitchenTicketLine, "status" | "lineId"> & { lineId: Id }>
              tableId?: Id | null
              dinerName?: string | null
            }
            const ids = new Set(p.lineIds)
            const added: KitchenTicketLine[] = (p.lines ?? [])
              .filter((l) => ids.has(l.lineId))
              .map((l) => ({ ...l, status: "sent" as const }))
            const existing = state.tickets.find((t) => t.orderId === event.aggregateId)
            if (existing) {
              return {
                tickets: state.tickets.map((t) =>
                  t.orderId === event.aggregateId ? { ...t, lines: [...t.lines, ...added], status: "queued" } : t
                ),
              }
            }
            return {
              tickets: [
                ...state.tickets,
                {
                  orderId: event.aggregateId,
                  tableLabel: String(p.tableId ?? "?"),
                  dinerName: p.dinerName ? String(p.dinerName) : null,
                  sentAt: event.occurredAt,
                  lines: added,
                  status: "queued",
                },
              ],
            }
          }
          case "kitchen.lineBegan": {
            const lineId = event.payload.lineId as Id
            return setLine(state, event.aggregateId, lineId, "preparing")
          }
          case "kitchen.lineReady": {
            const lineId = event.payload.lineId as Id
            return setLine(state, event.aggregateId, lineId, "ready")
          }
          case "kitchen.lineServed":
          case "order.lineVoided":
            return dropLine(state, event.aggregateId, event.payload.lineId as Id)
          case "order.voided":
          case "order.closed":
            return { tickets: state.tickets.filter((t) => t.orderId !== event.aggregateId) }
          default:
            return state
        }
      },
    },
    store,
    tenant
  )
}

function setLine(state: KitchenQueueState, orderId: Id, lineId: Id, status: KitchenTicketLine["status"]): KitchenQueueState {
  return {
    tickets: state.tickets.map((t) => {
      if (t.orderId !== orderId) return t
      const lines = t.lines.map((l) => (l.lineId === lineId ? { ...l, status } : l))
      const ticketStatus: KitchenTicket["status"] = lines.every((l) => l.status === "ready")
        ? "ready"
        : lines.some((l) => l.status !== "sent")
          ? "in_progress"
          : "queued"
      return { ...t, lines, status: ticketStatus }
    }),
  }
}

function dropLine(state: KitchenQueueState, orderId: Id, lineId: Id): KitchenQueueState {
  return {
    tickets: state.tickets
      .map((t) => (t.orderId === orderId ? { ...t, lines: t.lines.filter((l) => l.lineId !== lineId) } : t))
      .filter((t) => t.orderId !== orderId || t.lines.length > 0),
  }
}

export interface TableBoardRow {
  tableId: Id
  label: string
  capacity: number
  floor: string
  status: string
  serverId: Id | null
  currentOrderId: Id | null
  seatedAt: string | null
}

export interface TableBoardState extends AttributeBag {
  rows: TableBoardRow[]
}

export function tableBoardProjection(store: EventStore, tenant: TenantContext): Projection<TableBoardState> {
  return defineProjection<TableBoardState>(
    {
      name: "tables.board",
      initial: { rows: [] },
      watchedEventTypes: [
        "table.created",
        "table.seated",
        "table.cleared",
        "table.cleaned",
        "table.reserved",
        "table.reservationReleased",
      ],
      reduce: (state, event): TableBoardState => {
        const rows = [...state.rows]
        const idx = rows.findIndex((r) => r.tableId === event.aggregateId)
        const p = event.payload as Record<string, unknown>
        const base: TableBoardRow =
          idx >= 0 ? rows[idx] : { tableId: event.aggregateId, label: "?", capacity: 0, floor: "main", status: "available", serverId: null, currentOrderId: null, seatedAt: null }
        const next: TableBoardRow = { ...base }
        switch (event.eventType) {
          case "table.created":
            next.label = String(p.label ?? "?")
            next.capacity = Number(p.capacity ?? 0)
            next.floor = String(p.floor ?? "main")
            break
          case "table.seated":
            next.status = "occupied"
            next.currentOrderId = (p.currentOrderId as Id) ?? null
            next.serverId = (p.serverId as Id) ?? null
            next.seatedAt = (p.seatedAt as string) ?? event.occurredAt
            break
          case "table.cleared":
            next.status = "dirty"
            next.currentOrderId = null
            next.serverId = null
            next.seatedAt = null
            break
          case "table.cleaned":
            next.status = "available"
            break
          case "table.reserved":
            next.status = "reserved"
            break
          case "table.reservationReleased":
            next.status = "available"
            break
        }
        if (idx >= 0) rows[idx] = next
        else rows.push(next)
        return { rows }
      },
    },
    store,
    tenant
  )
}

export interface InventoryRow {
  itemId: Id
  sku: string
  name: string
  unit: string
  onHand: number
  available: number
  reorderPoint: number
}

export interface InventoryBoardState extends AttributeBag {
  rows: InventoryRow[]
}

export function inventoryBoardProjection(store: EventStore, tenant: TenantContext): Projection<InventoryBoardState> {
  return defineProjection<InventoryBoardState>(
    {
      name: "inventory.board",
      initial: { rows: [] },
      watchedEventTypes: [
        "inventory.itemDefined",
        "inventory.received",
        "inventory.consumed",
        "inventory.wasted",
        "inventory.adjusted",
      ],
      reduce: (state, event): InventoryBoardState => {
        const rows = [...state.rows]
        const idx = rows.findIndex((r) => r.itemId === event.aggregateId)
        const p = event.payload as Record<string, unknown>
        const base: InventoryRow =
          idx >= 0
            ? rows[idx]
            : { itemId: event.aggregateId, sku: "", name: "", unit: "ea", onHand: 0, available: 0, reorderPoint: 0 }
        const next: InventoryRow = { ...base }
        switch (event.eventType) {
          case "inventory.itemDefined":
            next.sku = String(p.sku ?? "")
            next.name = String(p.name ?? "")
            next.unit = String(p.unit ?? "ea")
            next.reorderPoint = Number(p.reorderPoint ?? 0)
            break
          case "inventory.received":
            next.onHand += Number(p.delta ?? 0)
            break
          case "inventory.consumed":
          case "inventory.wasted":
            next.onHand -= Number(p.delta ?? 0)
            break
          case "inventory.adjusted":
            next.onHand = Number(p.target ?? next.onHand)
            break
        }
        next.available = next.onHand
        if (idx >= 0) rows[idx] = next
        else rows.push(next)
        return { rows }
      },
    },
    store,
    tenant
  )
}

export type { StoredEvent }
