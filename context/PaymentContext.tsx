"use client"

import { createContext, useReducer, useContext, useCallback, useMemo, type ReactNode } from "react"
import type { PaymentState, PaymentDetails, Discount } from "@/types/payment"
import { useCommand, useKernel } from "@/kernel/react/kernel-provider"

const initialState: PaymentState = {
  payments: [],
  activePayment: null,
  loading: false,
  error: null,
  discounts: [],
  appliedDiscountId: null,
  promoCode: null,
}

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

const paymentReducer = (state: PaymentState, action: PaymentAction): PaymentState => {
  switch (action.type) {
    case "FETCH_PAYMENTS_START":
      return { ...state, loading: true, error: null }
    case "FETCH_PAYMENTS_SUCCESS":
      return { ...state, payments: action.payload, loading: false }
    case "FETCH_PAYMENTS_FAILURE":
      return { ...state, loading: false, error: action.payload }
    case "SET_ACTIVE_PAYMENT":
      return { ...state, activePayment: action.payload }
    case "ADD_PAYMENT":
      return { ...state, payments: [...state.payments, action.payload] }
    case "FETCH_DISCOUNTS_START":
      return { ...state, loading: true, error: null }
    case "FETCH_DISCOUNTS_SUCCESS":
      return { ...state, discounts: action.payload, loading: false }
    case "FETCH_DISCOUNTS_FAILURE":
      return { ...state, loading: false, error: action.payload }
    case "APPLY_DISCOUNT":
      return { ...state, appliedDiscountId: action.payload }
    case "REMOVE_DISCOUNT":
      return { ...state, appliedDiscountId: null }
    case "SET_PROMO_CODE":
      return { ...state, promoCode: action.payload }
    default:
      return state
  }
}

interface PaymentContextType {
  state: PaymentState
  fetchPayments: (orderId?: string) => Promise<void>
  setActivePayment: (payment: PaymentDetails | null) => void
  addPayment: (payment: PaymentDetails) => Promise<void>
  fetchDiscounts: () => Promise<void>
  applyDiscount: (discountId: string, amount: number) => Promise<void>
  removeDiscount: () => Promise<void>
  setPromoCode: (code: string | null) => void
  validatePromoCode: (code: string, subtotal?: number) => Promise<{
    valid: boolean
    discountType?: "percentage" | "fixed"
    discountValue?: number
    message?: string
  }>
}

const PaymentContext = createContext<PaymentContextType | undefined>(undefined)

