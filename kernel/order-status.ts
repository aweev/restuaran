import type { OrderBoardRow } from "@/kernel/projections/orders-board"

/**
 * Single order-status truth.
 *
 * Kernel models order-level `draft|open|closed|voided`; fulfilment lives on
 * lines (`open|sent|preparing|ready|served|voided`). The board groups by
 * fulfilment for the floor, the cashier cares about open vs closed. Derive
 * both from the same row — no second mapper in detail pages.
 */
export type BoardGroup =
  | "draft"
  | "pending"
  | "preparing"
  | "ready"
  | "served"
  | "completed"
  | "voided"

export function boardGroup(row: OrderBoardRow): BoardGroup {
  if (row.status === "closed") return "completed"
  if (row.status === "voided") return "voided"
  if (row.status === "draft") return "draft"
  if (row.lines.some((l) => l.status === "ready")) return "ready"
  if (row.lines.some((l) => l.status === "preparing")) return "preparing"
  if (row.lines.some((l) => l.status === "sent")) return "pending"
  return "served"
}

export function isOpenOrder(row: OrderBoardRow): boolean {
  return row.status === "draft" || row.status === "open"
}
