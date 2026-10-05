"use client"

import { createContext, useReducer, useContext, useEffect, useCallback, useMemo, type ReactNode } from "react"
import { useLocalStorage } from "@/hooks/useLocalStorage"
import { useCommand, useProjection } from "@/kernel/react/kernel-provider"
import type { StaffBoardState, StaffRow } from "@/kernel/projections/staff-board"
import type { MenuBoardState } from "@/kernel/modules/menu.module"
import { useFeedback, notifyWithActions, recoveryActionsFor } from "@/lib/feedback"
import { useAttentionOptional } from "@/context/AttentionContext"

// Types
interface KitchenStaffAssignment {
  userId: string
  userName: string
  station: string
  assignedOrders: string[]
}

interface KitchenState {
  soundEnabled: boolean
  notificationSettings: {
    newOrder: boolean
    orderUpdated: boolean
    orderCancelled: boolean
    orderExpedite: boolean
  }
  staffAssignments: KitchenStaffAssignment[]
  preparationTimes: Record<string, number> // menuItemId -> time in minutes
  loading: boolean
  error: string | null
}

// Initial state
const initialState: KitchenState = {
  soundEnabled: true,
  notificationSettings: {
    newOrder: true,
    orderUpdated: true,
    orderCancelled: true,
    orderExpedite: true,
  },
  staffAssignments: [],
  preparationTimes: {},
  loading: false,
  error: null,
}

// Action types
type KitchenAction =
  | { type: "TOGGLE_SOUND" }
  | { type: "UPDATE_NOTIFICATION_SETTINGS"; payload: Partial<KitchenState["notificationSettings"]> }
  | { type: "SET_ASSIGNMENTS"; payload: KitchenStaffAssignment[] }
  | { type: "FETCH_PREPARATION_TIMES_START" }
  | { type: "FETCH_PREPARATION_TIMES_SUCCESS"; payload: Record<string, number> }
  | { type: "FETCH_PREPARATION_TIMES_FAILURE"; payload: string }
  | { type: "UPDATE_PREPARATION_TIME"; payload: { menuItemId: string; time: number } }

// Reducer
const kitchenReducer = (state: KitchenState, action: KitchenAction): KitchenState => {
  switch (action.type) {
    case "TOGGLE_SOUND":
      return {
        ...state,
        soundEnabled: !state.soundEnabled,
      }
    case "UPDATE_NOTIFICATION_SETTINGS":
      return {
        ...state,
        notificationSettings: {
          ...state.notificationSettings,
          ...action.payload,
        },
      }
    case "SET_ASSIGNMENTS":
      return {
        ...state,
        staffAssignments: action.payload,
        loading: false,
        error: null,
      }
    case "FETCH_PREPARATION_TIMES_START":
      return {
        ...state,
        loading: true,
        error: null,
      }
    case "FETCH_PREPARATION_TIMES_SUCCESS":
      return {
        ...state,
        preparationTimes: action.payload,
        loading: false,
      }
    case "FETCH_PREPARATION_TIMES_FAILURE":
      return {
        ...state,
        loading: false,
        error: action.payload,
      }
    case "UPDATE_PREPARATION_TIME":
      return {
        ...state,
        preparationTimes: {
          ...state.preparationTimes,
          [action.payload.menuItemId]: action.payload.time,
        },
      }
    default:
      return state
  }
}

// Create context
interface KitchenContextType {
  state: KitchenState
  toggleSound: () => void
  updateNotificationSettings: (settings: Partial<KitchenState["notificationSettings"]>) => void
  fetchStaffAssignments: () => Promise<void>
  updateStaffAssignment: (assignment: KitchenStaffAssignment) => Promise<void>
  removeStaffAssignment: (userId: string) => Promise<void>
  fetchPreparationTimes: () => Promise<void>
  updatePreparationTime: (menuItemId: string, time: number) => Promise<void>
  /** Fire every open line then mark the ticket's lines preparing (kernel KDS path). */
  beginTicket: (orderId: string, lineIds: string[]) => Promise<void>
  /** Mark every preparing line ready (kernel KDS path). */
  readyTicket: (orderId: string, lineIds: string[]) => Promise<void>
  /** Mark every ready line served (kernel KDS path). */
  serveTicket: (orderId: string, lineIds: string[]) => Promise<void>
  /** Fire a specific course (kernel `order.fireCourse`). */
  fireCourse: (orderId: string, course: number) => Promise<void>
  /** Park a course so it is not fired yet (kernel `order.holdCourse`). */
  holdCourse: (orderId: string, course: number) => Promise<void>
  /** Release a parked course (kernel `order.releaseCourse`). */
  releaseCourse: (orderId: string, course: number) => Promise<void>
}

