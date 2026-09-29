import { ActorContext } from "@/kernel/types"

export interface AuthPayload {
  sub: string
  email?: string
  role?: string
  permissions?: string[]
  [key: string]: unknown
}

// Kernel capabilities are intentionally decoupled from any single RBAC taxonomy.
// This adapter maps the host app's granular permission names (and role defaults)
// onto the coarse capabilities the kernel checks.
const GRANULAR_TO_CAPABILITY: Record<string, string[]> = {
  // Phase 3 integrations (webhooks, outbound deliveries)
  "integration:manage_webhooks": ["integration:manage"],
  "integration:view_deliveries": ["integration:view"],
  "order:create": ["order:create"],
  "order:edit_own": ["order:edit"],
  "order:edit_any": ["order:edit"],
  "order:change_status": ["order:process"],
  "order:process_payment": ["order:pay", "order:edit"],
  "order:issue_refund": ["order:pay"],
  "order:split_bill": ["order:edit"],
  "order:transfer_items": ["order:edit"],
  "order:view_all": ["order:view"],
  "order:view_assigned": ["order:view"],
  "table:change_status": ["table:edit"],
  "table:assign_to_order": ["table:edit"],
  "table:assign_server": ["table:edit"],
  "table:view_status": ["table:view"],
  "table_layout:edit": ["table:create"],
  "inventory:view": ["inventory:view"],
  "inventory:create": ["inventory:create"],
  "inventory:edit": ["inventory:edit"],
  "inventory:delete": ["inventory:edit"],
  "inventory:view_stock": ["inventory:view"],
  "inventory:manage_ingredients": ["inventory:create", "inventory:edit"],
  "inventory:perform_stock_take": ["inventory:edit"],
  "inventory:record_wastage": ["inventory:edit"],
  // Reservations & waitlist
  "reservation:view": ["reservation:view"],
  "reservation:create": ["reservation:manage"],
  "reservation:edit": ["reservation:manage"],
  "reservation:cancel": ["reservation:manage"],
  "reservation:seat_party": ["reservation:manage", "table:edit"],
  "waitlist:manage": ["waitlist:view", "waitlist:manage"],
  // Menu
  "menu:view": ["menu:view"],
  "menu:create_items": ["menu:manage"],
  "menu:edit_items": ["menu:manage"],
  "menu:delete_items": ["menu:manage"],
  "menu:set_availability": ["menu:manage"],
  "menu:set_pricing": ["menu:manage"],
  "menu:manage_modifiers": ["menu:manage"],
  // Staff scheduling & time clock
  "user:manage_shifts": ["staff:schedule", "staff:view"],
  "user:view_list": ["staff:view"],
  "user:view_details": ["staff:view"],
  // Audit
  "audit_log:view": ["audit:view"],
}

const ROLE_TO_CAPABILITIES: Record<string, string[]> = {
  admin: [
    "order:create", "order:edit", "order:process", "order:pay", "order:view",
    "table:create", "table:edit", "table:view",
    "inventory:create", "inventory:edit", "inventory:view",
    "reservation:view", "reservation:manage",
    "waitlist:view", "waitlist:manage",
    "menu:view", "menu:manage",
    "staff:view", "staff:schedule", "staff:clock",
    "integration:view", "integration:manage",
    "audit:view",
  ],
  manager: [
    "order:create", "order:edit", "order:process", "order:pay", "order:view",
    "table:create", "table:edit", "table:view",
    "inventory:create", "inventory:edit", "inventory:view",
    "reservation:view", "reservation:manage",
    "waitlist:view", "waitlist:manage",
    "menu:view", "menu:manage",
    "staff:view", "staff:schedule", "staff:clock",
    "integration:view", "integration:manage",
    "audit:view",
  ],
  owner: [
    "order:create", "order:edit", "order:process", "order:pay", "order:view",
    "table:create", "table:edit", "table:view",
    "inventory:create", "inventory:edit", "inventory:view",
    "reservation:view", "reservation:manage",
    "waitlist:view", "waitlist:manage",
    "menu:view", "menu:manage",
    "staff:view", "staff:schedule",
    "integration:view", "integration:manage",
    "audit:view",
  ],
  waiter: ["order:create", "order:edit", "order:view", "table:view", "table:edit", "reservation:view", "waitlist:view", "menu:view"],
  server: ["order:create", "order:edit", "order:view", "table:view", "table:edit", "reservation:view", "waitlist:view", "menu:view"],
  host: ["reservation:view", "reservation:manage", "waitlist:view", "waitlist:manage", "table:view"],
  "host_staff": ["reservation:view", "reservation:manage", "waitlist:view", "waitlist:manage", "table:view"],
  cashier: ["order:create", "order:edit", "order:pay", "order:view", "table:view", "reservation:view", "menu:view"],
  kitchen: ["order:view", "order:process", "inventory:view", "menu:view"],
  staff: ["order:create", "order:edit", "order:view", "table:view", "menu:view", "staff:clock"],
}

export function deriveCapabilities(payload: AuthPayload): string[] {
  const caps = new Set<string>()
  const role = String(payload.role ?? "")
  for (const c of ROLE_TO_CAPABILITIES[role] ?? []) caps.add(c)
  for (const p of payload.permissions ?? []) {
    for (const c of GRANULAR_TO_CAPABILITY[p] ?? []) caps.add(c)
  }
  return [...caps]
}

export function actorFromAuthPayload(payload: AuthPayload, device?: ActorContext["device"]): ActorContext {
  return {
    userId: payload.sub,
    roles: [payload.role ?? "staff"],
    permissions: deriveCapabilities(payload),
    ...(device ? { device } : {}),
  }
}
