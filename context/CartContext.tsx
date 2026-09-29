"use client"

import { createContext, useReducer, useContext, useEffect, type ReactNode } from "react"
import type { CartState, CartItem, MenuItem, DiningMode, CartModifierSelection } from "@/types"

// Initial state
const initialState: CartState = {
  items: [],
  tableId: null,
  customerName: null,
  diningMode: "Dine in",
  subtotal: 0,
  tax: 0,
  total: 0,
  discount: 0,
}

// Action types
type CartAction =
  | {
      type: "ADD_ITEM"
      payload: {
        menuItem: MenuItem
        quantity: number
        modifiers: CartModifierSelection[]
        specialInstructions?: string
      }
    }
  | { type: "REMOVE_ITEM"; payload: string }
  | { type: "UPDATE_QUANTITY"; payload: { id: string; quantity: number } }
  | { type: "CLEAR_CART" }
  | { type: "SET_TABLE"; payload: { tableId: string; customerName?: string } }
  | { type: "SET_DINING_MODE"; payload: DiningMode }
  | { type: "APPLY_DISCOUNT"; payload: { amount: number; code?: string } }
  | { type: "REMOVE_DISCOUNT" }
  | { type: "UPDATE_ITEM_MODIFIERS"; payload: { id: string; modifiers: CartModifierSelection[] } }
  | { type: "UPDATE_SPECIAL_INSTRUCTIONS"; payload: { id: string; instructions: string } }

// Helper function to calculate item price with modifiers
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

// Helper function to recalculate cart totals
const recalculateCartTotals = (
  items: CartItem[],
  discount: number,
): { subtotal: number; tax: number; total: number } => {
  const subtotal = items.reduce((sum, item) => sum + item.totalPrice, 0)
  const taxRate = 0.05 // 5% tax rate
  const tax = subtotal * taxRate
  const total = subtotal + tax - discount

  return { subtotal, tax, total }
}

// Reducer
const cartReducer = (state: CartState, action: CartAction): CartState => {
  switch (action.type) {
    case "ADD_ITEM": {
      const { menuItem, quantity, modifiers, specialInstructions } = action.payload

      // Calculate total price including modifiers
      const totalPrice = calculateItemTotalPrice(menuItem.price, quantity, modifiers, menuItem)

      // Check if item with same modifiers already exists
      const existingItemIndex = state.items.findIndex((item) => {
        if (item.menuItemId !== menuItem.id) return false

        // Check if modifiers match
        if (item.modifiers?.length !== modifiers.length) return false

        // Deep comparison of modifiers
        const modifiersMatch = item.modifiers.every((itemMod) => {
          const matchingMod = modifiers.find((m) => m.modifierId === itemMod.modifierId)
          if (!matchingMod) return false

          // Compare option IDs (order doesn't matter)
          const itemOptions = [...itemMod.optionIds].sort()
          const newOptions = [...matchingMod.optionIds].sort()

          return itemOptions.length === newOptions.length && itemOptions.every((opt, i) => opt === newOptions[i])
        })

        return modifiersMatch
      })

      let updatedItems: CartItem[]

      if (existingItemIndex >= 0) {
        // Update existing item quantity
        updatedItems = state.items.map((item, index) => {
          if (index === existingItemIndex) {
            const newQuantity = item.quantity + quantity
            const newTotalPrice = calculateItemTotalPrice(menuItem.price, newQuantity, modifiers, menuItem)
            return { ...item, quantity: newQuantity, totalPrice: newTotalPrice }
          }
          return item
        })
      } else {
        // Add new item
        const newItem: CartItem = {
          id: Date.now().toString(),
          menuItemId: menuItem.id,
          title: menuItem.title,
          price: menuItem.price,
          quantity,
          image: menuItem.image,
          type: menuItem.type,
          modifiers,
          specialInstructions,
          totalPrice,
        }

        updatedItems = [...state.items, newItem]
      }

      // Recalculate totals
      const { subtotal, tax, total } = recalculateCartTotals(updatedItems, state.discount)

      return {
        ...state,
        items: updatedItems,
        subtotal,
        tax,
        total,
      }
    }

    case "REMOVE_ITEM": {
      const updatedItems = state.items.filter((item) => item.id !== action.payload)
      const { subtotal, tax, total } = recalculateCartTotals(updatedItems, state.discount)

      return {
        ...state,
        items: updatedItems,
        subtotal,
        tax,
        total,
      }
    }

    case "UPDATE_QUANTITY": {
      const { id, quantity } = action.payload

      if (quantity <= 0) {
        // If quantity is 0 or negative, remove the item
        return cartReducer(state, { type: "REMOVE_ITEM", payload: id })
      }

      const updatedItems = state.items.map((item) => {
        if (item.id === id) {
          // Recalculate total price based on new quantity
          const totalPrice = item.price * quantity + (item.totalPrice / item.quantity - item.price) * quantity

          return { ...item, quantity, totalPrice }
        }
        return item
      })

      const { subtotal, tax, total } = recalculateCartTotals(updatedItems, state.discount)

      return {
        ...state,
        items: updatedItems,
        subtotal,
        tax,
        total,
      }
    }

    case "CLEAR_CART":
      return {
        ...initialState,
        tableId: state.tableId,
        customerName: state.customerName,
        diningMode: state.diningMode,
      }

    case "SET_TABLE":
      return {
        ...state,
        tableId: action.payload.tableId,
        customerName: action.payload.customerName || state.customerName,
      }

    case "SET_DINING_MODE":
      return {
        ...state,
        diningMode: action.payload,
      }

    case "APPLY_DISCOUNT": {
      const { amount, code } = action.payload
      const total = state.subtotal + state.tax - amount

      return {
        ...state,
        discount: amount,
        discountCode: code,
        total,
      }
    }

    case "REMOVE_DISCOUNT": {
      const total = state.subtotal + state.tax

      return {
        ...state,
        discount: 0,
        discountCode: undefined,
        total,
      }
    }

    case "UPDATE_ITEM_MODIFIERS": {
      const { id, modifiers } = action.payload

      const updatedItems = state.items.map((item) => {
        if (item.id === id) {
          // In a real app, you'd probably need to fetch the menu item from MenuContext.
          // Price recalculation needs the full menu item, which we don't have here yet.
          // This is a simplified calculation; a real implementation should pass the full
          // menu item or resolve it through a context.
          const totalPrice = item.totalPrice // This would need proper recalculation

          return { ...item, modifiers, totalPrice }
        }
        return item
      })

      const { subtotal, tax, total } = recalculateCartTotals(updatedItems, state.discount)

      return {
        ...state,
        items: updatedItems,
        subtotal,
        tax,
        total,
      }
    }

    case "UPDATE_SPECIAL_INSTRUCTIONS": {
      const { id, instructions } = action.payload

      const updatedItems = state.items.map((item) => {
        if (item.id === id) {
          return { ...item, specialInstructions: instructions }
        }
        return item
      })

      return {
        ...state,
        items: updatedItems,
      }
    }

    default:
      return state
  }
}