const KitchenContext = createContext<KitchenContextType | undefined>(undefined)

const rowToAssignment = (row: StaffRow): KitchenStaffAssignment => ({
  userId: row.staffId,
  userName: row.name || row.staffId,
  station: row.station ?? "",
  assignedOrders: [],
})

/**
 * Kitchen, backed by the event store where it matters.
 *
 * Station assignments are `kitchen.assignStation` / `kitchen.clearStation`
 * commands folded into `staff.board`, so every KDS sees the same roster and
 * reassigning a station mid-rush is an auditable event. Line lifecycle
 * (`beginTicket`/`readyTicket`/`serveTicket`) runs the per-line kernel
 * commands — the card falls back to the order-level status flow only when
 * the ticket has no event stream (a legacy seed-table order).
 *
 * Preparation times are projected from `menu.board` and written through
 * `menu.setPrepTime` (gated on `order:process`, which the kitchen role holds),
 * so the KDS ticket target is a shared kernel fact, not a per-terminal REST read.
 */
export const KitchenProvider = ({ children }: { children: ReactNode }) => {
  const [persistedSettings, setPersistedSettings] = useLocalStorage<{
    soundEnabled: boolean
    notificationSettings: KitchenState["notificationSettings"]
  }>("kitchen_settings", {
    soundEnabled: true,
    notificationSettings: initialState.notificationSettings,
  })

  const [state, dispatch] = useReducer(kitchenReducer, {
    ...initialState,
    soundEnabled: persistedSettings.soundEnabled,
    notificationSettings: persistedSettings.notificationSettings,
  })

  const { run } = useCommand()
  const { state: staffBoard } = useProjection<StaffBoardState>("staff.board", 3000)
  const { state: menuBoard } = useProjection<MenuBoardState>("menu.board", 5000)
  const { notify } = useFeedback()
  const attention = useAttentionOptional()

  const reject = (title: string, err?: { message?: string; code?: string }) => {
    const actions = recoveryActionsFor(err?.code);
    attention?.push({ title, message: err?.message, code: err?.code, href: "/dashboard/kitchen" });
    if (actions.length > 0) notifyWithActions(title, err?.message, actions);
    else notify("error", title, err?.message);
  };

  // The roster arriving *is* the assignment list: every row carrying a
  // station is someone working one, whether it came from a scheduled shift
  // or a direct station assignment.
  useEffect(() => {
    if (!staffBoard) return
    dispatch({
      type: "SET_ASSIGNMENTS",
      payload: staffBoard.rows.filter((r) => r.station).map(rowToAssignment),
    })
  }, [staffBoard])

  // Ticket targets are menu presentation projected from the event store.
  useEffect(() => {
    if (!menuBoard) return
    const map: Record<string, number> = {}
    for (const item of menuBoard.items) map[item.id] = item.prepMinutes
    dispatch({ type: "FETCH_PREPARATION_TIMES_SUCCESS", payload: map })
  }, [menuBoard])

  // Save settings to localStorage when they change
  useEffect(() => {
    if (
      persistedSettings.soundEnabled !== state.soundEnabled ||
      JSON.stringify(persistedSettings.notificationSettings) !== JSON.stringify(state.notificationSettings)
    ) {
      setPersistedSettings({
        soundEnabled: state.soundEnabled,
        notificationSettings: state.notificationSettings,
      })
    }
  }, [state.soundEnabled, state.notificationSettings, persistedSettings, setPersistedSettings])

  // Actions
  const toggleSound = () => {
    dispatch({ type: "TOGGLE_SOUND" })
  }

  const updateNotificationSettings = (settings: Partial<KitchenState["notificationSettings"]>) => {
    dispatch({ type: "UPDATE_NOTIFICATION_SETTINGS", payload: settings })
  }

  const fetchStaffAssignments = useCallback(async () => {
    // Retained for call-site compatibility; the staff.board subscription
    // above keeps assignments live without polling a table.
  }, [])

  const updateStaffAssignment = useCallback(
    async (assignment: KitchenStaffAssignment) => {
      if (!assignment.userId?.trim()) throw new Error("Staff id is required")
      if (!assignment.station?.trim()) throw new Error("Station is required")
      const result = await run("kitchen.assignStation", {
        staffId: assignment.userId.trim(),
        station: assignment.station.trim(),
      })
      if (!result.success) reject("Failed to update staff assignment", result.error)
    },
    [run],
  )

  const removeStaffAssignment = useCallback(
    async (userId: string) => {
      const result = await run("kitchen.clearStation", { staffId: userId })
      if (!result.success) reject("Failed to remove staff assignment", result.error)
    },
    [run],
  )

  const fetchPreparationTimes = async () => {
    // Retained for call-site compatibility; the `menu.board` subscription above
    // keeps the KDS ticket targets live without polling a config endpoint.
  }

  const updatePreparationTime = useCallback(
    async (menuItemId: string, time: number) => {
      const result = await run("menu.setPrepTime", { itemId: menuItemId, prepMinutes: time })
      if (!result.success) reject("Failed to update preparation time", result.error)
      dispatch({ type: "UPDATE_PREPARATION_TIME", payload: { menuItemId, time } })
    },
    [run],
  )

  const runLines = useCallback(
    async (commandType: string, orderId: string, lineIds: string[]) => {
      if (lineIds.length === 0) throw new Error("Ticket has no lines to fire")
      // Fire the ticket first when lines are still open: beginLine only
      // accepts sent lines, and NOTHING_TO_SEND means they already are.
      if (commandType === "kitchen.beginLine") {
        const sent = await run("order.sendToKitchen", { orderId })
        if (!sent.success && sent.error?.code !== "NOTHING_TO_SEND") {
          // A legacy seed-table order has no stream at all — surface the
          // marker code so the card can fall back to the order-level flow.
          if (sent.error?.code === "AGGREGATE_NOT_FOUND") {
            const err = new Error(sent.error.message) as Error & { code?: string }
            err.code = "AGGREGATE_NOT_FOUND"
            throw err
          }
          reject("Failed to fire ticket", sent.error)
        }
      }
      let firstError: string | null = null
      for (const lineId of lineIds) {
        const r = await run(commandType, { orderId, lineId })
        if (!r.success) {
          if (r.error?.code === "AGGREGATE_NOT_FOUND") {
            const err = new Error(r.error.message) as Error & { code?: string }
            err.code = "AGGREGATE_NOT_FOUND"
            throw err
          }
          firstError = firstError ?? r.error?.message ?? `Failed line ${lineId}`
        }
      }
      if (firstError) throw new Error(firstError)
    },
    [run],
  )

  const beginTicket = useCallback(
    (orderId: string, lineIds: string[]) => runLines("kitchen.beginLine", orderId, lineIds),
    [runLines],
  )
  const readyTicket = useCallback(
    (orderId: string, lineIds: string[]) => runLines("kitchen.readyLine", orderId, lineIds),
    [runLines],
  )
  const serveTicket = useCallback(
    (orderId: string, lineIds: string[]) => runLines("kitchen.serveLine", orderId, lineIds),
    [runLines],
  )

  const fireCourse = useCallback(
    async (orderId: string, course: number) => {
      if (!Number.isInteger(course) || course < 1) throw new Error("Course must be a positive integer")
      const result = await run("order.fireCourse", { orderId, course })
      if (!result.success) throw new Error(result.error?.message ?? "Failed to fire course")
    },
    [run],
  )

  const holdCourse = useCallback(
    async (orderId: string, course: number) => {
      const result = await run("order.holdCourse", { orderId, course })
      if (!result.success) throw new Error(result.error?.message ?? "Failed to hold course")
    },
    [run],
  )

  const releaseCourse = useCallback(
    async (orderId: string, course: number) => {
      const result = await run("order.releaseCourse", { orderId, course })
      if (!result.success) throw new Error(result.error?.message ?? "Failed to release course")
    },
    [run],
  )

  const value = useMemo(
    () => ({
      state,
      toggleSound,
      updateNotificationSettings,
      fetchStaffAssignments,
      updateStaffAssignment,
      removeStaffAssignment,
      fetchPreparationTimes,
      updatePreparationTime,
      beginTicket,
      readyTicket,
      serveTicket,
      fireCourse,
      holdCourse,
      releaseCourse,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state, fetchStaffAssignments, updateStaffAssignment, removeStaffAssignment, beginTicket, readyTicket, serveTicket, fireCourse, holdCourse, releaseCourse],
  )

  return <KitchenContext.Provider value={value}>{children}</KitchenContext.Provider>
}

// Custom hook
export const useKitchen = () => {
  const context = useContext(KitchenContext)
  if (context === undefined) {
    throw new Error("useKitchen must be used within a KitchenProvider")
  }
  return context
}
