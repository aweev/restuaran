"use client"

import type React from "react"
import { createContext, useContext, useMemo, useCallback } from "react"
import type { Ingredient } from "@/types/inventory"
import { useCommand, useProjection } from "@/kernel/react/kernel-provider"
import type { InventoryBoardState } from "@/kernel/projections/builtins"
import { inventoryRowsToIngredients } from "@/lib/kernel-mappers"
import { useFeedback, notifyWithActions, recoveryActionsFor } from "@/lib/feedback"
import { useAttentionOptional } from "@/context/AttentionContext"

// Define the state type
interface InventoryState {
  ingredients: Ingredient[]
  loading: boolean
  error: string | null
}

// Define the context type
interface InventoryContextType {
  state: InventoryState
  fetchInventory: () => Promise<void>
  addIngredient: (ingredient: Ingredient) => Promise<void>
  updateIngredient: (ingredient: Ingredient) => Promise<void>
  updateIngredientStock: (id: string, quantity: number) => Promise<void>
  recordWastage: (id: string, quantity: number, reason: string) => Promise<void>
  deleteIngredient: (id: string) => Promise<void>
}

// Create the context
const InventoryContext = createContext<InventoryContextType | undefined>(undefined)

/**
 * Inventory, backed by the event store.
 *
 * The list is the `inventory.board` projection and every mutation is a kernel
 * command, so stock can never drift from its ledger: receipts, consumption,
 * wastage and stock-takes are all events, and the low-stock board derives
 * from the same stream the auto-86 hook reads.
 *
 * Two deliberate mappings: a direct stock edit in the edit form becomes an
 * audited `inventory.adjust` stock-take (the form's intent — "the shelf says
 * X" — is exactly a stock-take), and DELETE becomes deactivation
 * (`isActive: false`): consumption history must survive for food-cost
 * reporting, so an ingredient leaves the board instead of vanishing.
 */
export function InventoryProvider({ children }: { children: React.ReactNode }) {
  const { state: board } = useProjection<InventoryBoardState>("inventory.board", 2000)
  const { run } = useCommand()
  const { notify } = useFeedback()
  const attention = useAttentionOptional()

  const reject = (title: string, err?: { message?: string; code?: string }) => {
    const actions = recoveryActionsFor(err?.code);
    attention?.push({ title, message: err?.message, code: err?.code, href: "/dashboard/inventory" });
    if (actions.length > 0) notifyWithActions(title, err?.message, actions);
    else notify("error", title, err?.message);
  };

  const ingredients = useMemo(() => inventoryRowsToIngredients(board?.rows ?? []), [board])

  const state = useMemo<InventoryState>(
    () => ({
      ingredients,
      loading: board === null,
      error: null,
    }),
    [ingredients, board],
  )

  // Real API calls
  const fetchInventory = useCallback(async () => {
    // Retained for call-site compatibility; the projection refreshes itself.
  }, [])

  const addIngredient = useCallback(
    async (ingredient: Ingredient) => {
      if (!ingredient.name?.trim()) throw new Error("Ingredient name is required")
      const defined = await run("inventory.defineItem", {
        itemId: ingredient.id || undefined,
        name: ingredient.name.trim(),
        unit: ingredient.unit || "ea",
        ...(ingredient.reorderLevel ? { reorderPoint: ingredient.reorderLevel } : {}),
        ...(ingredient.unitCost ? { unitCost: ingredient.unitCost } : {}),
        ...(ingredient.category ? { category: ingredient.category } : {}),
      })
      if (!defined.success) reject("Failed to add ingredient", defined.error)
      const id = (defined as { aggregateId?: string }).aggregateId ?? ingredient.id
      // Opening stock is a receipt like any other, so it lands in the ledger.
      if (ingredient.currentStock > 0) {
        const received = await run("inventory.receive", {
          itemId: id,
          quantity: ingredient.currentStock,
          note: "opening stock",
        })
        if (!received.success) reject("Ingredient defined but opening stock was rejected", received.error)
      }
      if (ingredient.isActive === false) {
        const deactivated = await run("inventory.updateItem", { itemId: id, isActive: false })
        if (!deactivated.success) reject("Failed to add ingredient", deactivated.error)
      }
    },
    [run],
  )

  const updateIngredient = useCallback(
    async (ingredient: Ingredient) => {
      if (!ingredient.name?.trim()) throw new Error("Ingredient name is required")
      const updated = await run("inventory.updateItem", {
        itemId: ingredient.id,
        name: ingredient.name.trim(),
        unit: ingredient.unit,
        reorderPoint: ingredient.reorderLevel,
        unitCost: ingredient.unitCost,
        category: ingredient.category,
        isActive: ingredient.isActive,
      })
      if (!updated.success) reject("Failed to update ingredient", updated.error)
      // A stock edit is a stock-take: the shelf count is authoritative and the
      // delta is the auditable event, not the typed number.
      const current = board?.rows.find((r) => r.itemId === ingredient.id)
      if (current && Number(current.onHand) !== Number(ingredient.currentStock)) {
        const adjusted = await run("inventory.adjust", {
          itemId: ingredient.id,
          counted: ingredient.currentStock,
          reason: "manual correction from stock screen",
        })
        if (!adjusted.success) reject("Details saved but the stock count was rejected", adjusted.error)
      }
    },
    [run, board],
  )

  const updateIngredientStock = useCallback(
    async (id: string, quantity: number) => {
      if (!Number.isFinite(quantity) || quantity === 0) throw new Error("Quantity must be a non-zero number")
      // Positive deltas are receipts; negative deltas are consumption, which
      // the kernel guards with INSUFFICIENT_STOCK instead of going negative.
      const result =
        quantity > 0
          ? await run("inventory.receive", { itemId: id, quantity })
          : await run("inventory.consume", { itemId: id, quantity: Math.abs(quantity) })
      if (!result.success) reject("Failed to update ingredient stock", result.error)
    },
    [run],
  )

  const deleteIngredient = useCallback(
    async (id: string) => {
      // No hard delete: consumption history feeds food-cost reporting, so the
      // ingredient leaves the active board instead of vanishing from it.
      const result = await run("inventory.updateItem", { itemId: id, isActive: false })
      if (!result.success) reject("Failed to delete ingredient", result.error)
    },
    [run],
  )

  const recordWastage = useCallback(
    async (id: string, quantity: number, reason: string) => {
      if (!Number.isFinite(quantity) || quantity <= 0) throw new Error("Waste quantity must be positive")
      if (!reason.trim()) throw new Error("A waste reason is required")
      const result = await run("inventory.recordWastage", { itemId: id, quantity, reason: reason.trim() })
      if (!result.success) reject("Failed to record wastage", result.error)
    },
    [run],
  )

  const value = useMemo(
    () => ({
      state,
      fetchInventory,
      addIngredient,
      updateIngredient,
      updateIngredientStock,
      recordWastage,
      deleteIngredient,
    }),
    [state, fetchInventory, addIngredient, updateIngredient, updateIngredientStock, recordWastage, deleteIngredient],
  )

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
