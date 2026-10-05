import { randomUUID } from "crypto"
import { AttributeBag, kernelError, StoredEvent } from "@/kernel/types"
import { defineCommand } from "@/kernel/commands/define-command"
import { QueryHandler } from "@/kernel/queries/query-bus"
import { StaffShiftAggregate } from "@/kernel/aggregates/shift.aggregate"
import { RosModule, ModuleRuntime } from "@/kernel/modules/module-registry"
import { StaffBoardState as StaffBoardProjectionState } from "@/kernel/projections/staff-board"
import { maybePaginate } from "@/kernel/projections/projection"

export interface ShiftRow {
  id: string
  staffId: string
  position: string
  status: string
  clockInAt: string | null
  clockOutAt: string | null
  workedMinutes: number
}

export interface StaffBoardState extends AttributeBag {
  onShift: ShiftRow[]
  history: ShiftRow[]
}

function toRow(agg: { id: string; state: StaffShiftAggregate["state"] }, workedSeconds: number): ShiftRow {
  return {
    id: agg.id,
    staffId: agg.state.staffId,
    position: agg.state.position,
    status: agg.state.status,
    clockInAt: agg.state.clockInAt,
    clockOutAt: agg.state.clockOutAt,
    workedMinutes: Math.round(workedSeconds / 60),
  }
}

/**
 * NOTE: this board used to be recomputed from the full event log on *every*
 * query (`computeStaffBoard`), which made the Staff screen's cost grow with the
 * venue's history. It is now served from the `staff.board` projection; the
 * `ShiftRow` shape below is the module's own query contract and is preserved.
 */

const schedule = defineCommand({
  commandType: "staff.scheduleShift",
  requiredPermission: "staff:schedule",
  async execute(ctx) {
    const id = (ctx.payload.shiftId as string) ?? randomUUID()
    const agg = StaffShiftAggregate.schedule(ctx.tenant, {
      id,
      actor: ctx.actor,
      staffId: String(ctx.payload.staffId ?? ""),
      position: String(ctx.payload.position ?? ""),
      scheduledStart: String(ctx.payload.scheduledStart ?? ""),
      scheduledEnd: String(ctx.payload.scheduledEnd ?? ""),
      locationLabel: ctx.payload.locationLabel ? String(ctx.payload.locationLabel) : undefined,
    })
    await ctx.commit(agg)
    return id
  },
})

/**
 * Clock operations must be bound to the authenticated identity, never to a
 * client-supplied staffId field (which is self-asserted and trivially spoofed).
 * Acting on another employee's shift requires staff:schedule.
 */
function assertOwnShift(ctx: { actor: { userId: string; permissions: readonly string[] } }, agg: StaffShiftAggregate): void {
  if (agg.state.staffId === ctx.actor.userId) return
  if (!ctx.actor.permissions.includes("staff:schedule")) {
    throw kernelError("SHIFT_OWNERSHIP", "Cannot modify another staff member's shift")
  }
}

const clockIn = defineCommand({
  commandType: "staff.clockIn",
  requiredPermission: "staff:clock",
  async execute(ctx) {
    const id = String(ctx.payload.shiftId)
    const agg = await ctx.load<StaffShiftAggregate>(StaffShiftAggregate.TYPE, id)
    assertOwnShift(ctx, agg)
    agg.clockIn(ctx.actor)
    await ctx.commit(agg)
    return id
  },
})

const clockOut = defineCommand({
  commandType: "staff.clockOut",
  requiredPermission: "staff:clock",
  async execute(ctx) {
    const id = String(ctx.payload.shiftId)
    const agg = await ctx.load<StaffShiftAggregate>(StaffShiftAggregate.TYPE, id)
    assertOwnShift(ctx, agg)
    agg.clockOut(ctx.actor)
    await ctx.commit(agg)
    return id
  },
})

const breakStart = defineCommand({
  commandType: "staff.startBreak",
  requiredPermission: "staff:clock",
  async execute(ctx) {
    const id = String(ctx.payload.shiftId)
    const agg = await ctx.load<StaffShiftAggregate>(StaffShiftAggregate.TYPE, id)
    assertOwnShift(ctx, agg)
    agg.startBreak(ctx.actor)
    await ctx.commit(agg)
    return id
  },
})

const breakEnd = defineCommand({
  commandType: "staff.endBreak",
  requiredPermission: "staff:clock",
  async execute(ctx) {
    const id = String(ctx.payload.shiftId)
    const agg = await ctx.load<StaffShiftAggregate>(StaffShiftAggregate.TYPE, id)
    assertOwnShift(ctx, agg)
    agg.endBreak(ctx.actor)
    await ctx.commit(agg)
    return id
  },
})

const getShift: QueryHandler = {
  queryType: "get.shift",
  requiredPermission: "staff:view",
  async handle(params, ctx) {
    const agg = await ctx.repository.load<StaffShiftAggregate>(StaffShiftAggregate.TYPE, ctx.tenant, String(params.shiftId))
    return { id: agg.id, version: agg.version, state: agg.state, workedSeconds: agg.workedSeconds(), overtime: agg.isOvertime(Number(params.maxHoursPerShift ?? 10)) }
  },
}

const listStaffing: QueryHandler = {
  queryType: "list.staffing.board",
  requiredPermission: "staff:view",
  async handle(params, ctx) {
    // Served from the `staff.board` projection rather than replaying the whole
    // log per call, but the response shape is unchanged so existing consumers
    // (and the worked-time semantics) are preserved exactly.
    const { rows } = ctx.projections.get<StaffBoardProjectionState>("staff.board").state
    const onShift: ShiftRow[] = []
    const history: ShiftRow[] = []
    for (const r of rows) {
      const row: ShiftRow = {
        id: r.shiftId,
        staffId: r.staffId,
        position: r.position,
        status: r.status === "on-shift" ? "clocked_in" : r.status === "break" ? "on_break" : "clocked_out",
        clockInAt: r.clockedInAt,
        clockOutAt: r.clockOutAt,
        workedMinutes: Math.round(r.hoursWorked * 60),
      }
      if (r.status === "on-shift" || r.status === "break") onShift.push(row)
      else if (r.status === "off") history.push(row)
    }
    if (params.limit == null && params.cursor == null) return { onShift, history }
    const page = maybePaginate(history, params) as { rows: ShiftRow[]; nextCursor: string | null; total: number }
    return { onShift, history: page.rows, nextCursor: page.nextCursor, total: page.total }
  },
}

export function staffModule(): RosModule {
  return {
    id: "ros.staff",
    name: "Staff Scheduling & Time Clock",
    version: "1.0.0",
    capabilities: {
      commands: ["staff.scheduleShift", "staff.clockIn", "staff.clockOut", "staff.startBreak", "staff.endBreak"],
      queries: ["get.shift", "list.staffing.board"],
      eventTypes: ["shift.scheduled", "shift.clockedIn", "shift.clockedOut", "shift.breakStarted", "shift.breakEnded"],
    },
    lifecycle: {
      async activate(runtime: ModuleRuntime) {
        runtime.commands.register(schedule)
        runtime.commands.register(clockIn)
        runtime.commands.register(clockOut)
        runtime.commands.register(breakStart)
        runtime.commands.register(breakEnd)
        runtime.queries.register(getShift)
        runtime.queries.register(listStaffing)
      },
    },
  }
}
