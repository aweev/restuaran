"use client"

import type React from "react"

import { createContext, useContext, useReducer, useCallback } from "react"
import { useAuth } from "./AuthContext"
import type { Customer } from "@/types"

// Define the state type
interface CustomerState {
  customers: Customer[]
  loading: boolean
  error: string | null
}

// Define the action types
type CustomerAction =
  | { type: "FETCH_CUSTOMERS_REQUEST" }
  | { type: "FETCH_CUSTOMERS_SUCCESS"; payload: Customer[] }
  | { type: "FETCH_CUSTOMERS_FAILURE"; payload: string }
  | { type: "SEARCH_CUSTOMERS_REQUEST" }
  | { type: "SEARCH_CUSTOMERS_SUCCESS"; payload: Customer[] }
  | { type: "SEARCH_CUSTOMERS_FAILURE"; payload: string }
  | { type: "ADD_CUSTOMER"; payload: Customer }
  | { type: "UPDATE_CUSTOMER"; payload: Customer }
  | { type: "DELETE_CUSTOMER"; payload: string }

// Define the context type
interface CustomerContextType {
  state: CustomerState
  fetchCustomers: () => Promise<void>
  searchCustomers: (query: string) => Promise<void>
  addCustomer: (customer: Omit<Customer, "id">) => Promise<void>
  updateCustomer: (customer: Customer) => Promise<void>
  deleteCustomer: (id: string) => Promise<void>
}

// Create the context
const CustomerContext = createContext<CustomerContextType | undefined>(undefined)

// Initial state
const initialState: CustomerState = {
  customers: [],
  loading: false,
  error: null,
}

// Reducer function
function customerReducer(state: CustomerState, action: CustomerAction): CustomerState {
  switch (action.type) {
    case "FETCH_CUSTOMERS_REQUEST":
    case "SEARCH_CUSTOMERS_REQUEST":
      return {
        ...state,
        loading: true,
        error: null,
      }
    case "FETCH_CUSTOMERS_SUCCESS":
    case "SEARCH_CUSTOMERS_SUCCESS":
      return {
        ...state,
        customers: action.payload,
        loading: false,
      }
    case "FETCH_CUSTOMERS_FAILURE":
    case "SEARCH_CUSTOMERS_FAILURE":
      return {
        ...state,
        loading: false,
        error: action.payload,
      }
    case "ADD_CUSTOMER":
      return {
        ...state,
        customers: [...state.customers, action.payload],
      }
    case "UPDATE_CUSTOMER":
      return {
        ...state,
        customers: state.customers.map((customer) => (customer.id === action.payload.id ? action.payload : customer)),
      }
    case "DELETE_CUSTOMER":
      return {
        ...state,
        customers: state.customers.filter((customer) => customer.id !== action.payload),
      }
    default:
      return state
  }
}

// Provider component
export function CustomerProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(customerReducer, initialState)
  const { state: authState } = useAuth()

  // Fetch all customers
  const fetchCustomers = useCallback(async () => {
    if (!authState.token) return

    dispatch({ type: "FETCH_CUSTOMERS_REQUEST" })
    try {
      const response = await fetch("/api/customers", {
        headers: {
          Authorization: `Bearer ${authState.token}`,
        },
      })

      if (!response.ok) {
        throw new Error("Failed to fetch customers")
      }

      const data = await response.json()
      dispatch({ type: "FETCH_CUSTOMERS_SUCCESS", payload: data })
    } catch (error) {
      console.error("Error fetching customers:", error)
      dispatch({
        type: "FETCH_CUSTOMERS_FAILURE",
        payload: error instanceof Error ? error.message : "Failed to fetch customers",
      })
    }
  }, [authState.token])

  // Search customers
  const searchCustomers = useCallback(
    async (query: string) => {
      if (!authState.token) return

      dispatch({ type: "SEARCH_CUSTOMERS_REQUEST" })
      try {
        const response = await fetch(`/api/customers/search?q=${encodeURIComponent(query)}`, {
          headers: {
            Authorization: `Bearer ${authState.token}`,
          },
        })

        if (!response.ok) {
          throw new Error("Failed to search customers")
        }

        const data = await response.json()
        dispatch({ type: "SEARCH_CUSTOMERS_SUCCESS", payload: data })
      } catch (error) {
        console.error("Error searching customers:", error)
        dispatch({
          type: "SEARCH_CUSTOMERS_FAILURE",
          payload: error instanceof Error ? error.message : "Failed to search customers",
        })
      }
    },
    [authState.token],
  )

  // Add customer
  const addCustomer = useCallback(
    async (customer: Omit<Customer, "id">) => {
      if (!authState.token) return

      try {
        const response = await fetch("/api/customers", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authState.token}`,
          },
          body: JSON.stringify(customer),
        })

        if (!response.ok) {
          throw new Error("Failed to add customer")
        }

        const data = await response.json()
        dispatch({ type: "ADD_CUSTOMER", payload: data })
      } catch (error) {
        console.error("Error adding customer:", error)
        throw error
      }
    },
    [authState.token],
  )

  // Update customer
  const updateCustomer = useCallback(
    async (customer: Customer) => {
      if (!authState.token) return

      try {
        const response = await fetch(`/api/customers/${customer.id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authState.token}`,
          },
          body: JSON.stringify(customer),
        })

        if (!response.ok) {
          throw new Error("Failed to update customer")
        }

        const data = await response.json()
        dispatch({ type: "UPDATE_CUSTOMER", payload: data })
      } catch (error) {
        console.error("Error updating customer:", error)
        throw error
      }
    },
    [authState.token],
  )

  // Delete customer
  const deleteCustomer = useCallback(
    async (id: string) => {
      if (!authState.token) return

      try {
        const response = await fetch(`/api/customers/${id}`, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${authState.token}`,
          },
        })

        if (!response.ok) {
          throw new Error("Failed to delete customer")
        }

        dispatch({ type: "DELETE_CUSTOMER", payload: id })
      } catch (error) {
        console.error("Error deleting customer:", error)
        throw error
      }
    },
    [authState.token],
  )

  const value = {
    state,
    fetchCustomers,
    searchCustomers,
    addCustomer,
    updateCustomer,
    deleteCustomer,
  }

  return <CustomerContext.Provider value={value}>{children}</CustomerContext.Provider>
}

// Custom hook
export function useCustomer() {
  const context = useContext(CustomerContext)
  if (context === undefined) {
    throw new Error("useCustomer must be used within a CustomerProvider")
  }
  return context
}
