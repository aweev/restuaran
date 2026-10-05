/**
 * The single source of truth for status → visual mapping.
 *
 * Previously each component carried its own `STATUS_STYLE` object, and they had
 * already drifted apart (one knew about "dirty", another only "cleaning"; the
 * KDS used raw Tailwind colours that ignored the theme entirely). Anything
 * rendering a table, ticket or order state should resolve its colour from here.
 *
 * Domain logic, so it lives beside the other lib helpers rather than in a
 * component file.
 */
import type { VariantProps } from "class-variance-authority"
import type { badgeVariants } from "@/components/ui/badge"

export type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>

/** Domain states shared by tables and orders. */
export const TABLE_STATUS = ["available", "occupied", "reserved", "dirty", "out_of_service"] as const
export const ORDER_STATUS = [
  "draft", "pending", "preparing", "ready", "served", "delivered", "completed", "cancelled", "voided",
] as const

export type TableStatus = (typeof TABLE_STATUS)[number]
export type OrderStatus = (typeof ORDER_STATUS)[number]

/** Badge tone per state. Anything unlisted falls back to `outline`. */
const TABLE_BADGE: Record<string, BadgeVariant> = {
  available: "status-available",
  occupied: "status-occupied",
  reserved: "status-reserved",
  dirty: "status-dirty",
  // The UI historically called this "cleaning"; both appear in the wild.
  cleaning: "status-dirty",
  out_of_service: "status-out-of-service",
}

const ORDER_BADGE: Record<string, BadgeVariant> = {
  draft: "outline",
  pending: "status-pending",
  preparing: "status-preparing",
  ready: "status-ready",
  served: "status-served",
  delivered: "status-served",
  completed: "status-completed",
  cancelled: "status-cancelled",
  voided: "status-cancelled",
}

/** Human labels. Never show a raw enum value to staff. */
const TABLE_LABEL: Record<string, string> = {
  available: "Available",
  occupied: "Occupied",
  reserved: "Reserved",
  dirty: "Needs bussing",
  cleaning: "Needs bussing",
  out_of_service: "Out of service",
}

const ORDER_LABEL: Record<string, string> = {
  draft: "Draft",
  pending: "Pending",
  preparing: "Preparing",
  ready: "Ready",
  served: "Served",
  delivered: "Delivered",
  completed: "Completed",
  cancelled: "Cancelled",
  voided: "Voided",
}

export const tableBadgeVariant = (status: string): BadgeVariant => TABLE_BADGE[status] ?? "outline"
export const orderBadgeVariant = (status: string): BadgeVariant => ORDER_BADGE[status] ?? "outline"
export const tableStatusLabel = (status: string): string => TABLE_LABEL[status] ?? status
export const orderStatusLabel = (status: string): string => ORDER_LABEL[status] ?? status

/**
 * Urgency for a ticket or table, derived from elapsed time against a target.
 * "overdue" is the only state that pulses — noticeable without being noise.
 */
export type Urgency = "ok" | "warning" | "overdue"

export function urgencyFor(elapsedMs: number, targetMs: number): Urgency {
  if (targetMs <= 0) return "ok"
  const ratio = elapsedMs / targetMs
  if (ratio >= 1) return "overdue"
  if (ratio >= 0.75) return "warning"
  return "ok"
}

export const URGENCY_TEXT: Record<Urgency, string> = {
  ok: "text-status-available",
  warning: "text-status-dirty",
  overdue: "text-status-cancelled",
}

export const URGENCY_BORDER: Record<Urgency, string> = {
  ok: "border-border",
  warning: "border-status-dirty/50",
  overdue: "border-status-cancelled/60",
}

/** Compact duration, e.g. "4m 12s" / "1h 20m". Used wherever a dwell clock shows. */
export function formatElapsed(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "—"
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60)
    return `${hours}h ${minutes % 60}m`
  }
  return `${minutes}m ${String(seconds).padStart(2, "0")}s`
}

/** Money, always to the cent, always tabular. */
export function formatMoney(amount: number, currency = "USD"): string {
  if (!Number.isFinite(amount)) return "—"
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount)
}
