"use client"

import { createContext, useReducer, useContext, useEffect, useCallback, type ReactNode } from "react"
import type { OrderState, Order, OrderStatus, CartItem, DiningMode, Payment, Table } from "@/types"
import { useAuth } from "./AuthContext"

// Initial state
const initialState: OrderState = {
  orders: [],
  activeOrders: [],
  completedOrders: [],
  loading: false,
  error: null,
  selectedOrder: null,
}

// Action types
type OrderAction =
  | { type: "FETCH_ORDERS_START" }
  | { type: "FETCH_ORDERS_SUCCESS"; payload: Order[] }
  | { type: "FETCH_ORDERS_FAILURE"; payload: string }
  | { type: "SELECT_ORDER"; payload: Order | null }
  | { type: "CREATE_ORDER"; payload: Order }
  | { type: "UPDATE_ORDER_STATUS"; payload: { orderId: string; status: OrderStatus } }
  | { type: "ADD_PAYMENT"; payload: { orderId: string; payment: Payment } }
  | { type: "UPDATE_ORDER_ITEMS"; payload: { orderId: string; items: CartItem[] } }
  | { type: "CANCEL_ORDER"; payload: string }
  | { type: "UPDATE_ORDER_NOTES"; payload: { orderId: string; notes: string } }
  | { type: "REASSIGN_ORDERS_TABLE"; payload: { targetTableId: string; sourceTableIds: string[]; targetTable: Table } }

// Helper function to filter active and completed orders
const filterOrders = (orders: Order[]): { activeOrders: Order[]; completedOrders: Order[] } => {
  const activeStatuses: OrderStatus[] = ["pending", "preparing", "ready", "delivered"]
  const completedStatuses: OrderStatus[] = ["completed", "cancelled"]

  const activeOrders = orders.filter((order) => activeStatuses.includes(order.status))
  const completedOrders = orders.filter((order) => completedStatuses.includes(order.status))

  return { activeOrders, completedOrders }
}

