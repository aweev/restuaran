import { ActorContext, AttributeBag, Id, kernelError, TenantContext } from "@/kernel/types"
import { Aggregate, AggregateEvent } from "./aggregate"

export type TableStatus = "available" | "occupied" | "reserved" | "dirty" | "out_of_service"

export interface TableState extends AttributeBag {
  label: string
  capacity: number
  status: TableStatus
  serverId: Id | null
  currentOrderId: Id | null
  seatedAt: string | null
  reservationId: Id | null
  floor: string
}

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
    })
  }

  static define(tenant: TenantContext, opts: {
    id: Id
    label: string
    capacity: number
    floor?: string
    actor: ActorContext
  }): TableAggregate {
    const agg = new TableAggregate(tenant)
    agg.initialize(opts.id)
    agg.raise(
      "table.created",
      { label: opts.label, capacity: opts.capacity, floor: opts.floor ?? "main" },
      opts.actor
    )
    return agg
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
        return { ...s, ...event.payload }
      default:
        return s
    }
  }
}
