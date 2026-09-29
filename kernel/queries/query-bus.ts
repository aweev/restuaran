import {
  ActorContext,
  AttributeBag,
  KernelError,
  kernelError,
  QueryResult,
  TenantContext,
} from "@/kernel/types"
import { EventStore } from "@/kernel/event-store/event-store"
import { ProjectionRegistry } from "@/kernel/projections/projection"
import { AggregateRepository } from "@/kernel/aggregates/repository"

export interface QueryContext {
  tenant: TenantContext
  actor?: ActorContext
  events: EventStore
  projections: ProjectionRegistry
  repository: AggregateRepository
}

export interface QueryHandler<TParams extends AttributeBag = AttributeBag, TData = unknown> {
  queryType: string
  requiredPermission?: string
  handle: (params: TParams, ctx: QueryContext) => Promise<TData>
}

export class QueryBus {
  private handlers = new Map<string, QueryHandler>()

  constructor(private deps: { events: EventStore; projections: ProjectionRegistry; repository: AggregateRepository }) {}

  register<TParams extends AttributeBag, TData>(handler: QueryHandler<TParams, TData>): void {
    if (this.handlers.has(handler.queryType)) {
      throw kernelError("DUPLICATE_HANDLER", `Query handler already registered: ${handler.queryType}`)
    }
    this.handlers.set(handler.queryType, handler as QueryHandler)
  }

  registeredQueries(): string[] {
    return [...this.handlers.keys()]
  }

  async ask<TParams extends AttributeBag>(
    queryType: string,
    params: TParams,
    ctx: { tenant: TenantContext; actor?: ActorContext }
  ): Promise<QueryResult<unknown>> {
    const handler = this.handlers.get(queryType)
    if (!handler) {
      return { success: false, error: kernelError("UNKNOWN_QUERY", `No handler for "${queryType}"`) }
    }
    if (handler.requiredPermission && !(ctx.actor?.permissions.includes(handler.requiredPermission) ?? false)) {
      return { success: false, error: kernelError("FORBIDDEN", `Missing permission "${handler.requiredPermission}"`) }
    }
    try {
      const data = await handler.handle(params, {
        ...ctx,
        events: this.deps.events,
        projections: this.deps.projections,
        repository: this.deps.repository,
      })
      return { success: true, data }
    } catch (err) {
      return { success: false, error: normalizeError(err) }
    }
  }
}

function normalizeError(err: unknown): KernelError {
  if (err && typeof err === "object" && "code" in err && "message" in err) {
    const e = err as { code: unknown; message: unknown; details?: AttributeBag }
    return kernelError(String(e.code), String(e.message), e.details)
  }
  return kernelError("QUERY_FAILED", err instanceof Error ? err.message : String(err))
}