// Reducer
const orderReducer = (state: OrderState, action: OrderAction): OrderState => {
  switch (action.type) {
    case "FETCH_ORDERS_START":
      return {
        ...state,
        loading: true,
        error: null,
      }
    case "FETCH_ORDERS_SUCCESS": {
      const orders = Array.isArray(action.payload) ? action.payload : []
      const { activeOrders, completedOrders } = filterOrders(orders)

      return {
        ...state,
        orders,
        activeOrders,
        completedOrders,
        loading: false,
      }
    }
    case "FETCH_ORDERS_FAILURE":
      return {
        ...state,
        loading: false,
        error: action.payload,
      }
    case "SELECT_ORDER":
      return {
        ...state,
        selectedOrder: action.payload,
      }
    case "CREATE_ORDER": {
      const newOrder = action.payload
      const updatedOrders = [...state.orders, newOrder]
      const { activeOrders, completedOrders } = filterOrders(updatedOrders)

      return {
        ...state,
        orders: updatedOrders,
        activeOrders,
        completedOrders,
      }
    }
    case "UPDATE_ORDER_STATUS": {
      const updatedOrders = state.orders.map((order) =>
        order.id === action.payload.orderId
          ? {
              ...order,
              status: action.payload.status,
              updatedAt: new Date().toISOString(),
            }
          : order,
      )

      const { activeOrders, completedOrders } = filterOrders(updatedOrders)

      return {
        ...state,
        orders: updatedOrders,
        activeOrders,
        completedOrders,
        // Update selected order if it's the one being modified
        selectedOrder:
          state.selectedOrder?.id === action.payload.orderId
            ? { ...state.selectedOrder, status: action.payload.status, updatedAt: new Date().toISOString() }
            : state.selectedOrder,
      }
    }
    case "ADD_PAYMENT": {
      const { orderId, payment } = action.payload

      const updatedOrders = state.orders.map((order) => {
        if (order.id === orderId) {
          const updatedPayments = [...order.payments, payment]
          const totalPaid = updatedPayments.reduce((sum, p) => sum + p.amount, 0)
          const isPaid = totalPaid >= order.total

          return {
            ...order,
            payments: updatedPayments,
            isPaid,
            updatedAt: new Date().toISOString(),
          }
        }
        return order
      })

      return {
        ...state,
        orders: updatedOrders,
        // Update selected order if it's the one being modified
        selectedOrder:
          state.selectedOrder?.id === orderId
            ? {
                ...state.selectedOrder,
                payments: [...state.selectedOrder.payments, payment],
                isPaid:
                  [...state.selectedOrder.payments, payment].reduce((sum, p) => sum + p.amount, 0) >=
                  state.selectedOrder.total,
                updatedAt: new Date().toISOString(),
              }
            : state.selectedOrder,
      }
    }
    case "UPDATE_ORDER_ITEMS": {
      const { orderId, items } = action.payload

      const updatedOrders = state.orders.map((order) => {
        if (order.id === orderId) {
          // Recalculate totals
          const subtotal = items.reduce((sum, item) => sum + item.totalPrice, 0)
          const taxRate = 0.05 // 5% tax rate
          const tax = subtotal * taxRate
          const total = subtotal + tax - order.discount

          return {
            ...order,
            items,
            subtotal,
            tax,
            total,
            updatedAt: new Date().toISOString(),
          }
        }
        return order
      })

      return {
        ...state,
        orders: updatedOrders,
        // Update selected order if it's the one being modified
        selectedOrder:
          state.selectedOrder?.id === orderId
            ? {
                ...state.selectedOrder,
                items,
                subtotal: items.reduce((sum, item) => sum + item.totalPrice, 0),
                tax: items.reduce((sum, item) => sum + item.totalPrice, 0) * 0.05,
                total: items.reduce((sum, item) => sum + item.totalPrice, 0) * 1.05 - state.selectedOrder.discount,
                updatedAt: new Date().toISOString(),
              }
            : state.selectedOrder,
      }
    }
    case "CANCEL_ORDER": {
      const updatedOrders: Order[] = state.orders.map((order) =>
        order.id === action.payload
          ? {
              ...order,
              status: "cancelled" as const,
              updatedAt: new Date().toISOString(),
            }
          : order,
      )

      const { activeOrders, completedOrders } = filterOrders(updatedOrders)

      return {
        ...state,
        orders: updatedOrders,
        activeOrders,
        completedOrders,
        // Update selected order if it's the one being cancelled
        selectedOrder:
          state.selectedOrder?.id === action.payload
            ? { ...state.selectedOrder, status: "cancelled" as const, updatedAt: new Date().toISOString() }
            : state.selectedOrder,
      }
    }
    case "UPDATE_ORDER_NOTES": {
      const { orderId, notes } = action.payload

      const updatedOrders = state.orders.map((order) =>
        order.id === orderId
          ? {
              ...order,
              notes,
              updatedAt: new Date().toISOString(),
            }
          : order,
      )

      return {
        ...state,
        orders: updatedOrders,
        // Update selected order if it's the one being modified
        selectedOrder:
          state.selectedOrder?.id === orderId
            ? { ...state.selectedOrder, notes, updatedAt: new Date().toISOString() }
            : state.selectedOrder,
      }
    }
    case "REASSIGN_ORDERS_TABLE": {
      const { targetTableId, sourceTableIds, targetTable } = action.payload
      const sourceIds = new Set(sourceTableIds)
      const now = new Date().toISOString()

      // Only active orders move; completed/cancelled ones keep their history table.
      const activeStatuses: OrderStatus[] = ["pending", "preparing", "ready", "delivered"]

      const updatedOrders: Order[] = state.orders.map((order) =>
        order.tableId !== null && sourceIds.has(order.tableId) && activeStatuses.includes(order.status)
          ? {
              ...order,
              tableId: targetTableId,
              table: targetTable,
              tableNumber: targetTable.number,
              updatedAt: now,
            }
          : order,
      )

      const { activeOrders, completedOrders } = filterOrders(updatedOrders)

      return {
        ...state,
        orders: updatedOrders,
        activeOrders,
        completedOrders,
        selectedOrder: state.selectedOrder
          ? updatedOrders.find((order) => order.id === state.selectedOrder!.id) ?? state.selectedOrder
          : state.selectedOrder,
      }
    }
    default:
      return state
  }
}

