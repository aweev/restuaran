import { ActorContext, AttributeBag, Command, CommandResult, Id, StoredEvent } from "@/kernel/types"
import type { ZodType } from "zod"
import { CommandHandler, KernelDeps } from "./command-bus"
import { Aggregate } from "@/kernel/aggregates/aggregate"
import { ProjectionRegistry } from "@/kernel/projections/projection"
import { EventStore } from "@/kernel/event-store/event-store"
import { AggregateRepository } from "@/kernel/aggregates/repository"

export interface CommandExecContext<TPayload extends AttributeBag> {
  deps: KernelDeps
  payload: TPayload
  actor: ActorContext
  tenant: KernelDeps["tenant"]
  events: EventStore
  projections: ProjectionRegistry
  repository: AggregateRepository
  commandId: Id
  /** Load an aggregate for mutation (rejects unknown ids with AGGREGATE_NOT_FOUND). */
  load<T extends Aggregate>(aggregateType: string, aggregateId: string): Promise<T>
  /** Read an aggregate even if it has no stream (e.g. cross-module checks). */
  loadOrEmpty<T extends Aggregate>(aggregateType: string, aggregateId: string): Promise<T>
  /** Persist pending events and publish them to the hook bus (drives projections + socket). */
  commit<T extends Aggregate>(agg: T): Promise<StoredEvent[]>
}

export interface CommandSpec<TPayload extends AttributeBag = AttributeBag> {
  commandType: string
  requiredPermission?: string
  /** Opt-in Zod schema, enforced by the bus before `execute` runs. */
  schema?: ZodType<unknown>
  /** Mutate + commit; return the primary aggregate id for the result envelope. */
  execute: (ctx: CommandExecContext<TPayload>) => Promise<Id | void>
}

/**
 * Standard shape for every write: load aggregate (guarded), run behavior,
 * commit through the repository (snapshot policy applies), publish events.
 * Keeps handlers declarative and guarantees a uniform CommandResult envelope.
 */
export function defineCommand<TPayload extends AttributeBag = AttributeBag>(
  spec: CommandSpec<TPayload>
): CommandHandler<TPayload> {
  return {
    commandType: spec.commandType,
    requiredPermission: spec.requiredPermission,
    schema: spec.schema,
    async handle(command: Command<TPayload>, deps: KernelDeps): Promise<CommandResult> {
      const allCommitted: StoredEvent[] = []
      const ctx: CommandExecContext<TPayload> = {
        deps,
        payload: command.payload,
        actor: command.actor,
        tenant: deps.tenant,
        events: deps.events,
        projections: deps.projections,
        repository: deps.repository,
        commandId: command.commandId,
        load: <T extends Aggregate>(aggregateType: string, aggregateId: string) =>
          deps.repository.load<T>(aggregateType, deps.tenant, aggregateId),
        loadOrEmpty: <T extends Aggregate>(aggregateType: string, aggregateId: string) =>
          deps.repository.read<T>(aggregateType, deps.tenant, aggregateId),
        commit: async <T extends Aggregate>(agg: T) => {
          const committed = await deps.repository.save(agg)
          allCommitted.push(...committed)
          for (const e of committed) await deps.hooks.emit("event:published", { event: e })
          return committed
        },
      }

      const aggregateId = await spec.execute(ctx)
      return {
        success: true,
        commandId: command.commandId,
        aggregateId: aggregateId ?? undefined,
        events: allCommitted,
      }
    },
  }
}
