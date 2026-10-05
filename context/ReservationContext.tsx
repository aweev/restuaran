"use client"

import type React from "react"
import { createContext, useContext, useMemo, useCallback } from "react"
import type { Reservation } from "@/types/reservation"
import { useCommand, useProjection } from "@/kernel/react/kernel-provider"
import type { ReservationBoardState } from "@/kernel/modules/reservations.module"
import { reservationRowsToReservations } from "@/lib/kernel-mappers"
import { useFeedback, notifyWithActions, recoveryActionsFor } from "@/lib/feedback"
import { useAttentionOptional } from "@/context/AttentionContext"

// Define the state type
interface ReservationState {
  reservations: Reservation[]
  loading: boolean
  error: string | null
}

// Define the context type
interface ReservationContextType {
  state: ReservationState
  fetchReservations: () => Promise<void>
  addReservation: (reservation: Reservation) => Promise<void>
  updateReservation: (reservation: Reservation) => Promise<void>
  cancelReservation: (id: string) => Promise<void>
  deleteReservation: (id: string) => Promise<void>
}

// Create the context
const ReservationContext = createContext<ReservationContextType | undefined>(undefined)

/** ISO datetime (or date-only) → YYYY-MM-DD. The forms hand over full ISO strings. */
function toDateOnly(v: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) throw new Error(`Invalid reservation date "${v}" — expected YYYY-MM-DD`)
  return d.toISOString().slice(0, 10)
}

/** ISO datetime or HH:MM → HH:MM. The kernel validates strictly. */
function toTimeHM(v: string): string {
  const m = /^(\d{2}):(\d{2})/.exec(v)
  if (m) return `${m[1]}:${m[2]}`
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) throw new Error(`Invalid reservation time "${v}" — expected HH:MM`)
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
}

/**
 * Reservations, backed by the event store.
 *
 * The list is the `reservations.board` projection and every mutation is a
 * kernel command, so the double-booking guard and the lifecycle (book →
 * confirm → seat → complete, with cancel/no-show terminals) apply to the UI
 * instead of living in raw SQL. The public interface is unchanged, so every
 * consumer keeps working.
 *
 * Two deliberate mappings: DELETE becomes `reservation.cancel` (history is an
 * audit trail — a booking never vanishes), and free-form field edits travel
 * through `reservation.updateDetails` / `reschedule` / lifecycle commands
 * rather than a column write.
 */