// Create context
interface OrderContextType {
  state: OrderState
  fetchOrders: () => Promise<void>
  selectOrder: (order: Order | null) => void
  createOrder: (
    items: CartItem[],
    tableId: string | null,
    customerName: string | null,
    diningMode: DiningMode,
    serverId: string,
    subtotal: number,
    tax: number,
    discount: number,
    total: number,
    notes?: string,
  ) => Promise<Order>
  updateOrderStatus: (orderId: string, status: OrderStatus) => Promise<void>
  addPayment: (orderId: string, payment: Payment) => Promise<void>
  updateOrderItems: (orderId: string, items: CartItem[]) => Promise<void>
  updateOrderNotes: (orderId: string, notes: string) => Promise<void>
  cancelOrder: (orderId: string) => Promise<void>
  /** Convenience accessor for the full order list (mirrors `state.orders`). */
  orders: Order[]
  /** Moves all active orders from `sourceTableIds` onto `targetTable`. Returns the number merged. */
  mergeOrders: (targetTable: Table, sourceTableIds: string[]) => Promise<number>
  /** Moves all active orders from one table to another. Returns the number transferred. */
  transferOrderTable: (sourceTableId: string, targetTable: Table) => Promise<number>
}

const OrderContext = createContext<OrderContextType | undefined>(undefined)

