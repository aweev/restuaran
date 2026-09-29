"use client"

import { createContext, useReducer, useContext, useEffect, useCallback, type ReactNode } from "react"
import { useLocalStorage } from "@/hooks/useLocalStorage"

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
  | { type: "FETCH_STAFF_ASSIGNMENTS_START" }
  | { type: "FETCH_STAFF_ASSIGNMENTS_SUCCESS"; payload: KitchenStaffAssignment[] }
  | { type: "FETCH_STAFF_ASSIGNMENTS_FAILURE"; payload: string }
  | { type: "UPDATE_STAFF_ASSIGNMENT"; payload: KitchenStaffAssignment }
  | { type: "REMOVE_STAFF_ASSIGNMENT"; payload: string }
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
    case "FETCH_STAFF_ASSIGNMENTS_START":
      return {
        ...state,
        loading: true,
        error: null,
      }
    case "FETCH_STAFF_ASSIGNMENTS_SUCCESS":
      return {
        ...state,
        staffAssignments: action.payload,
        loading: false,
      }
    case "FETCH_STAFF_ASSIGNMENTS_FAILURE":
      return {
        ...state,
        loading: false,
        error: action.payload,
      }
    case "UPDATE_STAFF_ASSIGNMENT": {
      const existingIndex = state.staffAssignments.findIndex(
        (assignment) => assignment.userId === action.payload.userId,
      )

      if (existingIndex >= 0) {
        const updatedAssignments = [...state.staffAssignments]
        updatedAssignments[existingIndex] = action.payload
        return {
          ...state,
          staffAssignments: updatedAssignments,
        }
      } else {
        return {
          ...state,
          staffAssignments: [...state.staffAssignments, action.payload],
        }
      }
    }
    case "REMOVE_STAFF_ASSIGNMENT":
      return {
        ...state,
        staffAssignments: state.staffAssignments.filter((assignment) => assignment.userId !== action.payload),
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
}

const KitchenContext = createContext<KitchenContextType | undefined>(undefined)

// Provider component
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
    dispatch({ type: "FETCH_STAFF_ASSIGNMENTS_START" })
    try {
      const response = await fetch("/api/kitchen/staff-assignments")

      if (!response.ok) {
        throw new Error("Failed to fetch staff assignments")
      }

      const data = await response.json()

      dispatch({
        type: "FETCH_STAFF_ASSIGNMENTS_SUCCESS",
        payload: data,
      })
    } catch (error) {
      dispatch({
        type: "FETCH_STAFF_ASSIGNMENTS_FAILURE",
        payload: error instanceof Error ? error.message : "Failed to fetch staff assignments",
      })
    }

  }, [])

  const updateStaffAssignment = async (assignment: KitchenStaffAssignment) => {
    try {
      const response = await fetch("/api/kitchen/staff-assignments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(assignment),
      })

      if (!response.ok) {
        throw new Error("Failed to update staff assignment")
      }

      dispatch({
        type: "UPDATE_STAFF_ASSIGNMENT",
        payload: assignment,
      })
    } catch (error) {
      console.error("Error updating staff assignment:", error)
      throw error
    }
  }

  const removeStaffAssignment = async (userId: string) => {
    try {
      const response = await fetch(`/api/kitchen/staff-assignments/${userId}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        throw new Error("Failed to remove staff assignment")
      }

      dispatch({
        type: "REMOVE_STAFF_ASSIGNMENT",
        payload: userId,
      })
    } catch (error) {
      console.error("Error removing staff assignment:", error)
      throw error
    }
  }

  const fetchPreparationTimes = async () => {
    dispatch({ type: "FETCH_PREPARATION_TIMES_START" })
    try {
      const response = await fetch("/api/kitchen/preparation-times")

      if (!response.ok) {
        throw new Error("Failed to fetch preparation times")
      }

      const data = await response.json()

      dispatch({
        type: "FETCH_PREPARATION_TIMES_SUCCESS",
        payload: data,
      })
    } catch (error) {
      dispatch({
        type: "FETCH_PREPARATION_TIMES_FAILURE",
        payload: error instanceof Error ? error.message : "Failed to fetch preparation times",
      })
    }
  }

  const updatePreparationTime = async (menuItemId: string, time: number) => {
    try {
      const response = await fetch("/api/kitchen/preparation-times", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ menuItemId, time }),
      })

      if (!response.ok) {
        throw new Error("Failed to update preparation time")
      }

      dispatch({
        type: "UPDATE_PREPARATION_TIME",
        payload: { menuItemId, time },
      })
    } catch (error) {
      console.error("Error updating preparation time:", error)
      throw error
    }
  }

  return (
    <KitchenContext.Provider
      value={{
        state,
        toggleSound,
        updateNotificationSettings,
        fetchStaffAssignments,
        updateStaffAssignment,
        removeStaffAssignment,
        fetchPreparationTimes,
        updatePreparationTime,
      }}
    >
      {children}
    </KitchenContext.Provider>
  )
}

// Custom hook
export const useKitchen = () => {
  const context = useContext(KitchenContext)
  if (context === undefined) {
    throw new Error("useKitchen must be used within a KitchenProvider")
  }
  return context
}
