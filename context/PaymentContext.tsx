"use client"

import { createContext, useReducer, useContext, useEffect, useCallback, type ReactNode } from "react"
import type { PaymentState, PaymentDetails, Discount } from "@/types/payment"
import { useAuth } from "./AuthContext"

// Initial state
const initialState: PaymentState = {
  payments: [],
  activePayment: null,
  loading: false,
  error: null,
  discounts: [],
  appliedDiscountId: null,
  promoCode: null,
}

// Action types
type PaymentAction =
  | { type: "FETCH_PAYMENTS_START" }
  | { type: "FETCH_PAYMENTS_SUCCESS"; payload: PaymentDetails[] }
  | { type: "FETCH_PAYMENTS_FAILURE"; payload: string }
  | { type: "SET_ACTIVE_PAYMENT"; payload: PaymentDetails | null }
  | { type: "ADD_PAYMENT"; payload: PaymentDetails }
  | { type: "FETCH_DISCOUNTS_START" }
  | { type: "FETCH_DISCOUNTS_SUCCESS"; payload: Discount[] }
  | { type: "FETCH_DISCOUNTS_FAILURE"; payload: string }
  | { type: "APPLY_DISCOUNT"; payload: string }
  | { type: "REMOVE_DISCOUNT" }
  | { type: "SET_PROMO_CODE"; payload: string | null }

// Reducer
const paymentReducer = (state: PaymentState, action: PaymentAction): PaymentState => {
  switch (action.type) {
    case "FETCH_PAYMENTS_START":
      return {
        ...state,
        loading: true,
        error: null,
      }
    case "FETCH_PAYMENTS_SUCCESS":
      return {
        ...state,
        payments: action.payload,
        loading: false,
      }
    case "FETCH_PAYMENTS_FAILURE":
      return {
        ...state,
        loading: false,
        error: action.payload,
      }
    case "SET_ACTIVE_PAYMENT":
      return {
        ...state,
        activePayment: action.payload,
      }
    case "ADD_PAYMENT":
      return {
        ...state,
        payments: [...state.payments, action.payload],
      }
    case "FETCH_DISCOUNTS_START":
      return {
        ...state,
        loading: true,
        error: null,
      }
    case "FETCH_DISCOUNTS_SUCCESS":
      return {
        ...state,
        discounts: action.payload,
        loading: false,
      }
    case "FETCH_DISCOUNTS_FAILURE":
      return {
        ...state,
        loading: false,
        error: action.payload,
      }
    case "APPLY_DISCOUNT":
      return {
        ...state,
        appliedDiscountId: action.payload,
      }
    case "REMOVE_DISCOUNT":
      return {
        ...state,
        appliedDiscountId: null,
      }
    case "SET_PROMO_CODE":
      return {
        ...state,
        promoCode: action.payload,
      }
    default:
      return state
  }
}

// Create context
interface PaymentContextType {
  state: PaymentState
  fetchPayments: (orderId?: string) => Promise<void>
  setActivePayment: (payment: PaymentDetails | null) => void
  addPayment: (payment: PaymentDetails) => Promise<void>
  fetchDiscounts: () => Promise<void>
  applyDiscount: (discountId: string) => void
  removeDiscount: () => void
  setPromoCode: (code: string | null) => void
  validatePromoCode: (code: string) => Promise<{
    valid: boolean
    discountType?: "percentage" | "fixed"
    discountValue?: number
    message?: string
  }>
}

const PaymentContext = createContext<PaymentContextType | undefined>(undefined)

// Provider component
export const PaymentProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(paymentReducer, initialState)
  const { state: authState } = useAuth()


  // Actions
  const fetchPayments = async (orderId?: string) => {
    dispatch({ type: "FETCH_PAYMENTS_START" })
    try {
      const url = orderId ? `/api/orders/${orderId}/payments` : "/api/payments"
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${authState.token}`,
        },
      })

      if (!response.ok) {
        throw new Error("Failed to fetch payments")
      }

      const data = await response.json()

      dispatch({
        type: "FETCH_PAYMENTS_SUCCESS",
        payload: data,
      })
    } catch (error) {
      dispatch({
        type: "FETCH_PAYMENTS_FAILURE",
        payload: error instanceof Error ? error.message : "Failed to fetch payments",
      })
    }
  }

  const setActivePayment = (payment: PaymentDetails | null) => {
    dispatch({ type: "SET_ACTIVE_PAYMENT", payload: payment })
  }

  const addPayment = async (payment: PaymentDetails) => {
    try {
      const response = await fetch(`/api/orders/${payment.orderId}/payments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authState.token}`,
        },
        body: JSON.stringify(payment),
      })

      if (!response.ok) {
        throw new Error("Failed to add payment")
      }

      const newPayment = await response.json()

      dispatch({
        type: "ADD_PAYMENT",
        payload: newPayment,
      })

      return Promise.resolve()
    } catch (error) {
      return Promise.reject(error instanceof Error ? error.message : "Failed to add payment")
    }
  }

  // Memoized so the mount effect below can list it as a dependency without
  // re-fetching on every render.
  const fetchDiscounts = useCallback(async () => {
    dispatch({ type: "FETCH_DISCOUNTS_START" })
    try {
      const response = await fetch("/api/discounts", {
        headers: {
          Authorization: `Bearer ${authState.token}`,
        },
      })

      if (!response.ok) {
        throw new Error("Failed to fetch discounts")
      }

      const data = await response.json()

      dispatch({
        type: "FETCH_DISCOUNTS_SUCCESS",
        payload: data,
      })
    } catch (error) {
      dispatch({
        type: "FETCH_DISCOUNTS_FAILURE",
        payload: error instanceof Error ? error.message : "Failed to fetch discounts",
      })
    }
  }, [authState.token])

  // Fetch payments when component mounts and user is authenticated
  useEffect(() => {
    if (authState.isAuthenticated) {
      fetchDiscounts()
    }
  }, [authState.isAuthenticated, fetchDiscounts])

  const applyDiscount = (discountId: string) => {
    dispatch({ type: "APPLY_DISCOUNT", payload: discountId })
  }

  const removeDiscount = () => {
    dispatch({ type: "REMOVE_DISCOUNT" })
  }

  const setPromoCode = (code: string | null) => {
    dispatch({ type: "SET_PROMO_CODE", payload: code })
  }

  const validatePromoCode = async (code: string) => {
    try {
      const response = await fetch(`/api/discounts/promo/${code}`, {
        headers: {
          Authorization: `Bearer ${authState.token}`,
        },
      })

      if (!response.ok) {
        throw new Error("Failed to validate promo code")
      }

      return await response.json()
    } catch (error) {
      console.error("Error validating promo code:", error)
      return {
        valid: false,
        message: "Error validating promo code",
      }
    }
  }

  return (
    <PaymentContext.Provider
      value={{
        state,
        fetchPayments,
        setActivePayment,
        addPayment,
        fetchDiscounts,
        applyDiscount,
        removeDiscount,
        setPromoCode,
        validatePromoCode,
      }}
    >
      {children}
    </PaymentContext.Provider>
  )
}

// Custom hook
export const usePayment = () => {
  const context = useContext(PaymentContext)
  if (context === undefined) {
    throw new Error("usePayment must be used within a PaymentProvider")
  }
  return context
}