export function ReservationProvider({ children }: { children: React.ReactNode }) {
  const { state: board } = useProjection<ReservationBoardState>("reservations.board", 2000)
  const { run } = useCommand()
  const { notify } = useFeedback()
  const attention = useAttentionOptional()

  const reject = (title: string, err?: { message?: string; code?: string }) => {
    const actions = recoveryActionsFor(err?.code);
    attention?.push({ title, message: err?.message, code: err?.code, href: "/dashboard/tables" });
    if (actions.length > 0) notifyWithActions(title, err?.message, actions);
    else notify("error", title, err?.message);
  };

  const reservations = useMemo(() => reservationRowsToReservations(board?.rows ?? []), [board])

  const state = useMemo<ReservationState>(
    () => ({
      reservations,
      // The projection arriving *is* the load boundary; there is no separate
      // fetch to await, so `loading` is simply "no snapshot yet".
      loading: board === null,
      error: null,
    }),
    [reservations, board],
  )

  const fail = (result: { error?: { message?: string; code?: string } }, fallback: string): never => {
    reject(fallback, result.error);
    throw new Error(result.error?.message ?? fallback)
  }

  const fetchReservations = useCallback(async () => {
    // Retained for call-site compatibility. The projection refreshes itself,
    // so there is nothing to fetch; resolving immediately keeps any caller
    // that awaits this (and clears its own spinner) working.
  }, [])

  const addReservation = useCallback(
    async (reservation: Reservation) => {
      const date = toDateOnly(reservation.date)
      const time = toTimeHM(reservation.time)
      const result = await run("reservation.book", {
        reservationId: reservation.id || undefined,
        customerName: reservation.customerName,
        partySize: reservation.partySize,
        date,
        time,
        ...(reservation.phone ? { phone: reservation.phone } : {}),
        ...(reservation.email ? { email: reservation.email } : {}),
        ...(reservation.tableId ? { tableId: reservation.tableId } : {}),
        ...(reservation.notes ? { specialRequests: reservation.notes } : {}),
      })
      if (!result.success) fail(result, "Failed to add reservation")
      // Booking with a table auto-confirms in the kernel; an explicit
      // non-default status from the form is applied on top.
      const status = reservation.status
      if (status && status !== "pending" && status !== "confirmed") {
        const id = (result as { aggregateId?: string }).aggregateId ?? reservation.id
        if (status === "cancelled" || status === "cancelled_by_customer" || status === "cancelled_by_restaurant") {
          const cancelled = await run("reservation.cancel", { reservationId: id, reason: "cancelled at booking" })
          if (!cancelled.success) fail(cancelled, "Failed to add reservation")
        }
      }
    },
    [run],
  )

  const updateReservation = useCallback(
    async (reservation: Reservation) => {
      const id = reservation.id
      const date = toDateOnly(reservation.date)
      const time = toTimeHM(reservation.time)

      // Lifecycle moves first: they own status + table transitions.
      const status = reservation.status
      let tableHandled = false
      if (status === "cancelled" || status === "cancelled_by_customer" || status === "cancelled_by_restaurant") {
        const r = await run("reservation.cancel", { reservationId: id })
        if (!r.success) fail(r, "Failed to update reservation")
      } else if (status === "seated") {
        if (!reservation.tableId) throw new Error("Seating requires a table")
        const r = await run("reservation.seat", { reservationId: id, tableId: reservation.tableId })
        if (!r.success) fail(r, "Failed to update reservation")
        tableHandled = true
      } else if (status === "completed") {
        const r = await run("reservation.complete", { reservationId: id })
        if (!r.success) fail(r, "Failed to update reservation")
      } else if (status === "confirmed") {
        const r = await run("reservation.confirm", {
          reservationId: id,
          ...(reservation.tableId ? { tableId: reservation.tableId } : {}),
        })
        if (!r.success) fail(r, "Failed to update reservation")
        tableHandled = Boolean(reservation.tableId)
      } else if (status && status !== "pending") {
        throw new Error(`Cannot move a reservation to "${status}" from the edit form`)
      }

      // Slot moves travel through reschedule (validated, auditable).
      // The current slot is authoritative in the projection; compare there to
      // avoid a no-op reschedule tripping the double-booking guard against
      // itself. The guard excludes the aggregate's own id, so even a blind
      // reschedule is safe — this is purely a wasted-write saving.
      const current = board?.rows.find((r) => r.id === id)
      if (current && (current.date !== date || current.time !== time)) {
        const r = await run("reservation.reschedule", { reservationId: id, date, time })
        if (!r.success) fail(r, "Failed to update reservation")
      }

      // Contact/party detail edits. Table reassignment on a live (non-seated)
      // booking re-confirms onto the new table; seated/terminal bookings
      // refuse the move with a clear error instead of corrupting the board.
      const details: Record<string, unknown> = {}
      if (current) {
        if (reservation.partySize !== current.partySize) details.partySize = reservation.partySize
        if ((reservation.phone ?? "") !== (current.phone ?? "")) details.phone = reservation.phone || null
        if ((reservation.email ?? "") !== (current.email ?? "")) details.email = reservation.email || null
        if ((reservation.notes ?? "") !== (current.specialRequests ?? "")) {
          details.specialRequests = reservation.notes || null
        }
        if (!tableHandled && (reservation.tableId ?? "") !== (current.tableId ?? "")) {
          if (current.status === "pending" || current.status === "confirmed") {
            const moved = await run("reservation.confirm", {
              reservationId: id,
              ...(reservation.tableId ? { tableId: reservation.tableId } : {}),
            })
            if (!moved.success) fail(moved, "Failed to update reservation")
          } else {
            throw new Error(`Cannot move the table of a ${current.status} reservation`)
          }
        }
      } else {
        // No projection row yet (eventual consistency window): send everything.
        details.partySize = reservation.partySize
        details.phone = reservation.phone || null
        details.email = reservation.email || null
        details.specialRequests = reservation.notes || null
      }
      if (Object.keys(details).length > 0) {
        const r = await run("reservation.updateDetails", { reservationId: id, ...details })
        if (!r.success) fail(r, "Failed to update reservation")
      }
    },
    [run, board],
  )

  const cancelReservation = useCallback(
    async (id: string) => {
      const result = await run("reservation.cancel", { reservationId: id })
      if (!result.success) fail(result, "Failed to cancel reservation")
    },
    [run],
  )

  const deleteReservation = useCallback(
    async (id: string) => {
      // No hard delete: the booking history is an audit trail. Cancelling
      // removes it from every active view while keeping the record.
      const result = await run("reservation.cancel", { reservationId: id, reason: "deleted by staff" })
      if (!result.success) fail(result, "Failed to delete reservation")
    },
    [run],
  )

  const value = useMemo(
    () => ({
      state,
      fetchReservations,
      addReservation,
      updateReservation,
      cancelReservation,
      deleteReservation,
    }),
    [state, fetchReservations, addReservation, updateReservation, cancelReservation, deleteReservation],
  )

  return <ReservationContext.Provider value={value}>{children}</ReservationContext.Provider>
}

// Custom hook to use the context
export function useReservation() {
  const context = useContext(ReservationContext)
  if (context === undefined) {
    throw new Error("useReservation must be used within a ReservationProvider")
  }
  return context
}