// Provider component
export const OrderProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(orderReducer, initialState)
  const { state: authState } = useAuth()


  // Actions
  const fetchOrders = useCallback(async () => {
    if (!authState.token) {
      return
    }
    dispatch({ type: "FETCH_ORDERS_START" })
    try {
      const response = await fetch("/api/orders", {
        headers: {
          Authorization: `Bearer ${authState.token}`,
        },
      })

      if (response.status === 401) {
        dispatch({
          type: "FETCH_ORDERS_FAILURE",
          payload: "Authentication required",
        })
        return
      }

      if (!response.ok) {
        throw new Error("Failed to fetch orders")
      }

      const data = await response.json()

      dispatch({
        type: "FETCH_ORDERS_SUCCESS",
        payload: data,
      })
    } catch (error) {
      dispatch({
        type: "FETCH_ORDERS_FAILURE",
        payload: error instanceof Error ? error.message : "Failed to fetch orders",
      })
    }
  }, [authState.token])

  // Fetch orders when component mounts and user is authenticated
  useEffect(() => {
    if (authState.isAuthenticated) {
      fetchOrders()
    }
  }, [authState.isAuthenticated, fetchOrders])

  const selectOrder = (order: Order | null) => {
    dispatch({ type: "SELECT_ORDER", payload: order })
  }

  const createOrder = async (
    items: CartItem[],
    tableId: string | null,
    customerName: string | null,
    diningMode: DiningMode,
    serverId: string,
    subtotal: number,
    tax: number,
    discount: number,
    total: number,
    notes?: string,
  ): Promise<Order> => {
    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authState.token}`,
        },
        body: JSON.stringify({
          items,
          tableId,
          customerName,
          diningMode,
          serverId,
          subtotal,
          tax,
          discount,
          total,
          notes,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to create order")
      }

      const newOrder = await response.json()

      dispatch({
        type: "CREATE_ORDER",
        payload: newOrder,
      })

      return newOrder
    } catch (error) {
      throw error instanceof Error ? error : new Error("Failed to create order")
    }
  }

  const updateOrderStatus = async (orderId: string, status: OrderStatus) => {
    try {
      const response = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authState.token}`,
        },
        body: JSON.stringify({ status }),
      })

      if (!response.ok) {
        throw new Error("Failed to update order status")
      }

      dispatch({
        type: "UPDATE_ORDER_STATUS",
        payload: { orderId, status },
      })

      return Promise.resolve()
    } catch (error) {
      return Promise.reject(error instanceof Error ? error.message : "Failed to update order status")
    }
  }

  const addPayment = async (orderId: string, payment: Payment) => {
    try {
      const response = await fetch(`/api/orders/${orderId}/payments`, {
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
        payload: { orderId, payment: newPayment },
      })

      return Promise.resolve()
    } catch (error) {
      return Promise.reject(error instanceof Error ? error.message : "Failed to add payment")
    }
  }

  const updateOrderItems = async (orderId: string, items: CartItem[]) => {
    try {
      const response = await fetch(`/api/orders/${orderId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authState.token}`,
        },
        body: JSON.stringify({ items }),
      })

      if (!response.ok) {
        throw new Error("Failed to update order items")
      }

      dispatch({
        type: "UPDATE_ORDER_ITEMS",
        payload: { orderId, items },
      })

      return Promise.resolve()
    } catch (error) {
      return Promise.reject(error instanceof Error ? error.message : "Failed to update order items")
    }
  }

  const updateOrderNotes = async (orderId: string, notes: string) => {
    try {
      const response = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authState.token}`,
        },
        body: JSON.stringify({ notes }),
      })

      if (!response.ok) {
        throw new Error("Failed to update order notes")
      }

      dispatch({
        type: "UPDATE_ORDER_NOTES",
        payload: { orderId, notes },
      })

      return Promise.resolve()
    } catch (error) {
      return Promise.reject(error instanceof Error ? error.message : "Failed to update order notes")
    }
  }

  const cancelOrder = async (orderId: string) => {
    try {
      const response = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authState.token}`,
        },
        body: JSON.stringify({ status: "cancelled" }),
      })

      if (!response.ok) {
        throw new Error("Failed to cancel order")
      }

      dispatch({
        type: "CANCEL_ORDER",
        payload: orderId,
      })

      return Promise.resolve()
    } catch (error) {
      return Promise.reject(error instanceof Error ? error.message : "Failed to cancel order")
    }
  }

  // Merge every active order sitting on `sourceTableIds` onto `targetTable`.
  // NOTE: `PATCH /api/orders/[id]` does not currently accept a `tableId` change, so
  // this reassignment is applied to local state only. When the orders endpoint gains
  // table reassignment, persist each moved order here.
  const mergeOrders = async (targetTable: Table, sourceTableIds: string[]): Promise<number> => {
    if (sourceTableIds.length === 0) return 0

    const activeStatuses: OrderStatus[] = ["pending", "preparing", "ready", "delivered"]
    const movedCount = state.orders.filter(
      (order) => order.tableId !== null && sourceTableIds.includes(order.tableId) && activeStatuses.includes(order.status),
    ).length

    if (movedCount === 0) return 0

    dispatch({
      type: "REASSIGN_ORDERS_TABLE",
      payload: {
        targetTableId: targetTable.id,
        sourceTableIds,
        targetTable,
      },
    })

    return movedCount
  }

  // Move all active orders from `sourceTableId` to `targetTable`. See mergeOrders note
  // about this being a local-state-only reassignment.
  const transferOrderTable = async (sourceTableId: string, targetTable: Table): Promise<number> =>
    mergeOrders(targetTable, [sourceTableId])

  return (
    <OrderContext.Provider
      value={{
        state,
        orders: state.orders,
        fetchOrders,
        selectOrder,
        createOrder,
        updateOrderStatus,
        addPayment,
        updateOrderItems,
        updateOrderNotes,
        cancelOrder,
        mergeOrders,
        transferOrderTable,
      }}
    >
      {children}
    </OrderContext.Provider>
  )
}

// Custom hook
export const useOrder = () => {
  const context = useContext(OrderContext)
  if (context === undefined) {
    throw new Error("useOrder must be used within an OrderProvider")
  }
  return context
}