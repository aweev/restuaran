import { Kernel, bootKernel, createKernel } from "@/kernel"
import { tenantFromEnv } from "@/kernel/tenant/tenant"
import { PostgresIdempotencyStore } from "@/kernel/commands/command-bus"
import { sql } from "@/lib/db"

/**
 * Single kernel per serverless warm instance (in dev this holds the in-memory
 * event store). Cached on globalThis; the *promise* is cached so concurrent
 * first-requests share one boot. Used by both /api/kernel and the /api/v1
 * public API — they must see the same kernel.
 */
const globalForKernel = globalThis as unknown as {
  __rosKernel?: Promise<Kernel>
  __rosSocketEnabled?: boolean
}

export function isSocketEnabled(): boolean {
  return globalForKernel.__rosSocketEnabled ?? false
}

export function getKernel(): Promise<Kernel> {
  if (!globalForKernel.__rosKernel) {
    const tenant = tenantFromEnv() ?? { orgId: "default-org", venueId: "default-venue" }
    const socketEnabled = Boolean(process.env.INTERNAL_EMIT_SECRET)
    globalForKernel.__rosSocketEnabled = socketEnabled
    
    // DB-backed idempotency whenever a database is configured. Never fall
    // back to silent in-memory dedupe in production — duplicate orders
    // during a rush are worse than a boot error.
    const idempotency = process.env.DATABASE_URL
      ? new PostgresIdempotencyStore(sql as never)
      : undefined

    const kernel = createKernel({ tenant, idempotency })
    // bootKernel: installs Phase 2 + Phase 3 modules, wires the socket bridge
    // when INTERNAL_EMIT_SECRET is set, drains outbound deliveries automatically
    // (webhooks/connectors), optionally schedules compaction, boots projections.
    globalForKernel.__rosKernel = bootKernel(kernel, {
      socket: socketEnabled ? { enabled: true } : null,
      integrations: { autoProcess: true },
      compaction: compactionFromEnv(),
    }).then(
      () => kernel,
      (err) => {
        globalForKernel.__rosKernel = undefined
        throw err
      }
    )
  }
  return globalForKernel.__rosKernel
}

function compactionFromEnv(): { intervalMs?: number; minEventsPerAggregate?: number; prune?: boolean } | undefined {
  const interval = Number(process.env.ROS_COMPACTION_INTERVAL_MS ?? 0)
  if (!Number.isFinite(interval) || interval <= 0) return undefined
  const minEvents = Number(process.env.ROS_COMPACTION_MIN_EVENTS ?? 50)
  return {
    intervalMs: interval,
    ...(Number.isFinite(minEvents) && minEvents > 0 ? { minEventsPerAggregate: minEvents } : {}),
    prune: process.env.ROS_COMPACTION_PRUNE === "1",
  }
}
