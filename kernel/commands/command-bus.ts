import { randomUUID } from "crypto"
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

export class CommandBus {
  private handlers = new Map<string, CommandHandler>()
  private policies: CommandPolicy[] = []

  constructor(private deps: CommandBusDeps) {}

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

    const command: Command = {
      commandId,
      commandType,
      payload,
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
      return result
    } catch (err) {
      const failed: CommandResult = { success: false, commandId, error: normalizeError(err) }
      await this.deps.hooks.emit("command:failed", { command, result: failed })
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
