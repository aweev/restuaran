"use client"

import type React from "react"
import { createContext, useContext, useReducer, useCallback } from "react"
import type { Ingredient } from "@/types/inventory"
import { useAuth } from "./AuthContext"

// Define the state type
interface InventoryState {
  ingredients: Ingredient[]
  loading: boolean
  error: string | null
}

// Define the action types
type InventoryAction =
  | { type: "FETCH_INVENTORY_REQUEST" }
  | { type: "FETCH_INVENTORY_SUCCESS"; payload: Ingredient[] }
  | { type: "FETCH_INVENTORY_FAILURE"; payload: string }
  | { type: "ADD_INGREDIENT"; payload: Ingredient }
  | { type: "UPDATE_INGREDIENT"; payload: Ingredient }
  | { type: "UPDATE_INGREDIENT_STOCK"; payload: { id: string; quantity: number } }
  | { type: "DELETE_INGREDIENT"; payload: string }

// Define the context type
interface InventoryContextType {
  state: InventoryState
  fetchInventory: () => Promise<void>
  addIngredient: (ingredient: Ingredient) => Promise<void>
  updateIngredient: (ingredient: Ingredient) => Promise<void>
  updateIngredientStock: (id: string, quantity: number) => Promise<void>
  deleteIngredient: (id: string) => Promise<void>
}

// Create the context
const InventoryContext = createContext<InventoryContextType | undefined>(undefined)

// Initial state
const initialState: InventoryState = {
  ingredients: [],
  loading: false,
  error: null,
}

// Reducer function
function inventoryReducer(state: InventoryState, action: InventoryAction): InventoryState {
  switch (action.type) {
    case "FETCH_INVENTORY_REQUEST":
      return {
        ...state,
        loading: true,
        error: null,
      }
    case "FETCH_INVENTORY_SUCCESS":
      return {
        ...state,
        ingredients: Array.isArray(action.payload) ? action.payload : [],
        loading: false,
      }
    case "FETCH_INVENTORY_FAILURE":
      return {
        ...state,
        loading: false,
        error: action.payload,
      }
    case "ADD_INGREDIENT":
      return {
        ...state,
        ingredients: [...state.ingredients, action.payload],
      }
    case "UPDATE_INGREDIENT":
      return {
        ...state,
        ingredients: state.ingredients.map((ingredient) =>
          ingredient.id === action.payload.id ? action.payload : ingredient,
        ),
      }
    case "UPDATE_INGREDIENT_STOCK":
      return {
        ...state,
        ingredients: state.ingredients.map((ingredient) =>
          ingredient.id === action.payload.id
            ? {
                ...ingredient,
                currentStock: ingredient.currentStock + action.payload.quantity,
                lastUpdated: new Date().toISOString(),
              }
            : ingredient,
        ),
      }
    case "DELETE_INGREDIENT":
      return {
        ...state,
        ingredients: state.ingredients.filter((ingredient) => ingredient.id !== action.payload),
      }
    default:
      return state
  }
}

