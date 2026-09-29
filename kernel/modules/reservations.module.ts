import { randomUUID } from "crypto"
import { AttributeBag, kernelError, StoredEvent } from "@/kernel/types"
import { defineCommand } from "@/kernel/commands/define-command"
import { QueryHandler } from "@/kernel/queries/query-bus"
import { ReservationAggregate, ReservationState } from "@/kernel/aggregates/reservation.aggregate"
import { RosModule, ModuleRuntime } from "@/kernel/modules/module-registry"
import { defineProjection, Projection } from "@/kernel/projections/projection"

export interface ReservationBoardRow {
  id: string
  customerName: string
  partySize: number
  date: string
  time: string
  status: string
  tableId: string | null
  source: string
}

export interface ReservationBoardState extends AttributeBag {
  rows: ReservationBoardRow[]
}

export function reservationBoardProjection(
  store: ModuleRuntime["events"],
  tenant: ModuleRuntime["tenant"]
): Projection<ReservationBoardState> {
  return defineProjection<ReservationBoardState>(
    {
      name: "reservations.board",
      initial: { rows: [] },
      watchedEventTypes: [
        "reservation.booked",
        "reservation.confirmed",
        "reservation.seated",
        "reservation.completed",
        "reservation.cancelled",
        "reservation.noShow",
        "reservation.rescheduled",
      ],
      reduce: (state, event: StoredEvent): ReservationBoardState => {
        const rows = [...state.rows]
        const idx = rows.findIndex((r) => r.id === event.aggregateId)
        const p = event.payload as Record<string, unknown>
        const base: ReservationBoardRow =
          idx >= 0
            ? rows[idx]
            : { id: event.aggregateId, customerName: "", partySize: 0, date: "", time: "", status: "pending", tableId: null, source: "pos" }
        const next: ReservationBoardRow = { ...base }
        if (event.eventType === "reservation.booked") {
          next.customerName = String(p.customerName ?? "")
          next.partySize = Number(p.partySize ?? 0)
          next.date = String(p.date ?? "")
          next.time = String(p.time ?? "")
          next.source = String(p.source ?? "pos")
          next.status = "pending"
        }
        if (p.status) next.status = String(p.status)
        if (p.tableId !== undefined) next.tableId = (p.tableId as string) ?? null
        if (p.date) next.date = String(p.date)
        if (p.time) next.time = String(p.time)
        if (idx >= 0) rows[idx] = next
        else rows.push(next)
        rows.sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`))
        return { rows }
      },
    },
    store,
    tenant
  )
}

// ---------------------------------------------------------------- commands

const book = defineCommand({
  commandType: "reservation.book",
  requiredPermission: "reservation:manage",
  async execute(ctx) {
    const { payload } = ctx
    const id = (payload.reservationId as string) ?? randomUUID()
    // Guard: same table double-booked in an overlapping window?
    const board = ctx.projections.get<ReservationBoardState>("reservations.board").state
    const tableId = payload.tableId as string | undefined
    if (tableId) {
      const conflict = board.rows.find(
        (r) =>
          r.id !== id &&
          r.tableId === tableId &&
          r.date === payload.date &&
          ["pending", "confirmed", "seated"].includes(r.status) &&
          overlaps(String(payload.time), Number(payload.durationMinutes ?? 90), r.time, 90)
      )
      if (conflict) {
        throw kernelError("TABLE_DOUBLE_BOOKED", `Table already reserved at ${conflict.time} by ${conflict.customerName}`)
      }
    }
    const agg = ReservationAggregate.book(ctx.tenant, {
      id,
      actor: ctx.actor,
      customerName: String(payload.customerName ?? ""),
      partySize: Number(payload.partySize ?? 1),
      date: String(payload.date ?? ""),
      time: String(payload.time ?? ""),
      phone: payload.phone ? String(payload.phone) : undefined,
      email: payload.email ? String(payload.email) : undefined,
      durationMinutes: payload.durationMinutes ? Number(payload.durationMinutes) : undefined,
      source: payload.source as never,
      specialRequests: payload.specialRequests ? String(payload.specialRequests) : undefined,
    })
    if (tableId) agg.confirm(ctx.actor, tableId) // booking with an assigned table is auto-confirmed
    await ctx.commit(agg)
    return id
  },
})

const confirm = defineCommand({
  commandType: "reservation.confirm",
  requiredPermission: "reservation:manage",
  async execute(ctx) {
    const id = String(ctx.payload.reservationId)
    const agg = await ctx.load<ReservationAggregate>(ReservationAggregate.TYPE, id)
    agg.confirm(ctx.actor, ctx.payload.tableId ? String(ctx.payload.tableId) : undefined)
    await ctx.commit(agg)
    return id
  },
})

const seat = defineCommand({
  commandType: "reservation.seat",
  requiredPermission: "reservation:manage",
  async execute(ctx) {
    const id = String(ctx.payload.reservationId)
    const agg = await ctx.load<ReservationAggregate>(ReservationAggregate.TYPE, id)
    agg.seat(ctx.actor, String(ctx.payload.tableId))
    await ctx.commit(agg)
    return id
  },
})

const complete = defineCommand({
  commandType: "reservation.complete",
  requiredPermission: "reservation:manage",
  async execute(ctx) {
    const id = String(ctx.payload.reservationId)
    const agg = await ctx.load<ReservationAggregate>(ReservationAggregate.TYPE, id)
    agg.complete(ctx.actor)
    await ctx.commit(agg)
    return id
  },
})

const cancel = defineCommand({
  commandType: "reservation.cancel",
  requiredPermission: "reservation:manage",
  async execute(ctx) {
    const id = String(ctx.payload.reservationId)
    const agg = await ctx.load<ReservationAggregate>(ReservationAggregate.TYPE, id)
    agg.cancel(ctx.actor, ctx.payload.reason ? String(ctx.payload.reason) : undefined)
    await ctx.commit(agg)
    return id
  },
})

const noShow = defineCommand({
  commandType: "reservation.markNoShow",
  requiredPermission: "reservation:manage",
  async execute(ctx) {
    const id = String(ctx.payload.reservationId)
    const agg = await ctx.load<ReservationAggregate>(ReservationAggregate.TYPE, id)
    agg.markNoShow(ctx.actor)
    await ctx.commit(agg)
    return id
  },
})

const reschedule = defineCommand({
  commandType: "reservation.reschedule",
  requiredPermission: "reservation:manage",
  async execute(ctx) {
    const id = String(ctx.payload.reservationId)
    const agg = await ctx.load<ReservationAggregate>(ReservationAggregate.TYPE, id)
    agg.reschedule(ctx.actor, String(ctx.payload.date), String(ctx.payload.time))
    await ctx.commit(agg)
    return id
  },
})

// ---------------------------------------------------------------- queries

function overlaps(aStart: string, aMins: number, bStart: string, bMins: number): boolean {
  const toMin = (t: string) => {
    const [h, m] = t.split(":").map(Number)
    return h * 60 + m
  }
  const as = toMin(aStart)
  const bs = toMin(bStart)
  return as < bs + bMins && bs < as + aMins
}

const getReservation: QueryHandler = {
  queryType: "get.reservation",
  requiredPermission: "reservation:view",
  async handle(params, ctx) {
    const agg = await ctx.repository.load<ReservationAggregate>(ReservationAggregate.TYPE, ctx.tenant, String(params.reservationId))
    return { id: agg.id, version: agg.version, state: agg.state }
  },
}

const listReservationsForDate: QueryHandler = {
  queryType: "list.reservations.onDate",
  requiredPermission: "reservation:view",
  async handle(params, ctx) {
    const board = ctx.projections.get<ReservationBoardState>("reservations.board").state
    return board.rows.filter((r) => r.date === String(params.date))
  },
}

// ---------------------------------------------------------------- module

export function reservationsModule(): RosModule {
  return {
    id: "ros.reservations",
    name: "Reservations",
    version: "1.0.0",
    capabilities: {
      commands: ["reservation.book", "reservation.confirm", "reservation.seat", "reservation.complete", "reservation.cancel", "reservation.markNoShow", "reservation.reschedule"],
      queries: ["get.reservation", "list.reservations.onDate"],
      eventTypes: [
        "reservation.booked", "reservation.confirmed", "reservation.seated",
        "reservation.completed", "reservation.cancelled", "reservation.noShow", "reservation.rescheduled",
      ],
    },
    lifecycle: {
      async install(runtime: ModuleRuntime) {
        runtime.projections.register(reservationBoardProjection(runtime.events, runtime.tenant))
      },
      async activate(runtime: ModuleRuntime) {
        runtime.commands.register(book)
        runtime.commands.register(confirm)
        runtime.commands.register(seat)
        runtime.commands.register(complete)
        runtime.commands.register(cancel)
        runtime.commands.register(noShow)
        runtime.commands.register(reschedule)
        runtime.queries.register(getReservation)
        runtime.queries.register(listReservationsForDate)
      },
    },
  }
}

export type { ReservationState }
