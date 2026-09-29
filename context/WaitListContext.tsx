"use client"

import type React from "react"

import { createContext, useContext, useReducer, useCallback } from "react"
import { useAuth } from "./AuthContext"
import type { WaitListEntry } from "@/types"

// Define the state type
interface WaitListState {
  entries: WaitListEntry[]
  loading: boolean
  error: string | null
}

// Define the action types
type WaitListAction =
  | { type: "FETCH_ENTRIES_REQUEST" }
  | { type: "FETCH_ENTRIES_SUCCESS"; payload: WaitListEntry[] }
  | { type: "FETCH_ENTRIES_FAILURE"; payload: string }
  | { type: "ADD_ENTRY"; payload: WaitListEntry }
  | { type: "REMOVE_ENTRY"; payload: string }
  | { type: "NOTIFY_CUSTOMER"; payload: string }
  | { type: "SEAT_CUSTOMER"; payload: { id: string; tableId: string } }

// Define the context type
interface WaitListContextType {
  state: WaitListState
  fetchEntries: () => Promise<void>
  addEntry: (entry: Omit<WaitListEntry, "id" | "createdAt" | "updatedAt" | "notified">) => Promise<void>
  removeEntry: (id: string) => Promise<void>
  notifyCustomer: (id: string) => Promise<void>
  seatCustomer: (id: string, tableId: string) => Promise<void>
}

// Create the context
const WaitListContext = createContext<WaitListContextType | undefined>(undefined)

// Initial state
const initialState: WaitListState = {
  entries: [],
  loading: false,
  error: null,
}

// Reducer function
function waitListReducer(state: WaitListState, action: WaitListAction): WaitListState {
  switch (action.type) {
    case "FETCH_ENTRIES_REQUEST":
      return {
        ...state,
        loading: true,
        error: null,
      }
    case "FETCH_ENTRIES_SUCCESS":
      return {
        ...state,
        entries: action.payload,
        loading: false,
      }
    case "FETCH_ENTRIES_FAILURE":
      return {
        ...state,
        loading: false,
        error: action.payload,
      }
    case "ADD_ENTRY":
      return {
        ...state,
        entries: [...state.entries, action.payload],
      }
    case "REMOVE_ENTRY":
      return {
        ...state,
        entries: state.entries.filter((entry) => entry.id !== action.payload),
      }
    case "NOTIFY_CUSTOMER":
      return {
        ...state,
        entries: state.entries.map((entry) =>
          entry.id === action.payload ? { ...entry, notified: true, updatedAt: new Date().toISOString() } : entry,
        ),
      }
    case "SEAT_CUSTOMER":
      return {
        ...state,
        entries: state.entries.filter((entry) => entry.id !== action.payload.id),
      }
    default:
      return state
  }
}

// Provider component
export function WaitListProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(waitListReducer, initialState)
  const { state: authState } = useAuth()

  // Fetch wait list entries
  const fetchEntries = useCallback(async () => {
    if (!authState.token) return

    dispatch({ type: "FETCH_ENTRIES_REQUEST" })
    try {
      const response = await fetch("/api/waitlist", {
        headers: {
          Authorization: `Bearer ${authState.token}`,
        },
      })

      if (!response.ok) {
        throw new Error("Failed to fetch wait list entries")
      }

      const data = await response.json()
      dispatch({ type: "FETCH_ENTRIES_SUCCESS", payload: data })
    } catch (error) {
      console.error("Error fetching wait list entries:", error)
      dispatch({
        type: "FETCH_ENTRIES_FAILURE",
        payload: error instanceof Error ? error.message : "Failed to fetch wait list entries",
      })
    }
  }, [authState.token])

  // Add entry to wait list
  const addEntry = useCallback(
    async (entry: Omit<WaitListEntry, "id" | "createdAt" | "updatedAt" | "notified">) => {
      if (!authState.token) return

      try {
        const response = await fetch("/api/waitlist", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authState.token}`,
          },
          body: JSON.stringify(entry),
        })

        if (!response.ok) {
          throw new Error("Failed to add entry to wait list")
        }

        const data = await response.json()
        dispatch({ type: "ADD_ENTRY", payload: data })
      } catch (error) {
        console.error("Error adding entry to wait list:", error)
        throw error
      }
    },
    [authState.token],
  )

  // Remove entry from wait list
  const removeEntry = useCallback(
    async (id: string) => {
      if (!authState.token) return

      try {
        const response = await fetch(`/api/waitlist/${id}`, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${authState.token}`,
          },
        })

        if (!response.ok) {
          throw new Error("Failed to remove entry from wait list")
        }

        dispatch({ type: "REMOVE_ENTRY", payload: id })
      } catch (error) {
        console.error("Error removing entry from wait list:", error)
        throw error
      }
    },
    [authState.token],
  )

  // Notify customer
  const notifyCustomer = useCallback(
    async (id: string) => {
      if (!authState.token) return

      try {
        const entry = state.entries.find((e) => e.id === id)

        if (!entry) {
          throw new Error("Entry not found")
        }

        // If there's a phone number, send SMS notification
        if (entry.phoneNumber) {
          const response = await fetch(`/api/waitlist/${id}/notify`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${authState.token}`,
            },
          })

          if (!response.ok) {
            throw new Error("Failed to send notification")
          }
        } else {
          // If no phone number, just mark as notified
          const response = await fetch(`/api/waitlist/${id}`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${authState.token}`,
            },
            body: JSON.stringify({ notified: true }),
          })

          if (!response.ok) {
            throw new Error("Failed to update entry")
          }
        }

        dispatch({ type: "NOTIFY_CUSTOMER", payload: id })
      } catch (error) {
        console.error("Error notifying customer:", error)
        throw error
      }
    },
    [authState.token, state.entries],
  )

  // Seat customer
  const seatCustomer = useCallback(
    async (id: string, tableId: string) => {
      if (!authState.token) return

      try {
        const response = await fetch(`/api/waitlist/${id}/seat`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authState.token}`,
          },
          body: JSON.stringify({ tableId }),
        })

        if (!response.ok) {
          throw new Error("Failed to seat customer")
        }

        dispatch({ type: "SEAT_CUSTOMER", payload: { id, tableId } })
      } catch (error) {
        console.error("Error seating customer:", error)
        throw error
      }
    },
    [authState.token],
  )

  const value = {
    state,
    fetchEntries,
    addEntry,
    removeEntry,
    notifyCustomer,
    seatCustomer,
  }

  return <WaitListContext.Provider value={value}>{children}</WaitListContext.Provider>
}

// Custom hook
export function useWaitList() {
  const context = useContext(WaitListContext)
  if (context === undefined) {
    throw new Error("useWaitList must be used within a WaitListProvider")
  }
  return context
}
