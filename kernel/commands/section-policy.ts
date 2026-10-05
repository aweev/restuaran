import { kernelError } from "@/kernel/types"
import { OrderAggregate } from "@/kernel/aggregates/order.aggregate"
import type { CommandPolicy } from "@/kernel/commands/command-bus"

/**
 * Server-section scoping: `order:edit_own` is the floor every order handler
 * checks, and this policy vetoes actors who hold only `order:edit_own` when
 * the targeted ticket belongs to another server. Holders of the full
 * `order:edit` (managers, cashiers at the till) pass untouched.
 *
 * Unassigned tickets (serverId null, e.g. kiosk drafts) are editable by any
 * order-taker — there is no section to violate yet.
 */
const SCOPED_COMMANDS = new Set([
  "order.addLine",
  "order.voidLine",
  "order.void",
  "order.setNotes",
  "order.setTable",
  "order.transferLines",
])

function orderIdOf(commandType: string, payload: Record<string, unknown>): string | null {
  void commandType
  const raw = payload.orderId ?? payload.id
  return typeof raw === "string" && raw.length > 0 ? raw : null
}

export const orderSectionPolicy: CommandPolicy = {
  id: "ros.orders.sectionScope",
  async check(command, deps) {
    if (!SCOPED_COMMANDS.has(command.commandType)) return null
    // Full editors (managers, till cashiers) are never scoped.
    if (deps.actor.permissions.includes("order:edit")) return null
    if (!deps.actor.permissions.includes("order:edit_own")) return null
    const orderId = orderIdOf(command.commandType, command.payload as Record<string, unknown>)
    if (!orderId) return null
    const agg = await deps.repository
      .read(OrderAggregate.TYPE, deps.tenant, orderId)
      .catch(() => null) as { state?: { serverId?: string | null } } | null
    // Unknown order: let the handler report NOT_FOUND, not us.
    if (!agg || agg.state === undefined) return null
    const owner = agg.state.serverId ?? null
    if (owner == null || owner === deps.actor.userId) return null
    return kernelError(
      "FORBIDDEN",
      "This ticket belongs to another server — ask a manager to transfer it.",
    )
  },
}
