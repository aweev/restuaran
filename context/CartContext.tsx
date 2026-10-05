"use client"

import { createContext, useContext, useEffect, useCallback, useMemo, useState, type ReactNode } from "react"
import { useAuth } from "./AuthContext"
import { useCommand, useKernel } from "@/kernel/react/kernel-provider"
import { useFeedback, notifyWithActions, recoveryActionsFor } from "@/lib/feedback"
import { useAttentionOptional } from "@/context/AttentionContext"
import type { CartState, CartItem, MenuItem, DiningMode, CartModifierSelection } from "@/types"
import { newRequestId } from "@/kernel/react/kernel-provider"

interface CartContextType {
  state: CartState
  isCreating: boolean
  draftOrderId: string | null
  addItem: (
    menuItem: MenuItem,
    quantity: number,
    modifiers: CartModifierSelection[],
    specialInstructions?: string,
  ) => Promise<void>
  removeItem: (id: string) => Promise<void>
  updateQuantity: (id: string, quantity: number) => Promise<void>
  clearCart: () => Promise<void>
  setTable: (tableId: string, customerName?: string) => Promise<void>
  setDiningMode: (mode: DiningMode) => Promise<void>
  applyDiscount: (amount: number, code?: string) => Promise<void>
  removeDiscount: () => Promise<void>
  updateItemModifiers: (id: string, modifiers: CartModifierSelection[]) => Promise<void>
  updateSpecialInstructions: (id: string, instructions: string) => Promise<void>
  submitOrder: (serverId: string) => Promise<string>
  syncFromStorage: () => Promise<void>
}

const CartContext = createContext<CartContextType | undefined>(undefined)

const calculateItemTotalPrice = (
  basePrice: number,
  quantity: number,
  modifiers: CartModifierSelection[],
  menuItem: MenuItem,
): number => {
  let modifierPrice = 0

  modifiers.forEach((selection) => {
    const itemModifier = menuItem.modifiers?.find((m) => m.id === selection.modifierId)
    if (itemModifier) {
      selection.optionIds.forEach((optionId) => {
        const option = itemModifier.options.find((o) => o.id === optionId)
        if (option) {
          modifierPrice += option.price
        }
      })
    }
  })

  return (basePrice + modifierPrice) * quantity
}

