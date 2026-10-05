"use client"

import { createContext, useContext, useMemo, useState, type ReactNode } from "react"
import type { MenuState, MenuItem, MenuCategory } from "@/types/index"
import { useCommand, useProjection } from "@/kernel/react/kernel-provider"
import type { MenuBoardState } from "@/kernel/modules/menu.module"
import { menuRowsToMenuItems } from "@/lib/kernel-mappers"
import { useFeedback, notifyWithActions, recoveryActionsFor } from "@/lib/feedback"
import { useAttentionOptional } from "@/context/AttentionContext"

interface MenuContextType {
  state: MenuState
  items: MenuItem[]
  loading: boolean
  error: string | null
  selectedCategory: MenuCategory
  fetchMenu: () => Promise<void>
  fetchMenuItems: () => Promise<void>
  setSelectedCategory: (category: MenuCategory) => void
  updateItemAvailability: (itemId: string, available: boolean) => Promise<void>
  updateItem: (item: MenuItem) => Promise<void>
  addItem: (item: MenuItem) => Promise<void>
  deleteItem: (itemId: string) => Promise<void>
  setRecipe: (itemId: string, recipe: Array<{ inventoryItemId: string; qty: number }>) => Promise<void>
}

const MenuContext = createContext<MenuContextType | undefined>(undefined)

/**
 * Menu, backed entirely by the event store.
 *
 * Reads come from the `menu.board` projection (sellability source of truth:
 * price, 86'd, availability). Writes go through kernel commands
 * (`menu.createItem`, `menu.changePrice`, `menu.setAvailability`,
 * `menu.eightySix`/`clearEightySix`, `menu.updateItem`), so the cross-module
 * 86'd policy applies.
 *
 * The public interface is unchanged, so every consumer keeps working.
 */
export const MenuProvider = ({ children }: { children: ReactNode }) => {
  const { state: board } = useProjection<MenuBoardState>("menu.board", 3000)
  const { run } = useCommand()
  const { notify } = useFeedback()
  const attention = useAttentionOptional()
  const [selectedCategory, setSelectedCategory] = useState<MenuCategory>("all")

  const reject = (title: string, err?: { message?: string; code?: string }) => {
    const actions = recoveryActionsFor(err?.code);
    attention?.push({ title, message: err?.message, code: err?.code, href: "/dashboard/menu" });
    if (actions.length > 0) notifyWithActions(title, err?.message, actions);
    else notify("error", title, err?.message);
  };

  const kernelItems = useMemo(() => menuRowsToMenuItems(board?.items ?? []), [board])

  const state = useMemo(() => ({
    items: kernelItems,
    loading: board === null,
    error: null,
    selectedCategory,
    categories: useMemo(() => {
      const items = kernelItems
      return [
        { id: "all", label: "All", items: items.length },
        { id: "breakfast", label: "Breakfast", items: items.filter((i) => i.category === "breakfast").length },
        { id: "soups", label: "Soups", items: items.filter((i) => i.category === "soups").length },
        { id: "pasta", label: "Pasta", items: items.filter((i) => i.category === "pasta").length },
        { id: "main", label: "Main Course", items: items.filter((i) => i.category === "main").length },
        { id: "burgers", label: "Burgers", items: items.filter((i) => i.category === "burgers").length },
        { id: "desserts", label: "Desserts", items: items.filter((i) => i.category === "desserts").length },
        { id: "drinks", label: "Drinks", items: items.filter((i) => i.category === "drinks").length },
        { id: "sides", label: "Sides", items: items.filter((i) => i.category === "sides").length },
      ] as MenuState["categories"]
    }, [kernelItems]),
  }), [kernelItems, board, selectedCategory])

  const fetchMenu = async () => {
    // No-op: projection refreshes automatically
  }

  const api = useMemo<MenuContextType>(
    () => ({
      state,
      items: state.items,
      loading: state.loading,
      error: state.error,
      selectedCategory: state.selectedCategory,
      categories: state.categories,
      fetchMenu,
      fetchMenuItems: fetchMenu,
      setSelectedCategory,

      updateItemAvailability: async (itemId: string, available: boolean) => {
        try {
          const commandType = available ? "menu.clearEightySix" : "menu.eightySix"
          const result = await run(commandType, available ? { itemId } : { itemId, reason: "86'd from POS" })
          if (!result.success) { reject("Menu update failed", result.error); throw new Error(result.error?.message ?? "Menu update rejected"); }
          notify("success", available ? "Item back on sale" : "Item 86'd")
          return Promise.resolve()
        } catch (error) {
          return Promise.reject(error instanceof Error ? error.message : "Failed to update item availability")
        }
      },

      updateItem: async (item: MenuItem) => {
        try {
          const priceResult = await run("menu.changePrice", { itemId: item.id, price: item.price })
          if (!priceResult.success) { reject("Menu update failed", priceResult.error); throw new Error(priceResult.error?.message ?? "Price update rejected"); }
          const availResult = await run("menu.setAvailability", { itemId: item.id, available: item.available })
          if (!availResult.success) { reject("Menu update failed", availResult.error); throw new Error(availResult.error?.message ?? "Availability update rejected"); }
          const presResult = await run("menu.updateItem", {
            itemId: item.id,
            description: item.description,
            image: item.image,
            prepMinutes: item.preparationTime,
          })
          if (!presResult.success) { reject("Menu update failed", presResult.error); throw new Error(presResult.error?.message ?? "Menu update rejected"); }
          notify("success", "Menu item updated")
          return Promise.resolve()
        } catch (error) {
          return Promise.reject(error instanceof Error ? error.message : "Failed to update menu item")
        }
      },

      addItem: async (item: MenuItem) => {
        try {
          const result = await run("menu.createItem", {
            itemId: item.id,
            name: item.title,
            categoryId: item.category,
            basePrice: item.price,
            description: item.description,
            image: item.image,
            prepMinutes: item.preparationTime,
            allergens: item.allergens,
          })
          if (!result.success) { reject("Could not add item", result.error); throw new Error(result.error?.message ?? "Menu create rejected"); }
          notify("success", "Menu item added")
          return Promise.resolve()
        } catch (error) {
          return Promise.reject(error instanceof Error ? error.message : "Failed to add menu item")
        }
      },

      deleteItem: async (itemId: string) => {
        try {
          const result = await run("menu.eightySix", { itemId, reason: "removed from sale" })
          if (!result.success) { reject("Could not remove item", result.error); throw new Error(result.error?.message ?? "Menu update rejected"); }
          notify("success", "Item removed from sale")
          return Promise.resolve()
        } catch (error) {
          return Promise.reject(error instanceof Error ? error.message : "Failed to delete menu item")
        }
      },

      setRecipe: async (itemId: string, recipe: Array<{ inventoryItemId: string; qty: number }>) => {
        try {
          const result = await run("menu.setRecipe", { itemId, recipe })
          if (!result.success) { reject("Could not save recipe", result.error); throw new Error(result.error?.message ?? "Recipe update rejected"); }
          notify("success", recipe.length === 0 ? "Recipe cleared" : "Recipe saved", "Stock depletes automatically when fired.");
          return Promise.resolve()
        } catch (error) {
          return Promise.reject(error instanceof Error ? error.message : "Failed to save recipe")
        }
      },
    }),
    [state, run, notify],
  )

  return <MenuContext.Provider value={api}>{children}</MenuContext.Provider>
}

// Custom hook
export const useMenu = () => {
  const context = useContext(MenuContext)
  if (context === undefined) {
    throw new Error("useMenu must be used within a MenuProvider")
  }
  return context
}