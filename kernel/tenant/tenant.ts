import { randomUUID } from "crypto"
import { ActorContext, Id, kernelError, TenantContext } from "@/kernel/types"

export function newTenant(opts?: { orgId?: Id; venueId?: Id; zoneId?: Id }): TenantContext {
  return {
    orgId: opts?.orgId ?? randomUUID(),
    venueId: opts?.venueId ?? randomUUID(),
    ...(opts?.zoneId ? { zoneId: opts.zoneId } : {}),
  }
}

export function systemActor(overrides?: Partial<ActorContext>): ActorContext {
  return {
    userId: overrides?.userId ?? "system",
    roles: overrides?.roles ?? ["system"],
    permissions:
      overrides?.permissions ?? [
        "order:create", "order:edit", "order:edit_own", "order:process", "order:pay", "order:view", "order:comp",
        "table:create", "table:edit", "table:view",
        "inventory:create", "inventory:edit", "inventory:view",
        "reservation:view", "reservation:manage",
        "waitlist:view", "waitlist:manage",
        "menu:view", "menu:manage",
        "venue:view", "venue:manage",
        "customer:view", "customer:manage", "customer:view_pii", "feedback:submit",
        "staff:view", "staff:schedule", "staff:clock",
        "integration:view", "integration:manage",
        "audit:view",
      ],
    ...overrides,
  }
}

export function assertTenant(actual: TenantContext, expected: TenantContext): void {
  if (actual.orgId !== expected.orgId || actual.venueId !== expected.venueId) {
    throw kernelError("TENANT_MISMATCH", "Cross-tenant access denied")
  }
}

export function tenantFromEnv(): TenantContext | null {
  const orgId = process.env.ROS_ORG_ID
  const venueId = process.env.ROS_VENUE_ID
  if (!orgId || !venueId) return null
  return { orgId, venueId, ...(process.env.ROS_ZONE_ID ? { zoneId: process.env.ROS_ZONE_ID } : {}) }
}