// Provider component
export function InventoryProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(inventoryReducer, initialState)
  const { state: authState } = useAuth()

  // Real API calls
  const fetchInventory = useCallback(async () => {
    if (!authState.token) return

    dispatch({ type: "FETCH_INVENTORY_REQUEST" })
    try {
      const response = await fetch("/api/inventory", {
        headers: {
          Authorization: `Bearer ${authState.token}`,
        },
      })

      if (!response.ok) {
        throw new Error("Failed to fetch inventory")
      }

      const data = await response.json()

      // Transform data if needed (snake_case to camelCase)
      const ingredients = data.map((item: Record<string, unknown>) => ({
        id: item.id,
        name: item.name,
        category: item.category,
        unit: item.unit,
        currentStock: item.current_stock,
        reorderLevel: item.reorder_level,
        unitCost: item.unit_cost,
        usageLastMonth: item.usage_last_month,
        isActive: item.is_active,
        lastUpdated: item.updated_at,
      }))

      dispatch({ type: "FETCH_INVENTORY_SUCCESS", payload: ingredients })
    } catch (error) {
      console.error("Error fetching inventory:", error)
      dispatch({
        type: "FETCH_INVENTORY_FAILURE",
        payload: error instanceof Error ? error.message : "Failed to fetch inventory",
      })
    }
  }, [authState.token])

  const addIngredient = useCallback(
    async (ingredient: Ingredient) => {
      if (!authState.token) return

      try {
        const response = await fetch("/api/inventory", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authState.token}`,
          },
          body: JSON.stringify({
            name: ingredient.name,
            category: ingredient.category,
            unit: ingredient.unit,
            currentStock: ingredient.currentStock,
            reorderLevel: ingredient.reorderLevel,
            unitCost: ingredient.unitCost,
            isActive: ingredient.isActive,
          }),
        })

        if (!response.ok) {
          throw new Error("Failed to add ingredient")
        }

        const data = await response.json()

        // Transform response if needed
        const newIngredient = {
          id: data.id,
          name: data.name,
          category: data.category,
          unit: data.unit,
          currentStock: data.current_stock,
          reorderLevel: data.reorder_level,
          unitCost: data.unit_cost,
          usageLastMonth: data.usage_last_month || 0,
          isActive: data.is_active,
          lastUpdated: data.updated_at,
        }

        dispatch({ type: "ADD_INGREDIENT", payload: newIngredient })
      } catch (error) {
        console.error("Error adding ingredient:", error)
        throw error
      }
    },
    [authState.token],
  )

  const updateIngredient = useCallback(
    async (ingredient: Ingredient) => {
      if (!authState.token) return

      try {
        const response = await fetch(`/api/inventory/${ingredient.id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authState.token}`,
          },
          body: JSON.stringify({
            name: ingredient.name,
            category: ingredient.category,
            unit: ingredient.unit,
            currentStock: ingredient.currentStock,
            reorderLevel: ingredient.reorderLevel,
            unitCost: ingredient.unitCost,
            isActive: ingredient.isActive,
          }),
        })

        if (!response.ok) {
          throw new Error("Failed to update ingredient")
        }

        const data = await response.json()

        // Transform response if needed
        const updatedIngredient = {
          id: data.id,
          name: data.name,
          category: data.category,
          unit: data.unit,
          currentStock: data.current_stock,
          reorderLevel: data.reorder_level,
          unitCost: data.unit_cost,
          usageLastMonth: data.usage_last_month || ingredient.usageLastMonth || 0,
          isActive: data.is_active,
          lastUpdated: data.updated_at,
        }

        dispatch({ type: "UPDATE_INGREDIENT", payload: updatedIngredient })
      } catch (error) {
        console.error("Error updating ingredient:", error)
        throw error
      }
    },
    [authState.token],
  )

  const updateIngredientStock = useCallback(
    async (id: string, quantity: number) => {
      if (!authState.token) return

      try {
        // Get current ingredient to calculate new stock
        const ingredient = state.ingredients.find((i) => i.id === id)
        if (!ingredient) throw new Error("Ingredient not found")

        const newStock = ingredient.currentStock + quantity

        const response = await fetch(`/api/inventory/${id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authState.token}`,
          },
          body: JSON.stringify({
            currentStock: newStock,
          }),
        })

        if (!response.ok) {
          throw new Error("Failed to update ingredient stock")
        }

        dispatch({ type: "UPDATE_INGREDIENT_STOCK", payload: { id, quantity } })
      } catch (error) {
        console.error("Error updating ingredient stock:", error)
        throw error
      }
    },
    [authState.token, state.ingredients],
  )

  const deleteIngredient = useCallback(
    async (id: string) => {
      if (!authState.token) return

      try {
        const response = await fetch(`/api/inventory/${id}`, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${authState.token}`,
          },
        })

        if (!response.ok) {
          throw new Error("Failed to delete ingredient")
        }

        dispatch({ type: "DELETE_INGREDIENT", payload: id })
      } catch (error) {
        console.error("Error deleting ingredient:", error)
        throw error
      }
    },
    [authState.token],
  )

  const value = {
    state,
    fetchInventory,
    addIngredient,
    updateIngredient,
    updateIngredientStock,
    deleteIngredient,
  }

  return <InventoryContext.Provider value={value}>{children}</InventoryContext.Provider>
}

// Custom hook to use the context
export function useInventory() {
  const context = useContext(InventoryContext)
  if (context === undefined) {
    throw new Error("useInventory must be used within an InventoryProvider")
  }
  return context
}
