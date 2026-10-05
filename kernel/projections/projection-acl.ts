import { kernelError } from "@/kernel/types"

/**
 * Capability required to read each projection over the HTTP surface.
 * The generic GET /api/kernel?projection= path is deliberately gated here:
 * projection state can embed PII (customer names/phones), financials
 * (menu cost/margin) or stock data, so it must not bypass the per-query
 * permission gates that the list/get query handlers already enforce.
 */
export const PROJECTION_CAPABILITIES: Record<string, string> = {
  "kitchen.queue": "order:view",
  "tables.board": "table:view",
  "inventory.board": "inventory:view",
  "reservations.board": "reservation:view",
  "waitlist.board": "waitlist:view",
  "menu.board": "menu:view",
  "platform.orders": "order:view",
  "orders.board": "order:view",
  "sales.board": "order:view",
  "staff.board": "staff:view",
  "customers.board": "customer:view",
  "giftcards.board": "giftcard:view",
  "promotions.board": "promotion:view",
  "venues.board": "venue:view",
  "webhooks.endpoints": "integration:view",
}

export function requiredCapabilityFor(projectionName: string): string {
  return PROJECTION_CAPABILITIES[projectionName] ?? "audit:view"
}

export function assertProjectionAccess(actorPermissions: readonly string[], projectionName: string): void {
  const capability = requiredCapabilityFor(projectionName)
  if (!actorPermissions.includes(capability)) {
    throw kernelError("FORBIDDEN", `Missing permission "${capability}" for projection "${projectionName}"`)
  }
}
