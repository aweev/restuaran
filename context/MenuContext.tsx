"use client"

import { createContext, useReducer, useContext, useEffect, useCallback, type ReactNode } from "react"
import type { MenuState, MenuItem, MenuCategory } from "@/types/index"
import { useAuth } from "./AuthContext"

// Initial state
const initialState: MenuState = {
  categories: [
    { id: "all", label: "All", items: 0 },
    { id: "breakfast", label: "Breakfast", items: 0 },
    { id: "soups", label: "Soups", items: 0 },
    { id: "pasta", label: "Pasta", items: 0 },
    { id: "main", label: "Main Course", items: 0 },
    { id: "burgers", label: "Burgers", items: 0 },
    { id: "desserts", label: "Desserts", items: 0 },
    { id: "drinks", label: "Drinks", items: 0 },
    { id: "sides", label: "Sides", items: 0 },
  ],
  items: [],
  loading: false,
  error: null,
  selectedCategory: "all",
}

// Action types
type MenuAction =
  | { type: "FETCH_MENU_START" }
  | { type: "FETCH_MENU_SUCCESS"; payload: MenuItem[] }
  | { type: "FETCH_MENU_FAILURE"; payload: string }
  | { type: "SET_SELECTED_CATEGORY"; payload: MenuCategory }
  | { type: "UPDATE_ITEM_AVAILABILITY"; payload: { itemId: string; available: boolean } }
  | { type: "UPDATE_ITEM"; payload: MenuItem }
  | { type: "ADD_ITEM"; payload: MenuItem }
  | { type: "DELETE_ITEM"; payload: string }

// Reducer
const menuReducer = (state: MenuState, action: MenuAction): MenuState => {
  switch (action.type) {
    case "FETCH_MENU_START":
      return {
        ...state,
        loading: true,
        error: null,
      }
    case "FETCH_MENU_SUCCESS": {
      const items = Array.isArray(action.payload) ? action.payload : []
      // Recalculate category counts
      const categories = state.categories.map((category) => ({
        ...category,
        items: category.id === "all" ? items.length : items.filter((item) => item && item.category === category.id).length,
      }))

      return {
        ...state,
        items,
        categories,
        loading: false,
      }
    }
    case "FETCH_MENU_FAILURE":
      return {
        ...state,
        loading: false,
        error: action.payload,
      }
    case "SET_SELECTED_CATEGORY":
      return {
        ...state,
        selectedCategory: action.payload,
      }
    case "UPDATE_ITEM_AVAILABILITY":
      return {
        ...state,
        items: state.items.map((item) =>
          item.id === action.payload.itemId ? { ...item, available: action.payload.available } : item,
        ),
      }
    case "UPDATE_ITEM":
      return {
        ...state,
        items: state.items.map((item) => (item.id === action.payload.id ? action.payload : item)),
      }
    case "ADD_ITEM":
      return {
        ...state,
        items: [...state.items, action.payload],
        categories: state.categories.map((category) => ({
          ...category,
          items:
            category.id === "all"
              ? state.items.length + 1
              : category.id === action.payload.category
                ? category.items + 1
                : category.items,
        })),
      }
    case "DELETE_ITEM":
      const deletedItem = state.items.find((item) => item.id === action.payload)
      return {
        ...state,
        items: state.items.filter((item) => item.id !== action.payload),
        categories: state.categories.map((category) => ({
          ...category,
          items:
            category.id === "all"
              ? state.items.length - 1
              : deletedItem && category.id === deletedItem.category
                ? category.items - 1
                : category.items,
        })),
      }
    default:
      return state
  }
}

// Create context
interface MenuContextType {
  state: MenuState
  fetchMenu: () => Promise<void>
  /** Alias of {@link MenuContextType.fetchMenu}, kept for callers using the longer name. */
  fetchMenuItems: () => Promise<void>
  setSelectedCategory: (category: MenuCategory) => void
  updateItemAvailability: (itemId: string, available: boolean) => Promise<void>
  updateItem: (item: MenuItem) => Promise<void>
  addItem: (item: MenuItem) => Promise<void>
  deleteItem: (itemId: string) => Promise<void>
}

