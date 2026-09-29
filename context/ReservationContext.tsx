"use client"

import type React from "react"
import { createContext, useContext, useReducer, useCallback, useEffect } from "react"
import type { Reservation } from "@/types/reservation"
import { useAuth } from "./AuthContext"
import { useSocket } from "@/lib/socket-client"

// Define the state type
interface ReservationState {
  reservations: Reservation[]
  loading: boolean
  error: string | null
}

// Define the action types
type ReservationAction =
  | { type: "FETCH_RESERVATIONS_REQUEST" }
  | { type: "FETCH_RESERVATIONS_SUCCESS"; payload: Reservation[] }
  | { type: "FETCH_RESERVATIONS_FAILURE"; payload: string }
  | { type: "ADD_RESERVATION"; payload: Reservation }
  | { type: "UPDATE_RESERVATION"; payload: Reservation }
  | { type: "CANCEL_RESERVATION"; payload: string }
  | { type: "DELETE_RESERVATION"; payload: string }

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

// Initial state
const initialState: ReservationState = {
  reservations: [],
  loading: false,
  error: null,
}

// Reducer function
function reservationReducer(state: ReservationState, action: ReservationAction): ReservationState {
  switch (action.type) {
    case "FETCH_RESERVATIONS_REQUEST":
      return {
        ...state,
        loading: true,
        error: null,
      }
    case "FETCH_RESERVATIONS_SUCCESS":
      return {
        ...state,
        reservations: Array.isArray(action.payload) ? action.payload : [],
        loading: false,
      }
    case "FETCH_RESERVATIONS_FAILURE":
      return {
        ...state,
        loading: false,
        error: action.payload,
      }
    case "ADD_RESERVATION":
      return {
        ...state,
        reservations: [...state.reservations, action.payload],
      }
    case "UPDATE_RESERVATION":
      return {
        ...state,
        reservations: state.reservations.map((reservation) =>
          reservation.id === action.payload.id ? action.payload : reservation,
        ),
      }
    case "CANCEL_RESERVATION":
      return {
        ...state,
        reservations: state.reservations.map((reservation) =>
          reservation.id === action.payload
            ? { ...reservation, status: "cancelled", updatedAt: new Date().toISOString() }
            : reservation,
        ),
      }
    case "DELETE_RESERVATION":
      return {
        ...state,
        reservations: state.reservations.filter((reservation) => reservation.id !== action.payload),
      }
    default:
      return state
  }
}