// Create context
interface CartContextType {
  state: CartState
  addItem: (
    menuItem: MenuItem,
    quantity: number,
    modifiers: CartModifierSelection[],
    specialInstructions?: string,
  ) => void
  removeItem: (id: string) => void
  updateQuantity: (id: string, quantity: number) => void
  clearCart: () => void
  setTable: (tableId: string, customerName?: string) => void
  setDiningMode: (mode: DiningMode) => void
  applyDiscount: (amount: number, code?: string) => void
  removeDiscount: () => void
  updateItemModifiers: (id: string, modifiers: CartModifierSelection[]) => void
  updateSpecialInstructions: (id: string, instructions: string) => void
}

const CartContext = createContext<CartContextType | undefined>(undefined)

// Provider component
export const CartProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(cartReducer, initialState)

  // Load from localStorage on initial render
  useEffect(() => {
    const loadCartState = () => {
      try {
        const storedCart = localStorage.getItem("posCart")

        if (storedCart) {
          const cartData = JSON.parse(storedCart)
          // We need to manually dispatch each action to properly calculate totals

          // First set the table and dining mode
          if (cartData.tableId) {
            dispatch({ 
              type: 'SET_TABLE', 
              payload: { 
                tableId: cartData.tableId,
    customerName: cartData.customerName
  }
});
          }

          if (cartData.diningMode) {
            dispatch({
              type: "SET_DINING_MODE",
              payload: cartData.diningMode,
            })
          }

          // Then add each item
          if (cartData.items && Array.isArray(cartData.items)) {
            cartData.items.forEach((item: CartItem) => {
              // We need to reconstruct the menu item from the cart item
              // In a real app, you'd probably fetch this from the MenuContext
              const menuItem: MenuItem = {
                id: item.menuItemId,
                title: item.title,
                description: "",
                price: item.price,
                image: item.image || "",
                category: "all", // Default category
                type: item.type,
                available: true,
              }

              dispatch({
                type: "ADD_ITEM",
                payload: {
                  menuItem,
                  quantity: item.quantity,
                  modifiers: item.modifiers || [],
                  specialInstructions: item.specialInstructions,
                },
              })
            })
          }

          // Apply discount if any
          if (cartData.discount && cartData.discount > 0) {
            dispatch({
              type: "APPLY_DISCOUNT",
              payload: {
                amount: cartData.discount,
                code: cartData.discountCode,
              },
            })
          }
        }
      } catch (error) {
        console.error("Error loading cart state from localStorage", error)
      }
    }

    loadCartState()
  }, [])

  // Save to localStorage whenever state changes
  useEffect(() => {
    localStorage.setItem("posCart", JSON.stringify(state))
  }, [state])

  // Actions
  const addItem = (
    menuItem: MenuItem,
    quantity: number,
    modifiers: CartModifierSelection[],
    specialInstructions?: string,
  ) => {
    dispatch({
      type: "ADD_ITEM",
      payload: { menuItem, quantity, modifiers, specialInstructions },
    })
  }

  const removeItem = (id: string) => {
    dispatch({ type: "REMOVE_ITEM", payload: id })
  }

  const updateQuantity = (id: string, quantity: number) => {
    dispatch({ type: "UPDATE_QUANTITY", payload: { id, quantity } })
  }

  const clearCart = () => {
    dispatch({ type: "CLEAR_CART" })
  }

  const setTable = (tableId: string, customerName?: string) => {
    dispatch({ type: "SET_TABLE", payload: { tableId, customerName } })
  }

  const setDiningMode = (mode: DiningMode) => {
    dispatch({ type: "SET_DINING_MODE", payload: mode })
  }

  const applyDiscount = (amount: number, code?: string) => {
    dispatch({ type: "APPLY_DISCOUNT", payload: { amount, code } })
  }

  const removeDiscount = () => {
    dispatch({ type: "REMOVE_DISCOUNT" })
  }

  const updateItemModifiers = (id: string, modifiers: CartModifierSelection[]) => {
    dispatch({ type: "UPDATE_ITEM_MODIFIERS", payload: { id, modifiers } })
  }

  const updateSpecialInstructions = (id: string, instructions: string) => {
    dispatch({
      type: "UPDATE_SPECIAL_INSTRUCTIONS",
      payload: { id, instructions },
    })
  }

  return (
    <CartContext.Provider
      value={{
        state,
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
      }}
    >
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
