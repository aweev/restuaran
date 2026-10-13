import { randomUUID } from "crypto"
import type { ZodType } from "zod"
import {
  ActorContext,
  AttributeBag,
  Command,
  CommandResult,
  Id,
  KernelError,
  kernelError,
  TenantContext,
} from "@/kernel/types"
import { HookBus } from "@/kernel/hooks/hook-bus"
import { EventStore } from "@/kernel/event-store/event-store"
import { ProjectionRegistry } from "@/kernel/projections/projection"
import { AggregateRepository } from "@/kernel/aggregates/repository"

export interface CommandHandler<TPayload extends AttributeBag = AttributeBag> {
  commandType: string
  requiredPermission?: string
  /**
   * Opt-in payload schema, checked in `dispatch` before policies and the
   * handler run. Keeps malformed input (negative prices, empty ids) out of
   * aggregates with a uniform INVALID_PAYLOAD error instead of one-off guards
   * in every handler. Validated output replaces the raw payload, so Zod
   * defaults and coercions apply downstream.
   */
  schema?: ZodType<unknown>
  handle: (command: Command<TPayload>, deps: KernelDeps) => Promise<CommandResult>
}

export interface KernelDeps {
  events: EventStore
  hooks: HookBus
  projections: ProjectionRegistry
  repository: AggregateRepository
  tenant: TenantContext
  actor: ActorContext
}

export interface CommandBusDeps {
  events: EventStore
  hooks: HookBus
  projections: ProjectionRegistry
  repository: AggregateRepository
}

export interface CommandPolicy {
  id: string
  /** Return a KernelError to veto the command before any handler runs. */
  check: (command: Command, deps: KernelDeps) => Promise<KernelError | null>
}

export interface IdempotencyStore {
  get(requestId: string): Promise<CommandResult | null>
  set(requestId: string, result: CommandResult): Promise<void>
}

export class InMemoryIdempotencyStore implements IdempotencyStore {
  private seen = new Map<string, CommandResult>()
  constructor(private max = 5000) {}
  async get(requestId: string): Promise<CommandResult | null> {
    return this.seen.get(requestId) ?? null
  }
  async set(requestId: string, result: CommandResult): Promise<void> {
    this.seen.set(requestId, result)
    if (this.seen.size > this.max) {
      const first = this.seen.keys().next().value as string | undefined
      if (first) this.seen.delete(first)
    }
  }
  size(): number {
    return this.seen.size
  }
}

type SqlLike = {
  unsafe: (query: string, params?: unknown[]) => Promise<Array<Record<string, unknown>>>
}

/** DB-backed idempotency: table kernel_idempotency(request_id PK, result JSON, created_at). */
export class PostgresIdempotencyStore implements IdempotencyStore {
  constructor(private db: SqlLike) {}
  async get(requestId: string): Promise<CommandResult | null> {
    const rows = await this.db.unsafe(`SELECT result FROM kernel_idempotency WHERE request_id = $1`, [requestId])
    if (rows.length === 0) return null
    const raw = (rows[0].result ?? rows[0].Result ?? null) as unknown
    // Wire drivers differ: some parse jsonb to objects, others hand back text.
    if (typeof raw === "string") {
      try {
        return JSON.parse(raw) as CommandResult
      } catch {
        return null
      }
    }
    return (raw ?? null) as CommandResult | null
  }
  async set(requestId: string, result: CommandResult): Promise<void> {
    await this.db.unsafe(
      `INSERT INTO kernel_idempotency (request_id, result, created_at)
       VALUES ($1, $2::jsonb, NOW())
       ON CONFLICT (request_id) DO NOTHING`,
      [requestId, JSON.stringify(result)],
    )
  }
}

export class CommandBus {
  private handlers = new Map<string, CommandHandler>()
  private policies: CommandPolicy[] = []
  private idempotency: IdempotencyStore = new InMemoryIdempotencyStore()

  constructor(private deps: CommandBusDeps) {}

  setIdempotencyStore(store: IdempotencyStore): void {
    this.idempotency = store
  }

  use(policy: CommandPolicy): () => void {
    this.policies.push(policy)
    return () => this.removePolicy(policy.id)
  }

  removePolicy(id: string): void {
    this.policies = this.policies.filter((p) => p.id !== id)
  }

