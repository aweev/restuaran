import { AttributeBag, Id, StoredEvent, TenantContext } from "@/kernel/types"
import { EventStore } from "@/kernel/event-store/event-store"
import { Projection, defineProjection } from "./projection"

/**
 * Roster and time-clock read model.
 *
 * `list.staffing.board` previously replayed the entire event log on *every*
 * call (`computeStaffBoard(ctx.events, ...)`), so the Staff screen's cost grew
 * with the venue's history and a busy site would crawl. This is a projection:
 * catch up once, read in O(1) thereafter.
 *
 * Rows are keyed by the **shift** (StaffShift aggregate) id, not by staff id:
 * `shift.scheduled` is the only event carrying `staffId`; the clock events carry
 * only a status. Keying rows by staff would collapse two people onto one row,
 * and keying off clock events alone would invent a row per clock-in.
 */

export interface StaffRow {
  shiftId: Id
  staffId: Id
  name: string
  position: string
  locationLabel: string
  station: string | null
  /** ISO instant the current shift began, or null when off the clock. */
  clockedInAt: string | null
  /** ISO instant the shift ended, or null while still running. */
  clockOutAt: string | null
  /** When the current break began, or null when not on break. */
  breakStartedAt: string | null
  /** Paid hours banked from completed shifts, with breaks deducted. */
  hoursWorked: number
  /** Hours past the contracted week, for overtime warnings. */
  overtimeHours: number
  status: "on-shift" | "break" | "off"
}

export interface StaffBoardState extends AttributeBag {
  rows: StaffRow[]
  onShift: number
  totalHours: number
  overtimeHours: number
}

const STANDARD_WEEK_HOURS = 40

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function hoursBetween(fromIso: string, toIso: string): number {
  return round2((Date.parse(toIso) - Date.parse(fromIso)) / 3_600_000)
}

function summarize(state: StaffBoardState): StaffBoardState {
  return {
    ...state,
    onShift: state.rows.filter((r) => r.status === "on-shift").length,
    totalHours: round2(state.rows.reduce((s, r) => s + r.hoursWorked, 0)),
    overtimeHours: round2(state.rows.reduce((s, r) => s + r.overtimeHours, 0)),
  }
}

export function staffBoardProjection(
  store: EventStore,
  tenant: TenantContext,
): Projection<StaffBoardState> {
  return defineProjection<StaffBoardState>(
    {
      name: "staff.board",
      initial: { rows: [], onShift: 0, totalHours: 0, overtimeHours: 0 },
      watchedEventTypes: [
        "shift.scheduled",
        "shift.clockedIn",
        "shift.breakStarted",
        "shift.breakEnded",
        "shift.clockedOut",
        "kitchen.stationAssigned",
        "kitchen.stationCleared",
      ],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      reduce: (state: StaffBoardState, event: StoredEvent): StaffBoardState => {
        const p = event.payload as Record<string, any>
        const shiftId = event.aggregateId
        const at = event.occurredAt
        const rows = [...state.rows]

        // A station assignment is a kitchen concern keyed by staff. When the
        // staffer has no scheduled shift yet, materialize a presence row so
        // the assignment is visible instead of silently dropped; a later
        // scheduled shift keeps its own row (station follows the staff id).
        if (event.eventType === "kitchen.stationAssigned" || event.eventType === "kitchen.stationCleared") {
          const target = String(p.staffId ?? "")
          if (!target) return state
          const station = event.eventType === "kitchen.stationCleared" || p.station == null ? null : String(p.station)
          let matched = false
          const mapped = rows.map((r) => {
            if (r.staffId === target || r.shiftId === shiftId) {
              matched = true
              return { ...r, station }
            }
            return r
          })
          if (!matched && station) {
            mapped.push({
              shiftId: `station-${target}`,
              staffId: target,
              name: target,
              position: "kitchen",
              locationLabel: "",
              station,
              clockedInAt: at,
              clockOutAt: null,
              breakStartedAt: null,
              hoursWorked: 0,
              overtimeHours: 0,
              status: "on-shift",
            })
          }
          return summarize({ ...state, rows: mapped })
        }

        let idx = rows.findIndex((r) => r.shiftId === shiftId)
        if (idx < 0) {
          idx = rows.length
          rows.push({
            shiftId,
            staffId: String(p.staffId ?? ""),
            name: String(p.name ?? ""),
            position: String(p.position ?? ""),
            locationLabel: String(p.locationLabel ?? ""),
            station: null,
            clockedInAt: null,
            clockOutAt: null,
            breakStartedAt: null,
            hoursWorked: 0,
            overtimeHours: 0,
            status: "off",
          })
        }

        const row = { ...rows[idx] }

        switch (event.eventType) {
          case "shift.scheduled":
            row.staffId = String(p.staffId ?? row.staffId)
            row.position = String(p.position ?? row.position)
            row.locationLabel = String(p.locationLabel ?? row.locationLabel)
            break

          case "shift.clockedIn":
            row.clockedInAt = String(p.clockInAt ?? at)
            row.breakStartedAt = null
            row.status = "on-shift"
            break

          case "shift.breakStarted":
            row.breakStartedAt = at
            row.status = "break"
            break

          case "shift.breakEnded":
            row.breakStartedAt = null
            row.status = "on-shift"
            break

          case "shift.clockedOut": {
            // Bank paid hours: wall-clock span minus any unpaid break, so a
            // break never inflates the timesheet.
            const endedAt = String(p.clockOutAt ?? at)
            if (row.clockedInAt) {
              const span = hoursBetween(row.clockedInAt, endedAt)
              const unpaid = row.breakStartedAt ? hoursBetween(row.breakStartedAt, endedAt) : 0
              row.hoursWorked = round2(row.hoursWorked + Math.max(0, span - unpaid))
            }
            row.clockedInAt = null
            row.clockOutAt = endedAt
            row.breakStartedAt = null
            row.status = "off"
            break
          }
        }

        row.overtimeHours = round2(Math.max(0, row.hoursWorked - STANDARD_WEEK_HOURS))
        rows[idx] = row
        return summarize({ ...state, rows })
      },
    },
    store,
    tenant,
  )
}