const recalculateCartTotals = (
  items: CartItem[],
  discount: number,
): { subtotal: number; total: number } => {
  const subtotal = items.reduce((sum, item) => sum + item.totalPrice, 0)
  const total = subtotal - discount

  return { subtotal, total }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const { state: authState } = useAuth()
  const { run } = useCommand()
  const { connection, pendingCount } = useKernel()
  const { notify } = useFeedback()
  const attention = useAttentionOptional()

  const reject = (title: string, err?: { message?: string; code?: string }) => {
    const actions = recoveryActionsFor(err?.code);
    attention?.push({ title, message: err?.message, code: err?.code, href: "/dashboard/orders" });
    if (actions.length > 0) notifyWithActions(title, err?.message, actions);
    else notify("error", title, err?.message);
  };

  const [state, setState] = useState<CartState>({
    items: [],
    tableId: null,
    customerName: null,
    diningMode: "Dine in",
    subtotal: 0,
    total: 0,
    discount: 0,
  })
  const [draftOrderId, setDraftOrderId] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)

  // Load from localStorage on mount (for offline-first draft orders)
  useEffect(() => {
    const loadCartState = async () => {
      try {
        const storedCart = localStorage.getItem("posCart")
        if (storedCart) {
          const cartData = JSON.parse(storedCart)
          if (cartData.items?.length > 0) {
            setState({
              items: cartData.items,
              tableId: cartData.tableId,
              customerName: cartData.customerName,
              diningMode: cartData.diningMode ?? "Dine in",
              discount: cartData.discount ?? 0,
              discountCode: cartData.discountCode,
              ...recalculateCartTotals(cartData.items, cartData.discount ?? 0),
            })
            if (cartData.draftOrderId) {
              setDraftOrderId(cartData.draftOrderId)
            }
          }
        }
      } catch (error) {
        console.error("Error loading cart state:", error)
      }
    }
    loadCartState()
  }, [])

  // Save to localStorage for offline support
  useEffect(() => {
    localStorage.setItem("posCart", JSON.stringify({
      ...state,
      draftOrderId,
    }))
  }, [state, draftOrderId])

  const ensureDraftOrder = useCallback(async (): Promise<string> => {
    if (draftOrderId) return draftOrderId

    if (!authState.user) throw new Error("No user logged in")
    if (isCreating) {
      // Wait for existing creation
      for (let i = 0; i < 50; i++) {
        await new Promise(r => setTimeout(r, 100))
        if (draftOrderId) return draftOrderId
      }
    }

    setIsCreating(true)
    try {
      const orderId = newRequestId()
      const channel = state.diningMode === "Dine in" ? "pos" :
        state.diningMode === "Take Away" ? "takeaway" : "delivery"

      const result = await run("order.create", {
        orderId,
        channel,
        tableId: state.tableId ?? undefined,
        serverId: authState.user.id,
        dinerName: state.customerName ?? undefined,
      })

      if (!result.success) {
        throw new Error(result.error?.message ?? "Failed to create draft order")
      }

      setDraftOrderId(orderId)
      return orderId
    } finally {
      setIsCreating(false)
    }
  }, [draftOrderId, authState.user, state.tableId, state.customerName, state.diningMode, isCreating, run])

  const addItem = useCallback(async (
    menuItem: MenuItem,
    quantity: number,
    modifiers: CartModifierSelection[],
    specialInstructions?: string,
  ) => {
    const orderId = await ensureDraftOrder()

    // Optimistic update
    const existingIndex = state.items.findIndex(item =>
      item.menuItemId === menuItem.id &&
      item.modifiers?.length === modifiers.length &&
      item.modifiers?.every((m, i) =>
        m.modifierId === modifiers[i]?.modifierId &&
        [...m.optionIds].sort().join() === [...(modifiers[i]?.optionIds ?? [])].sort().join()
      )
    )

    const newItem: CartItem = {
      id: existingIndex >= 0 ? state.items[existingIndex].id : newRequestId(),
      menuItemId: menuItem.id,
      title: menuItem.title,
      price: menuItem.price,
      quantity: existingIndex >= 0 ? state.items[existingIndex].quantity + quantity : quantity,
      image: menuItem.image,
      type: menuItem.type,
      modifiers,
      specialInstructions,
      totalPrice: calculateItemTotalPrice(menuItem.price,
        existingIndex >= 0 ? state.items[existingIndex].quantity + quantity : quantity,
        modifiers, menuItem),
    }

    // Optimistic UI update
    setState(prev => {
      const items = existingIndex >= 0
        ? prev.items.map((item, i) => i === existingIndex ? newItem : item)
        : [...prev.items, newItem]
      return { ...prev, items, ...recalculateCartTotals(items, prev.discount) }
    })

     // Send to kernel (queued if offline)
    try {
      const result = await run("order.addLine", {
        orderId,
        menuItemId: menuItem.id,
        name: menuItem.title,
        unitPrice: menuItem.price,
        quantity,
        modifiers: modifiers.map(m => ({ name: m.modifierId, price: 0 })),
        course: 1,
      })

      if (!result.success) {
        reject("Could not add item", result.error);
        throw new Error(result.error?.message ?? "Failed to add item")
      }
    } catch (error) {
      // Rollback on failure. A queued (offline) command returns success
      // without throwing, so it never reaches here — but guard defensively
      // in case the result shape changes.
      const isQueued =
        error &&
        typeof error === "object" &&
        "success" in error &&
        (error as { success: boolean }).success === true &&
        "queued" in error
      if (!isQueued) {
        setState(prev => {
          const items = existingIndex >= 0
            ? prev.items.map((item, i) => i === existingIndex ? prev.items[existingIndex] : item)
            : prev.items.slice(0, -1)
          return { ...prev, items, ...recalculateCartTotals(items, prev.discount) }
        })
        if (error instanceof Error && error.message !== "Failed to add item") reject("Could not add item", { message: error.message });
      }
      throw error
    }
  }, [state.items, state.tableId, state.customerName, state.diningMode, authState.user, run, ensureDraftOrder, notify])

  const removeItem = useCallback(async (id: string) => {
    if (!draftOrderId) return

    const item = state.items.find(i => i.id === id)
    if (!item) return

    // Optimistic update
    const previousItems = state.items
    setState(prev => {
      const items = prev.items.filter(i => i.id !== id)
      return { ...prev, items, ...recalculateCartTotals(items, prev.discount) }
    })

    try {
      const result = await run("order.voidLine", {
        orderId: draftOrderId,
        lineId: id,
        reason: "removed from cart",
      })

      if (!result.success && result.error?.code !== "AGGREGATE_NOT_FOUND" && result.error?.code !== "FORBIDDEN") {
        reject("Could not remove item", result.error);
        throw new Error(result.error?.message ?? "Failed to remove item")
      }
      if (!result.success && result.error?.code === "FORBIDDEN") {
        reject("Could not remove item", result.error);
      }
    } catch (error) {
      // Rollback
      setState(prev => ({ ...prev, items: previousItems, ...recalculateCartTotals(previousItems, prev.discount) }))
      if (error instanceof Error && error.message !== "Failed to remove item") reject("Could not remove item", { message: error.message });
      throw error
    }
  }, [draftOrderId, state.items, run, notify])

  const updateQuantity = useCallback(async (id: string, quantity: number) => {
    if (!draftOrderId || quantity <= 0) {
      if (quantity <= 0) await removeItem(id)
      return
    }

    const item = state.items.find(i => i.id === id)
    if (!item) return

    const previousItems = state.items
    setState(prev => {
      const items = prev.items.map(i =>
        i.id === id ? { ...i, quantity, totalPrice: i.price * quantity + (i.totalPrice / i.quantity - i.price) * quantity } : i
      )
      return { ...prev, items, ...recalculateCartTotals(items, prev.discount) }
    })

    // For kernel, we need to void and re-add (no direct update command)
    try {
      await run("order.voidLine", { orderId: draftOrderId, lineId: id, reason: "quantity changed" })
      await run("order.addLine", {
        orderId: draftOrderId,
        menuItemId: item.menuItemId,
        name: item.title,
        unitPrice: item.price,
        quantity,
        modifiers: item.modifiers?.map(m => ({ name: m.modifierId, price: 0 })) ?? [],
        course: 1,
      })
    } catch (error) {
      setState(prev => ({ ...prev, items: previousItems, ...recalculateCartTotals(previousItems, prev.discount) }))
      reject("Could not update quantity", { message: error instanceof Error ? error.message : undefined });
      throw error
    }
  }, [draftOrderId, state.items, run, removeItem, notify, attention])

  const clearCart = useCallback(async () => {
    if (draftOrderId) {
      try {
        await run("order.void", { orderId: draftOrderId, reason: "cart cleared" })
      } catch {
        // Ignore errors on void
      }
    }
    setState({
      items: [],
      tableId: state.tableId,
      customerName: state.customerName,
      diningMode: state.diningMode,
      subtotal: 0,
      total: 0,
      discount: 0,
    })
    setDraftOrderId(null)
  }, [draftOrderId, state.tableId, state.customerName, state.diningMode, run])

  const setTable = useCallback(async (tableId: string, customerName?: string) => {
    setState(prev => ({ ...prev, tableId, customerName: customerName ?? prev.customerName }))
    if (draftOrderId) {
      try {
        await run("order.setTable", { orderId: draftOrderId, tableId })
      } catch {
        // Ignore - will be synced on submit
      }
    }
  }, [draftOrderId, run])

  const setDiningMode = useCallback(async (mode: DiningMode) => {
    setState(prev => ({ ...prev, diningMode: mode }))
    if (draftOrderId) {
      // No direct kernel command for channel change - will be reflected on submit
    }
  }, [draftOrderId])

  const applyDiscount = useCallback(async (amount: number, code?: string) => {
    if (!draftOrderId) {
      setState(prev => {
        const total = prev.subtotal - amount
        return { ...prev, discount: amount, discountCode: code, total }
      })
      return
    }

    const previousDiscount = state.discount
    setState(prev => {
      const total = prev.subtotal - amount
      return { ...prev, discount: amount, discountCode: code, total }
    })

    try {
      const result = await run("order.applyDiscount", {
        orderId: draftOrderId,
        kind: "amount",
        value: amount,
        label: code,
      })
      if (!result.success && result.error?.code !== "AGGREGATE_NOT_FOUND" && result.error?.code !== "FORBIDDEN") {
        reject("Could not apply discount", result.error);
        throw new Error(result.error?.message ?? "Failed to apply discount")
      }
      if (!result.success) reject("Could not apply discount", result.error);
    } catch (error) {
      setState(prev => {
        const total = prev.subtotal - previousDiscount
        return { ...prev, discount: previousDiscount, discountCode: undefined, total }
      })
      if (error instanceof Error && error.message !== "Failed to apply discount") reject("Could not apply discount", { message: error.message });
      throw error
    }
  }, [draftOrderId, state.discount, run, notify, attention])

  const removeDiscount = useCallback(async () => {
    if (!draftOrderId) {
      setState(prev => {
        const total = prev.subtotal
        return { ...prev, discount: 0, discountCode: undefined, total }
      })
      return
    }

    const previousDiscount = state.discount
    setState(prev => {
      const total = prev.subtotal
      return { ...prev, discount: 0, discountCode: undefined, total }
    })

    // No direct remove discount command - apply 0 amount
    try {
      await run("order.applyDiscount", { orderId: draftOrderId, kind: "amount", value: 0 })
    } catch (error) {
      setState(prev => {
        const total = prev.subtotal - previousDiscount
        return { ...prev, discount: previousDiscount, total }
      })
      reject("Could not remove discount", { message: error instanceof Error ? error.message : undefined });
      throw error
    }
  }, [draftOrderId, state.discount, run, notify, attention])

  const updateItemModifiers = useCallback(async (id: string, modifiers: CartModifierSelection[]) => {
    // Similar to updateQuantity - void and re-add
    const item = state.items.find(i => i.id === id)
    if (!item || !draftOrderId) return

    const previousItems = state.items
    setState(prev => {
      const items = prev.items.map(i =>
        i.id === id ? { ...i, modifiers } : i
      )
      return { ...prev, items }
    })

    try {
      await run("order.voidLine", { orderId: draftOrderId, lineId: id, reason: "modifiers changed" })
      await run("order.addLine", {
        orderId: draftOrderId,
        menuItemId: item.menuItemId,
        name: item.title,
        unitPrice: item.price,
        quantity: item.quantity,
        modifiers: modifiers.map(m => ({ name: m.modifierId, price: 0 })),
        course: 1,
      })
    } catch (error) {
      setState(prev => ({ ...prev, items: previousItems }))
      reject("Could not update modifiers", { message: error instanceof Error ? error.message : undefined });
      throw error
    }
  }, [draftOrderId, state.items, run, notify, attention])

  const updateSpecialInstructions = useCallback(async (id: string, instructions: string) => {
    setState(prev => ({
      ...prev,
      items: prev.items.map(i => i.id === id ? { ...i, specialInstructions: instructions } : i),
    }))
    // No kernel command for this - stored locally
  }, [])

  const submitOrder = useCallback(async (serverId: string): Promise<string> => {
    if (!draftOrderId || state.items.length === 0) {
      throw new Error("No items in cart")
    }

    // Server-authoritative tax: stamp the venue rate onto the order event log
    // before firing, so the receipt total cannot drift from venue config.
    try {
      // Tax rate is stored on the venue aggregate; applyTax command reads it
      const taxRes = await run("order.applyTax", { orderId: draftOrderId })
      if (!taxRes.success && taxRes.error?.code !== "FORBIDDEN") {
        reject("Could not apply tax", taxRes.error)
      }
      const res = await run("order.sendToKitchen", { orderId: draftOrderId })
      if (!res.success) { reject("Failed to send to kitchen", res.error); throw new Error(res.error?.message ?? "Failed to send to kitchen"); }
      notify("success", "Order sent to kitchen")
    } catch (error) {
      if (error instanceof Error && error.message !== "Failed to send to kitchen") reject("Failed to send to kitchen", { message: error.message });
      throw error
    }

    const submittedOrderId = draftOrderId
    setState(prev => ({ ...prev, items: [], subtotal: 0, total: 0, discount: 0 }))
    setDraftOrderId(null)
    return submittedOrderId
  }, [draftOrderId, state.items.length, run, notify])

  const syncFromStorage = useCallback(async () => {
    // Trigger re-hydration from localStorage
    const storedCart = localStorage.getItem("posCart")
    if (storedCart) {
      try {
        const cartData = JSON.parse(storedCart)
        if (cartData.items?.length > 0) {
          setState({
            items: cartData.items,
            tableId: cartData.tableId,
            customerName: cartData.customerName,
            diningMode: cartData.diningMode ?? "Dine in",
            discount: cartData.discount ?? 0,
            discountCode: cartData.discountCode,
            ...recalculateCartTotals(cartData.items, cartData.discount ?? 0),
          })
          if (cartData.draftOrderId) {
            setDraftOrderId(cartData.draftOrderId)
          }
        }
      } catch (error) {
        console.error("Error syncing cart:", error)
      }
    }
  }, [])

  const contextValue = useMemo<CartContextType>(() => ({
    state,
    isCreating,
    draftOrderId,
    addItem,
    removeItem,
    updateQuantity,
    clearCart,
    setTable,
    setDiningMode,
    applyDiscount,
    removeDiscount,
    updateItemModifiers,
    updateSpecialInstructions,
    submitOrder,
    syncFromStorage,
  }), [
    state,
    isCreating,
    draftOrderId,
    addItem,
    removeItem,
    updateQuantity,
    clearCart,
    setTable,
    setDiningMode,
    applyDiscount,
    removeDiscount,
    updateItemModifiers,
    updateSpecialInstructions,
    submitOrder,
    syncFromStorage,
  ])

  return (
    <CartContext.Provider value={contextValue}>
      {children}
    </CartContext.Provider>
  )
}

// Custom hook
export const useCart = () => {
  const context = useContext(CartContext)
  if (context === undefined) {
    throw new Error("useCart must be used within a CartProvider")
  }
  return context
}