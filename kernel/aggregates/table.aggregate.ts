import { ActorContext, AttributeBag, Id, kernelError, TenantContext } from "@/kernel/types"
import { Aggregate, AggregateEvent } from "./aggregate"

export type TableStatus = "available" | "occupied" | "reserved" | "dirty" | "out_of_service"

/**
 * Floor-plan geometry. The floor-plan editor persists positions as absolute
 * pixels on a fixed-size canvas, so these are stored as authored rather than
 * normalised — a manager dragging a table expects it to stay where they dropped
 * it.
 */
export interface TableGeometry extends AttributeBag {
  /** Canvas pixels. Absent until the table is placed on a floor plan. */
  x: number | null
  y: number | null
  width: number
  height: number
  shape: "round" | "square" | "rect"
  /** Section of the room: "main", "patio", "bar", "booth". */
  zone: string
}

export interface TableState extends AttributeBag, TableGeometry {
  label: string
  capacity: number
  status: TableStatus
  serverId: Id | null
  currentOrderId: Id | null
  seatedAt: string | null
  reservationId: Id | null
  floor: string
}

/** Guard rails so a bad drag cannot produce an unrecoverable floor plan. */
export const FLOOR_CANVAS = { width: 4000, height: 3000 }
export const MIN_TABLE_SIZE = 40
export const MAX_TABLE_SIZE = 1000

export class TableAggregate extends Aggregate<TableState> {
  static readonly TYPE = "Table"

  constructor(tenant: TenantContext) {
    super(TableAggregate.TYPE, tenant, {
      label: "",
      capacity: 2,
      status: "available",
      serverId: null,
      currentOrderId: null,
      seatedAt: null,
      reservationId: null,
      floor: "main",
      x: null,
      y: null,
      width: 80,
      height: 80,
      shape: "round",
      zone: "main",
    })
  }

  static define(tenant: TenantContext, opts: {
    id: Id
    label: string
    capacity: number
    floor?: string
    x?: number
    y?: number
    width?: number
    height?: number
    shape?: TableGeometry["shape"]
    zone?: string
    actor: ActorContext
  }): TableAggregate {
    const agg = new TableAggregate(tenant)
    agg.initialize(opts.id)
    agg.raise(
      "table.created",
      {
        label: opts.label,
        capacity: opts.capacity,
        floor: opts.floor ?? "main",
        x: opts.x ?? null,
        y: opts.y ?? null,
        width: opts.width ?? 80,
        height: opts.height ?? 80,
        shape: opts.shape ?? "round",
        zone: opts.zone ?? "main",
      },
      opts.actor
    )
    return agg
  }

  /**
   * Move or resize a table on the floor plan.
   *
   * Rejects geometry that would sit partly off-canvas or collapse a table to
   * nothing, because either mistake is invisible on screen until the layout is
   * already saved — at which point staff cannot click the table at all.
   */
  reposition(
    actor: ActorContext,
    patch: { x?: number; y?: number; width?: number; height?: number; shape?: TableGeometry["shape"]; zone?: string },
  ): void {
    const next = {
      x: patch.x ?? this.state.x,
      y: patch.y ?? this.state.y,
      width: patch.width ?? this.state.width,
      height: patch.height ?? this.state.height,
      shape: patch.shape ?? this.state.shape,
      zone: patch.zone ?? this.state.zone,
    }

    if (!Number.isFinite(next.width) || !Number.isFinite(next.height)) {
      throw kernelError("INVALID_GEOMETRY", "Table size must be a finite number")
    }
    if (next.width < MIN_TABLE_SIZE || next.height < MIN_TABLE_SIZE) {
      throw kernelError("INVALID_GEOMETRY", `Table must be at least ${MIN_TABLE_SIZE}x${MIN_TABLE_SIZE}`)
    }
    if (next.width > MAX_TABLE_SIZE || next.height > MAX_TABLE_SIZE) {
      throw kernelError("INVALID_GEOMETRY", `Table must be at most ${MAX_TABLE_SIZE}x${MAX_TABLE_SIZE}`)
    }
    if (next.x != null && (next.x < 0 || next.x + next.width > FLOOR_CANVAS.width)) {
      throw kernelError("INVALID_GEOMETRY", "Table falls outside the floor plan horizontally")
    }
    if (next.y != null && (next.y < 0 || next.y + next.height > FLOOR_CANVAS.height)) {
      throw kernelError("INVALID_GEOMETRY", "Table falls outside the floor plan vertically")
    }
    if (!["round", "square", "rect"].includes(next.shape)) {
      throw kernelError("INVALID_GEOMETRY", "Unknown table shape")
    }

    this.raise("table.repositioned", next, actor)
  }

  seat(actor: ActorContext, orderId: Id, serverId: Id, seatedAt?: string): void {
    if (this.state.status === "occupied") throw kernelError("TABLE_OCCUPIED", `Table ${this.state.label} is occupied`)
    this.raise("table.seated", { currentOrderId: orderId, serverId, seatedAt: seatedAt ?? new Date().toISOString() }, actor)
  }

  clear(actor: ActorContext): void {
    if (this.state.status !== "occupied") throw kernelError("TABLE_NOT_OCCUPIED", "Nothing to clear")
    this.raise("table.cleared", { status: "dirty", currentOrderId: null, serverId: null, seatedAt: null }, actor)
  }

  markClean(actor: ActorContext): void {
    if (this.state.status !== "dirty") throw kernelError("TABLE_NOT_DIRTY", "Table is not dirty")
    this.raise("table.cleaned", { status: "available" }, actor)
  }

  reserve(actor: ActorContext, reservationId: Id): void {
    if (this.state.status !== "available") throw kernelError("TABLE_NOT_AVAILABLE", `Table is ${this.state.status}`)
    this.raise("table.reserved", { reservationId, status: "reserved" }, actor)
  }

  releaseReservation(actor: ActorContext): void {
    this.raise("table.reservationReleased", { reservationId: null, status: "available" }, actor)
  }

  /**
   * Take a table out of service (broken chair, in the wash, seasonal).
   *
   * There is deliberately no hard delete: the floor plan's history is an audit
   * trail, and a removed table must not silently vanish from the event log.
   */
  takeOutOfService(actor: ActorContext, reason?: string): void {
    if (this.state.status === "occupied") {
      throw kernelError("TABLE_OCCUPIED", "Clear the table before taking it out of service")
    }
    if (this.state.status === "out_of_service") {
      throw kernelError("TABLE_NOT_OUT_OF_SERVICE", "Table is already out of service")
    }
    this.raise("table.outOfService", { status: "out_of_service", reason: reason ?? "out of service" }, actor)
  }

  /** Return an out-of-service table to the floor. */
  returnToService(actor: ActorContext): void {
    if (this.state.status !== "out_of_service") {
      throw kernelError("TABLE_NOT_OUT_OF_SERVICE", `Table is ${this.state.status}`)
    }
    this.raise("table.returnedToService", { status: "available" }, actor)
  }

  protected applyEvent(event: AggregateEvent): TableState {
    const s = this.state
    switch (event.eventType) {
      case "table.created":
        return { ...s, ...event.payload }
      case "table.seated":
        return { ...s, status: "occupied", ...event.payload }
      case "table.cleared":
      case "table.cleaned":
      case "table.reserved":
      case "table.reservationReleased":
      case "table.outOfService":
      case "table.returnedToService":
      case "table.repositioned":
        return { ...s, ...event.payload }
      default:
        return s
    }
  }
}
