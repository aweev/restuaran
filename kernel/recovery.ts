import type { AttributeBag } from "@/kernel/types"

/**
 * A recovery action the server suggests alongside a rejection.
 * Either navigates (`href`) or re-runs a concrete command
 * (`commandType` + `payload`) — so a toast button can fix, not just explain.
 */
export interface SuggestedAction {
  label: string
  commandType?: string
  payload?: AttributeBag
  href?: string
}

/**
 * Pure mapping from kernel rejection code → generic recovery actions.
 * No I/O: concrete candidates (e.g. *which* free table) are filled in by the
 * API layer, which can read projections. Never throws.
 */
export function suggestedActionsFor(
  code: string | undefined,
  payload?: AttributeBag,
): SuggestedAction[] {
  if (!code) return []
  switch (code) {
    case "TABLE_NOT_AVAILABLE":
    case "TABLE_OCCUPIED":
      return [{ label: "Show available tables", href: "/dashboard/tables" }]
    case "TABLE_NOT_FOUND":
      return [{ label: "Show all tables", href: "/dashboard/tables" }]
    case "MENU_ITEM_UNAVAILABLE":
      return [{ label: "Open menu availability", href: "/dashboard/menu" }]
    case "INSUFFICIENT_STOCK":
      return [{ label: "Open inventory", href: "/dashboard/inventory" }]
    case "ORDER_NOT_EDITABLE": {
      const tableId = payload?.tableId ?? payload?.orderId
      return [
        ...(typeof tableId === "string" && tableId
          ? [{
              label: "Start a new order",
              commandType: "order.create",
              payload: { tableId },
            } as SuggestedAction]
          : []),
        { label: "View orders", href: "/dashboard/orders" },
      ]
    }
    case "VERSION_CONFLICT":
      return [{ label: "Reload latest", href: "__reload__" }]
    case "FORBIDDEN":
      return [{ label: "Ask a manager" }]
    case "ORDER_UNPAID":
      return [{ label: "Collect payment", href: "/dashboard/orders" }]
    case "INVALID_PAYMENT":
      return [{ label: "Review payment", href: "/dashboard/orders" }]
    default:
      return []
  }
}