  register<TPayload extends AttributeBag>(handler: CommandHandler<TPayload>): void {
    if (this.handlers.has(handler.commandType)) {
      throw kernelError("DUPLICATE_HANDLER", `Command handler already registered: ${handler.commandType}`)
    }
    this.handlers.set(handler.commandType, handler as CommandHandler)
  }

  registeredCommands(): string[] {
    return [...this.handlers.keys()]
  }

  async dispatch(
    commandType: string,
    payload: AttributeBag,
    ctx: { tenant: TenantContext; actor: ActorContext; requestId?: Id }
  ): Promise<CommandResult> {
    const startedAt = Date.now()
    if (ctx.requestId) {
      try {
        const cached = await this.idempotency.get(ctx.requestId)
        if (cached) return cached
      } catch {
        /* idempotency lookup is advisory */
      }
    }
    const handler = this.handlers.get(commandType)
    const commandId = randomUUID()
    if (!handler) {
      return { success: false, commandId, error: kernelError("UNKNOWN_COMMAND", `No handler for "${commandType}"`) }
    }
    if (handler.requiredPermission && !ctx.actor.permissions.includes(handler.requiredPermission)) {
      return {
        success: false,
        commandId,
        error: kernelError("FORBIDDEN", `Missing permission "${handler.requiredPermission}"`),
      }
    }

    let validatedPayload = payload
    if (handler.schema) {
      const parsed = handler.schema.safeParse(payload)
      if (!parsed.success) {
        const rejected: CommandResult = {
          success: false,
          commandId,
          error: kernelError("INVALID_PAYLOAD", `Invalid payload for "${commandType}"`, {
            issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
          }),
        }
        await this.deps.hooks.emit("command:failed", {
          command: {
            commandId, commandType, payload, tenant: ctx.tenant,
            actor: ctx.actor, requestId: ctx.requestId, issuedAt: new Date().toISOString(),
          },
          result: rejected,
        })
        return rejected
      }
      validatedPayload = parsed.data as AttributeBag
    }

    const command: Command = {
      commandId,
      commandType,
      payload: validatedPayload,
      tenant: ctx.tenant,
      actor: ctx.actor,
      requestId: ctx.requestId,
      issuedAt: new Date().toISOString(),
    }

    const deps: KernelDeps = {
      events: this.deps.events,
      hooks: this.deps.hooks,
      projections: this.deps.projections,
      repository: this.deps.repository,
      ...ctx,
    }

    await this.deps.hooks.emit("command:before", { command })
    for (const policy of this.policies) {
      const veto = await policy.check(command, deps).catch((err) => normalizeError(err))
      if (veto) {
        const rejected: CommandResult = { success: false, commandId, error: veto }
        await this.deps.hooks.emit("command:failed", { command, result: rejected })
        return rejected
      }
    }
    try {
      const result = await handler.handle(command, deps)
      await this.deps.hooks.emit("command:after", { command, result })
      try {
        const { kernelMetrics } = await import("@/kernel/observability")
        kernelMetrics.increment(`command.${commandType}`)
        kernelMetrics.increment(result.success ? "command.ok" : "command.failed")
        kernelMetrics.recordLatency(`command.${commandType}`, Date.now() - startedAt)
      } catch {
        /* metrics are advisory */
      }
      if (ctx.requestId && result.success) {
        try {
          await this.idempotency.set(ctx.requestId, result)
        } catch {
          /* idempotency persist is advisory */
        }
      }
      return result
    } catch (err) {
      const failed: CommandResult = { success: false, commandId, error: normalizeError(err) }
      await this.deps.hooks.emit("command:failed", { command, result: failed })
      try {
        const { kernelMetrics } = await import("@/kernel/observability")
        kernelMetrics.increment(`command.${commandType}`)
        kernelMetrics.increment("command.failed")
        kernelMetrics.recordLatency(`command.${commandType}`, Date.now() - startedAt)
      } catch {
        /* metrics are advisory */
      }
      return failed
    }
  }
}

function normalizeError(err: unknown): KernelError {
  if (err && typeof err === "object" && "code" in err && "message" in err) {
    const e = err as { code: unknown; message: unknown; details?: AttributeBag }
    return kernelError(String(e.code), String(e.message), e.details)
  }
  return kernelError("HANDLER_FAILED", err instanceof Error ? err.message : String(err))
}