const MenuContext = createContext<MenuContextType | undefined>(undefined)

// Provider component
export const MenuProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(menuReducer, initialState)
  const { state: authState } = useAuth()

  // Actions
  // NOTE: these must stay referentially stable. Consumers list them in useEffect
  // dependency arrays (e.g. app/dashboard/page.tsx), so an unmemoized function
  // here re-triggers their effects on every render -> infinite loop.
  const fetchMenu = useCallback(async () => {
    dispatch({ type: "FETCH_MENU_START" })
    try {
      const response = await fetch("/api/menu")

      if (!response.ok) {
        throw new Error("Failed to fetch menu items")
      }

      const data = await response.json()

      if (!Array.isArray(data)) {
        throw new Error("Received non-array data for menu items")
      }

      dispatch({
        type: "FETCH_MENU_SUCCESS",
        payload: data,
      })
    } catch (error) {
      dispatch({
        type: "FETCH_MENU_FAILURE",
        payload: error instanceof Error ? error.message : "Failed to fetch menu items",
      })
    }
  }, [])

  // Fetch menu items when component mounts. Declared after `fetchMenu` so the
  // reference is initialized before the effect closes over it.
  useEffect(() => {
    fetchMenu()
  }, [fetchMenu])

  const setSelectedCategory = useCallback((category: MenuCategory) => {
    dispatch({ type: "SET_SELECTED_CATEGORY", payload: category })
  }, [])

  const updateItemAvailability = async (itemId: string, available: boolean) => {
    try {
      const response = await fetch(`/api/menu/${itemId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authState.token}`,
        },
        body: JSON.stringify({ available }),
      })

      if (!response.ok) {
        throw new Error("Failed to update item availability")
      }

      dispatch({
        type: "UPDATE_ITEM_AVAILABILITY",
        payload: { itemId, available },
      })

      return Promise.resolve()
    } catch (error) {
      return Promise.reject(error instanceof Error ? error.message : "Failed to update item availability")
    }
  }

  const updateItem = async (item: MenuItem) => {
    try {
      const response = await fetch(`/api/menu/${item.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authState.token}`,
        },
        body: JSON.stringify(item),
      })

      if (!response.ok) {
        throw new Error("Failed to update menu item")
      }

      const updatedItem = await response.json()

      dispatch({
        type: "UPDATE_ITEM",
        payload: updatedItem,
      })

      return Promise.resolve()
    } catch (error) {
      return Promise.reject(error instanceof Error ? error.message : "Failed to update menu item")
    }
  }

  const addItem = async (item: MenuItem) => {
    try {
      const response = await fetch("/api/menu", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authState.token}`,
        },
        body: JSON.stringify(item),
      })

      if (!response.ok) {
        throw new Error("Failed to add menu item")
      }

      const newItem = await response.json()

      dispatch({
        type: "ADD_ITEM",
        payload: newItem,
      })

      return Promise.resolve()
    } catch (error) {
      return Promise.reject(error instanceof Error ? error.message : "Failed to add menu item")
    }
  }

  const deleteItem = async (itemId: string) => {
    try {
      const response = await fetch(`/api/menu/${itemId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${authState.token}`,
        },
      })

      if (!response.ok) {
        throw new Error("Failed to delete menu item")
      }

      dispatch({
        type: "DELETE_ITEM",
        payload: itemId,
      })

      return Promise.resolve()
    } catch (error) {
      return Promise.reject(error instanceof Error ? error.message : "Failed to delete menu item")
    }
  }

  return (
    <MenuContext.Provider
      value={{
        state,
        fetchMenu,
        fetchMenuItems: fetchMenu,
        setSelectedCategory,
        updateItemAvailability,
        updateItem,
        addItem,
        deleteItem,
      }}
    >
      {children}
    </MenuContext.Provider>
  )
}

// Custom hook
export const useMenu = () => {
  const context = useContext(MenuContext)
  if (context === undefined) {
    throw new Error("useMenu must be used within a MenuProvider")
  }
  return context
}
