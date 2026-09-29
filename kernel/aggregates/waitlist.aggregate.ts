import { ActorContext, AttributeBag, Id, kernelError, TenantContext } from "@/kernel/types"
import { Aggregate, AggregateEvent } from "./aggregate"

export type WaitlistStatus = "waiting" | "notified" | "seated" | "removed" | "no_show"

export interface WaitlistState extends AttributeBag {
  customerName: string
  phone: string | null
  partySize: number
  status: WaitlistStatus
  position: number
  joinedAt: string
  notifiedAt: string | null
  seatedAt: string | null
  tableId: Id | null
  notes: string | null
}

export class WaitlistAggregate extends Aggregate<WaitlistState> {
  static readonly TYPE = "WaitlistEntry"

  constructor(tenant: TenantContext) {
    super(WaitlistAggregate.TYPE, tenant, {
      customerName: "",
      phone: null,
      partySize: 1,
      status: "waiting",
      position: 0,
      joinedAt: "",
      notifiedAt: null,
      seatedAt: null,
      tableId: null,
      notes: null,
    })
  }

  static join(tenant: TenantContext, opts: {
    id: Id
    customerName: string
    partySize: number
    phone?: string
    notes?: string
    /** queue depth at join time (aggregate itself cannot see the queue) */
    position: number
    actor: ActorContext
  }): WaitlistAggregate {
    const agg = new WaitlistAggregate(tenant)
    agg.initialize(opts.id)
    if (!opts.customerName?.trim()) throw kernelError("INVALID_WAITLIST", "Customer name is required")
    if (!Number.isInteger(opts.partySize) || opts.partySize <= 0) {
      throw kernelError("INVALID_WAITLIST", "Party size must be a positive integer")
    }
    agg.raise("waitlist.joined", {
      customerName: opts.customerName,
      partySize: opts.partySize,
      phone: opts.phone ?? null,
      notes: opts.notes ?? null,
      position: opts.position,
      joinedAt: new Date().toISOString(),
    }, opts.actor)
    return agg
  }

  notify(actor: ActorContext): void {
    if (this.state.status !== "waiting") {
      throw kernelError("BAD_WAITLIST_STATE", `Cannot notify a ${this.state.status} entry`)
    }
    this.raise("waitlist.notified", { status: "notified", notifiedAt: new Date().toISOString() }, actor)
  }

  seat(actor: ActorContext, tableId: Id): void {
    if (this.state.status !== "waiting" && this.state.status !== "notified") {
      throw kernelError("BAD_WAITLIST_STATE", `Cannot seat a ${this.state.status} entry`)
    }
    if (!tableId) throw kernelError("TABLE_REQUIRED", "Seating requires a table")
    this.raise("waitlist.seated", { status: "seated", tableId, seatedAt: new Date().toISOString() }, actor)
  }

  remove(actor: ActorContext, reason?: string): void {
    if (this.state.status === "seated") throw kernelError("BAD_WAITLIST_STATE", "Cannot remove a seated party")
    this.raise("waitlist.removed", { status: "removed", notes: reason ?? this.state.notes }, actor)
  }

  markNoShow(actor: ActorContext): void {
    if (this.state.status !== "notified") throw kernelError("BAD_WAITLIST_STATE", "Only notified entries can be marked no-show")
    this.raise("waitlist.noShow", { status: "no_show" }, actor)
  }

  isWaiting(): boolean {
    return this.state.status === "waiting" || this.state.status === "notified"
  }

  protected applyEvent(event: AggregateEvent): WaitlistState {
    switch (event.eventType) {
      case "waitlist.joined":
      case "waitlist.notified":
      case "waitlist.seated":
      case "waitlist.removed":
      case "waitlist.noShow":
        return { ...this.state, ...event.payload } as WaitlistState
      default:
        return this.state
    }
  }
}