// Provider component
export function ReservationProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reservationReducer, initialState)
  const { state: authState } = useAuth()
  const { subscribe } = useSocket()

  // Set up WebSocket listeners
  useEffect(() => {
    if (!authState.isAuthenticated) return

    // Subscribe to reservation events
    const unsubscribeNew = subscribe<Reservation>("reservation:new", (data) => {
      dispatch({ type: "ADD_RESERVATION", payload: data })
    })

    const unsubscribeUpdate = subscribe<Reservation>("reservation:update", (data) => {
      dispatch({ type: "UPDATE_RESERVATION", payload: data })
    })

    const unsubscribeDelete = subscribe<{ id: string }>("reservation:delete", (data) => {
      dispatch({ type: "DELETE_RESERVATION", payload: data.id })
    })

    return () => {
      unsubscribeNew()
      unsubscribeUpdate()
      unsubscribeDelete()
    }
  }, [authState.isAuthenticated, subscribe])

  // Real API calls
  const fetchReservations = useCallback(async () => {
    if (!authState.token) return

    dispatch({ type: "FETCH_RESERVATIONS_REQUEST" })
    try {
      const response = await fetch("/api/reservations", {
        headers: {
          Authorization: `Bearer ${authState.token}`,
        },
      })

      if (!response.ok) {
        throw new Error("Failed to fetch reservations")
      }

      const data = await response.json()

      // Transform data if needed (snake_case to camelCase)
      const reservations = data.map((item: Record<string, unknown>) => ({
        id: item.id,
        customerName: item.customer_name,
        phone: item.phone,
        email: item.email,
        partySize: item.party_size,
        tableId: item.table_id,
        date: item.date,
        time: item.time,
        status: item.status,
        notes: item.notes,
        createdAt: item.created_at,
        updatedAt: item.updated_at,
      }))

      dispatch({ type: "FETCH_RESERVATIONS_SUCCESS", payload: reservations })
    } catch (error) {
      console.error("Error fetching reservations:", error)
      dispatch({
        type: "FETCH_RESERVATIONS_FAILURE",
        payload: error instanceof Error ? error.message : "Failed to fetch reservations",
      })
    }
  }, [authState.token])

  const addReservation = useCallback(
    async (reservation: Reservation) => {
      if (!authState.token) return

      try {
        const response = await fetch("/api/reservations", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authState.token}`,
          },
          body: JSON.stringify({
            customerName: reservation.customerName,
            phone: reservation.phone,
            email: reservation.email,
            partySize: reservation.partySize,
            tableId: reservation.tableId,
            date: reservation.date,
            time: reservation.time,
            status: reservation.status,
            notes: reservation.notes,
          }),
        })

        if (!response.ok) {
          throw new Error("Failed to add reservation")
        }

        const data = await response.json()

        // Transform response if needed
        const newReservation = {
          id: data.id,
          customerName: data.customer_name,
          phone: data.phone,
          email: data.email,
          partySize: data.party_size,
          tableId: data.table_id,
          date: data.date,
          time: data.time,
          status: data.status,
          notes: data.notes,
          createdAt: data.created_at,
          updatedAt: data.updated_at,
        }

        dispatch({ type: "ADD_RESERVATION", payload: newReservation })
      } catch (error) {
        console.error("Error adding reservation:", error)
        throw error
      }
    },
    [authState.token],
  )

  const updateReservation = useCallback(
    async (reservation: Reservation) => {
      if (!authState.token) return

      try {
        const response = await fetch(`/api/reservations/${reservation.id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authState.token}`,
          },
          body: JSON.stringify({
            customerName: reservation.customerName,
            phone: reservation.phone,
            email: reservation.email,
            partySize: reservation.partySize,
            tableId: reservation.tableId,
            date: reservation.date,
            time: reservation.time,
            status: reservation.status,
            notes: reservation.notes,
          }),
        })

        if (!response.ok) {
          throw new Error("Failed to update reservation")
        }

        const data = await response.json()

        // Transform response if needed
        const updatedReservation = {
          id: data.id,
          customerName: data.customer_name,
          phone: data.phone,
          email: data.email,
          partySize: data.party_size,
          tableId: data.table_id,
          date: data.date,
          time: data.time,
          status: data.status,
          notes: data.notes,
          createdAt: data.created_at,
          updatedAt: data.updated_at,
        }

        dispatch({ type: "UPDATE_RESERVATION", payload: updatedReservation })
      } catch (error) {
        console.error("Error updating reservation:", error)
        throw error
      }
    },
    [authState.token],
  )

  const cancelReservation = useCallback(
    async (id: string) => {
      if (!authState.token) return

      try {
        const response = await fetch(`/api/reservations/${id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authState.token}`,
          },
          body: JSON.stringify({
            status: "cancelled",
          }),
        })

        if (!response.ok) {
          throw new Error("Failed to cancel reservation")
        }

        dispatch({ type: "CANCEL_RESERVATION", payload: id })
      } catch (error) {
        console.error("Error cancelling reservation:", error)
        throw error
      }
    },
    [authState.token],
  )

  const deleteReservation = useCallback(
    async (id: string) => {
      if (!authState.token) return

      try {
        const response = await fetch(`/api/reservations/${id}`, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${authState.token}`,
          },
        })

        if (!response.ok) {
          throw new Error("Failed to delete reservation")
        }

        dispatch({ type: "DELETE_RESERVATION", payload: id })
      } catch (error) {
        console.error("Error deleting reservation:", error)
        throw error
      }
    },
    [authState.token],
  )

  const value = {
    state,
    fetchReservations,
    addReservation,
    updateReservation,
    cancelReservation,
    deleteReservation,
  }

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
