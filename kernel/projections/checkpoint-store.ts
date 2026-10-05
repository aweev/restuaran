import { TenantContext } from "@/kernel/types"

/** Durable per-projection cursor, so cold boots replay from a checkpoint. */
export interface CheckpointStore {
  load(tenant: TenantContext): Promise<Record<string, number>>
  save(tenant: TenantContext, positions: Record<string, number>): Promise<void>
}

export class MemoryCheckpointStore implements CheckpointStore {
  private data: Record<string, number> = {}
  async load(): Promise<Record<string, number>> {
    return { ...this.data }
  }
  async save(_tenant: TenantContext, positions: Record<string, number>): Promise<void> {
    this.data = { ...this.data, ...positions }
  }
}

interface SqlLike {
  unsafe(query: string, params?: unknown[]): Promise<Array<Record<string, unknown>>>
}

/**
 * Postgres-backed checkpoints over ros_projections_state
 * (projection_name, org_id, venue_id) → cursor_position.
 */
export class PostgresCheckpointStore implements CheckpointStore {
  constructor(private db: SqlLike) {}

  async load(tenant: TenantContext): Promise<Record<string, number>> {
    try {
      const rows = await this.db.unsafe(
        `SELECT projection_name, cursor_position FROM ros_projections_state WHERE org_id = $1 AND venue_id = $2`,
        [tenant.orgId, tenant.venueId],
      )
      const out: Record<string, number> = {}
      for (const r of rows) {
        out[String(r.projection_name)] = Number(r.cursor_position ?? 0)
      }
      return out
    } catch {
      return {}
    }
  }

  async save(tenant: TenantContext, positions: Record<string, number>): Promise<void> {
    for (const [name, pos] of Object.entries(positions)) {
      try {
        await this.db.unsafe(
          `INSERT INTO ros_projections_state (projection_name, org_id, venue_id, cursor_position, updated_at)
           VALUES ($1, $2, $3, $4, now())
           ON CONFLICT (projection_name, org_id, venue_id)
           DO UPDATE SET cursor_position = GREATEST(ros_projections_state.cursor_position, EXCLUDED.cursor_position),
                         updated_at = now()`,
          [name, tenant.orgId, tenant.venueId, pos],
        )
      } catch {
        /* checkpoint persistence is advisory; replay stays correct */
      }
    }
  }
}