export const PaymentProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(paymentReducer, initialState)
  const { run } = useCommand()
  const { ask } = useKernel()

  const fetchPayments = useCallback(async (orderId?: string) => {
    if (!orderId) {
      dispatch({ type: "FETCH_PAYMENTS_SUCCESS", payload: [] })
      return
    }
    dispatch({ type: "FETCH_PAYMENTS_START" })
    try {
      const result = await ask("get.order", { orderId })
      if (!result.success) {
        throw new Error(result.error.message)
      }
      const orderState = (result.data as { state?: { payments?: PaymentDetails[] } }).state
      const payments = orderState?.payments ?? []
      const formattedPayments: PaymentDetails[] = payments.map(p => ({
        id: p.id || `pay-${Date.now()}`,
        orderId,
        method: (p.method || "cash") as PaymentDetails["method"],
        amount: Number(p.amount ?? 0),
        tip: Number(p.tip ?? 0),
        reference: p.reference,
        transactionId: p.transactionId,
        timestamp: p.timestamp || new Date().toISOString(),
        gateway: p.gateway,
        metadata: p.metadata,
      }))
      dispatch({ type: "FETCH_PAYMENTS_SUCCESS", payload: formattedPayments })
    } catch (error) {
      dispatch({
        type: "FETCH_PAYMENTS_FAILURE",
        payload: error instanceof Error ? error.message : "Failed to fetch payments",
      })
    }
  }, [ask])

  const setActivePayment = useCallback((payment: PaymentDetails | null) => {
    dispatch({ type: "SET_ACTIVE_PAYMENT", payload: payment })
  }, [])

  const addPayment = useCallback(async (payment: PaymentDetails) => {
    const cardMethods: Array<PaymentDetails["method"]> = ["credit", "debit"]
    // Card payments go through the authorize → capture flow (Stripe Terminal
    // when ROS_PAYMENT_PROVIDER=stripe-terminal, simulated/manual otherwise)
    // so declines are surfaced before the order records revenue.
    if (cardMethods.includes(payment.method)) {
      const auth = await run("payment.authorize", {
        orderId: payment.orderId,
        amount: payment.amount,
        method: payment.method,
        gateway: payment.gateway,
      })
      if (!auth.success) {
        throw new Error(auth.error.message)
      }
      const paymentId = auth.success ? (auth.aggregateId ?? undefined) : undefined
      if (paymentId) {
        const cap = await run("payment.capture", { paymentId })
        if (!cap.success) {
          throw new Error(cap.error.message)
        }
      }
    }
    const result = await run("order.recordPayment", {
      orderId: payment.orderId,
      method: payment.method,
      amount: payment.amount,
      gateway: payment.gateway,
      ...(payment.tip ? { tip: payment.tip } : {}),
    })
    if (!result.success) {
      throw new Error(result.error.message)
    }
    dispatch({
      type: "ADD_PAYMENT",
      payload: payment,
    })
  }, [run, dispatch])

  const fetchDiscounts = useCallback(async () => {
    dispatch({ type: "FETCH_DISCOUNTS_START" })
    try {
      const result = await ask("list.promotions", { active: true })
      if (!result.success) {
        throw new Error(result.error.message)
      }
      const rows = result.data as Array<{
        promotionId: string
        code: string
        name: string
        kind: string
        value: number | string
        active: boolean
      }>
      const discounts: Discount[] = rows.map(row => ({
        id: row.promotionId,
        name: row.name,
        code: row.code,
        type: row.kind === "percent" ? "percentage" : "fixed",
        value: Number(row.value),
        active: row.active,
      }))
      dispatch({ type: "FETCH_DISCOUNTS_SUCCESS", payload: discounts })
    } catch (error) {
      dispatch({
        type: "FETCH_DISCOUNTS_FAILURE",
        payload: error instanceof Error ? error.message : "Failed to fetch discounts",
      })
    }
  }, [ask])

  const applyDiscount = useCallback(async (_discountId: string, _amount: number) => {
    dispatch({ type: "APPLY_DISCOUNT", payload: _discountId })
  }, [])

  const removeDiscount = useCallback(async () => {
    dispatch({ type: "REMOVE_DISCOUNT" })
  }, [])

  const setPromoCode = useCallback((code: string | null) => {
    dispatch({ type: "SET_PROMO_CODE", payload: code })
  }, [])

  const validatePromoCode = useCallback(async (code: string, subtotal: number = 0) => {
    try {
      const result = await ask("promotion.evaluate", { code, subtotal })
      if (!result.success) {
        return {
          valid: false,
          message: result.error.message,
        }
      }
      const data = result.data as {
        kind?: string
        value?: number | string
        applicable?: boolean
      }
      return {
        valid: true,
        discountType: data.kind === "percent" ? ("percentage" as const) : ("fixed" as const),
        discountValue: typeof data.value === "number" ? data.value : Number(data.value) || 0,
        message: "Promo code applied",
      }
    } catch (_error) {
      return {
        valid: false,
        message: "Error validating promo code",
      }
    }
  }, [ask])

  const contextValue = useMemo<PaymentContextType>(
    () => ({
      state,
      fetchPayments,
      setActivePayment,
      addPayment,
      fetchDiscounts,
      applyDiscount,
      removeDiscount,
      setPromoCode,
      validatePromoCode,
    }),
    [state, fetchPayments, setActivePayment, addPayment, fetchDiscounts, applyDiscount, removeDiscount, setPromoCode, validatePromoCode],
  )

  return <PaymentContext.Provider value={contextValue}>{children}</PaymentContext.Provider>
}

export const usePayment = () => {
  const context = useContext(PaymentContext)
  if (context === undefined) {
    throw new Error("usePayment must be used within a PaymentProvider")
  }
  return context
}
