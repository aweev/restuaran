import { ActorContext, AttributeBag, Id, kernelError, TenantContext } from "@/kernel/types"
import { Aggregate, AggregateEvent } from "./aggregate"

export type ShiftStatus = "scheduled" | "clocked_in" | "on_break" | "clocked_out"

export interface StaffShiftState extends AttributeBag {
  staffId: Id
  position: string
  locationLabel: string
  scheduledStart: string | null
  scheduledEnd: string | null
  status: ShiftStatus
  clockInAt: string | null
  clockOutAt: string | null
  breaks: Array<{ startAt: string; endAt: string | null }>
  notes: string | null
}

export class StaffShiftAggregate extends Aggregate<StaffShiftState> {
  static readonly TYPE = "StaffShift"

  constructor(tenant: TenantContext) {
    super(StaffShiftAggregate.TYPE, tenant, {
      staffId: "",
      position: "",
      locationLabel: "",
      scheduledStart: null,
      scheduledEnd: null,
      status: "scheduled",
      clockInAt: null,
      clockOutAt: null,
      breaks: [],
      notes: null,
    })
  }

  static schedule(tenant: TenantContext, opts: {
    id: Id
    staffId: Id
    position: string
    scheduledStart: string
    scheduledEnd: string
    locationLabel?: string
    actor: ActorContext
  }): StaffShiftAggregate {
    const agg = new StaffShiftAggregate(tenant)
    agg.initialize(opts.id)
    if (!opts.staffId) throw kernelError("INVALID_SHIFT", "staffId is required")
    const start = Date.parse(opts.scheduledStart)
    const end = Date.parse(opts.scheduledEnd)
    if (Number.isNaN(start) || Number.isNaN(end) || end <= start) {
      throw kernelError("INVALID_SHIFT", "Scheduled end must be after start")
    }
    agg.raise("shift.scheduled", {
      staffId: opts.staffId,
      position: opts.position,
      scheduledStart: opts.scheduledStart,
      scheduledEnd: opts.scheduledEnd,
      locationLabel: opts.locationLabel ?? "",
    }, opts.actor)
    return agg
  }

  clockIn(actor: ActorContext, at?: string): void {
    if (this.state.status !== "scheduled") {
      throw kernelError("BAD_SHIFT_STATE", `Cannot clock in from ${this.state.status}`)
    }
    this.raise("shift.clockedIn", { status: "clocked_in", clockInAt: at ?? new Date().toISOString() }, actor)
  }

  startBreak(actor: ActorContext): void {
    if (this.state.status !== "clocked_in") throw kernelError("BAD_SHIFT_STATE", "Breaks are only allowed while clocked in")
    this.raise("shift.breakStarted", { status: "on_break" }, actor)
  }

  endBreak(actor: ActorContext): void {
    if (this.state.status !== "on_break") throw kernelError("BAD_SHIFT_STATE", "No break in progress")
    this.raise("shift.breakEnded", { status: "clocked_in" }, actor)
  }

  clockOut(actor: ActorContext, at?: string): void {
    if (this.state.status !== "clocked_in" && this.state.status !== "on_break") {
      throw kernelError("BAD_SHIFT_STATE", `Cannot clock out from ${this.state.status}`)
    }
    this.raise("shift.clockedOut", { status: "clocked_out", clockOutAt: at ?? new Date().toISOString() }, actor)
  }

  workedSeconds(): number {
    const { clockInAt, clockOutAt, breaks } = this.state
    if (!clockInAt) return 0
    const end = clockOutAt ? Date.parse(clockOutAt) : Date.now()
    let total = end - Date.parse(clockInAt)
    for (const b of breaks) {
      if (b.endAt) total -= Date.parse(b.endAt) - Date.parse(b.startAt)
      else total -= end - Date.parse(b.startAt)
    }
    return Math.max(0, Math.floor(total / 1000))
  }

  isOvertime(maxHoursPerShift = 10): boolean {
    return this.workedSeconds() / 3600 > maxHoursPerShift
  }

  protected applyEvent(event: AggregateEvent): StaffShiftState {
    const s = this.state
    switch (event.eventType) {
      case "shift.scheduled":
      case "shift.clockedIn":
      case "shift.clockedOut":
        return { ...s, ...event.payload } as StaffShiftState
      case "shift.breakStarted": {
        const open = s.breaks.find((b) => b.endAt === null)
        if (open) return s
        return {
          ...s,
          status: "on_break",
          breaks: [...s.breaks, { startAt: event.occurredAt, endAt: null }],
        }
      }
      case "shift.breakEnded": {
        const breaks = s.breaks.map((b, i) =>
          i === s.breaks.length - 1 && b.endAt === null ? { ...b, endAt: event.occurredAt } : b
        )
        return { ...s, status: "clocked_in", breaks }
      }
      default:
        return s
    }
  }
}
