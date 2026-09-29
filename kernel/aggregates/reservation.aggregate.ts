import { ActorContext, AttributeBag, Id, kernelError, TenantContext } from "@/kernel/types"
import { Aggregate, AggregateEvent } from "./aggregate"

export type ReservationStatus =
  | "pending"
  | "confirmed"
  | "seated"
  | "completed"
  | "cancelled"
  | "no_show"

export interface ReservationState extends AttributeBag {
  customerName: string
  phone: string | null
  email: string | null
  partySize: number
  /** ISO date (YYYY-MM-DD) and time (HH:MM) of the booking slot */
  date: string
  time: string
  durationMinutes: number
  status: ReservationStatus
  tableId: Id | null
  source: "pos" | "phone" | "platform" | "walk_in"
  specialRequests: string | null
  cancelledReason: string | null
  history: Array<{ status: ReservationStatus; at: string; by: string }>
}

export interface NewReservation {
  customerName: string
  partySize: number
  date: string
  time: string
  phone?: string
  email?: string
  durationMinutes?: number
  source?: ReservationState["source"]
  specialRequests?: string
}

const TERMINAL: ReservationStatus[] = ["completed", "cancelled", "no_show"]

export class ReservationAggregate extends Aggregate<ReservationState> {
  static readonly TYPE = "Reservation"

  constructor(tenant: TenantContext) {
    super(ReservationAggregate.TYPE, tenant, {
      customerName: "",
      phone: null,
      email: null,
      partySize: 1,
      date: "",
      time: "",
      durationMinutes: 90,
      status: "pending",
      tableId: null,
      source: "pos",
      specialRequests: null,
      cancelledReason: null,
      history: [],
    })
  }

  static book(tenant: TenantContext, opts: NewReservation & { id: Id; actor: ActorContext }): ReservationAggregate {
    const agg = new ReservationAggregate(tenant)
    agg.initialize(opts.id)
    if (!opts.customerName?.trim()) throw kernelError("INVALID_RESERVATION", "Customer name is required")
    if (!Number.isInteger(opts.partySize) || opts.partySize <= 0) {
      throw kernelError("INVALID_RESERVATION", "Party size must be a positive integer")
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(opts.date)) throw kernelError("INVALID_RESERVATION", "Date must be YYYY-MM-DD")
    if (!/^\d{2}:\d{2}$/.test(opts.time)) throw kernelError("INVALID_RESERVATION", "Time must be HH:MM")
    agg.raise("reservation.booked", {
      status: "pending",
      customerName: opts.customerName,
      partySize: opts.partySize,
      date: opts.date,
      time: opts.time,
      phone: opts.phone ?? null,
      email: opts.email ?? null,
      durationMinutes: opts.durationMinutes ?? 90,
      source: opts.source ?? "pos",
      specialRequests: opts.specialRequests ?? null,
    }, opts.actor)
    return agg
  }

  confirm(actor: ActorContext, tableId?: Id): void {
    this.assertTransition("confirmed")
    if (tableId) this.raise("reservation.confirmed", { status: "confirmed", tableId }, actor)
    else this.raise("reservation.confirmed", { status: "confirmed" }, actor)
  }

  seat(actor: ActorContext, tableId: Id): void {
    if (this.state.status !== "confirmed" && this.state.status !== "pending") {
      throw kernelError("BAD_RESERVATION_STATE", `Cannot seat a ${this.state.status} reservation`)
    }
    if (!tableId) throw kernelError("TABLE_REQUIRED", "Seating requires a table")
    this.raise("reservation.seated", { status: "seated", tableId }, actor)
  }

  complete(actor: ActorContext): void {
    this.assertTransition("completed")
    this.raise("reservation.completed", { status: "completed" }, actor)
  }

  cancel(actor: ActorContext, reason?: string): void {
    this.assertTransition("cancelled")
    this.raise("reservation.cancelled", { status: "cancelled", cancelledReason: reason ?? null }, actor)
  }

  markNoShow(actor: ActorContext): void {
    this.assertTransition("no_show")
    this.raise("reservation.noShow", { status: "no_show" }, actor)
  }

  reschedule(actor: ActorContext, date: string, time: string): void {
    if (TERMINAL.includes(this.state.status)) {
      throw kernelError("BAD_RESERVATION_STATE", `Cannot reschedule a ${this.state.status} reservation`)
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw kernelError("INVALID_RESERVATION", "Date must be YYYY-MM-DD")
    if (!/^\d{2}:\d{2}$/.test(time)) throw kernelError("INVALID_RESERVATION", "Time must be HH:MM")
    this.raise("reservation.rescheduled", { date, time, status: this.state.status === "seated" ? "confirmed" : this.state.status }, actor)
  }

  isActive(): boolean {
    return !TERMINAL.includes(this.state.status)
  }

  slot(): string {
    return `${this.state.date} ${this.state.time}`
  }

  private assertTransition(next: ReservationStatus): void {
    if (TERMINAL.includes(this.state.status)) {
      throw kernelError("BAD_RESERVATION_STATE", `Cannot move ${this.state.status} reservation to ${next}`)
    }
  }

  protected applyEvent(event: AggregateEvent): ReservationState {
    const s = this.state
    switch (event.eventType) {
      case "reservation.booked":
      case "reservation.confirmed":
      case "reservation.seated":
      case "reservation.completed":
      case "reservation.cancelled":
      case "reservation.noShow":
      case "reservation.rescheduled": {
        const next = { ...s, ...event.payload } as ReservationState
        return {
          ...next,
          history: [...s.history, { status: next.status, at: event.occurredAt, by: event.actor?.userId ?? "system" }],
        }
      }
      default:
        return s
    }
  }
}
