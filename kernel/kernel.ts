import { randomUUID } from "crypto"
import {
  ActorContext,
  AttributeBag,
  CommandResult,
  Id,
  QueryResult,
  TenantContext,
} from "@/kernel/types"
import { EventStore } from "@/kernel/event-store/event-store"
import { CURRENT_SCHEMA_VERSION, VersionedEventStore } from "@/kernel/event-store/versioned-store"
import { CommandBus } from "@/kernel/commands/command-bus"
import { QueryBus } from "@/kernel/queries/query-bus"
import { HookBus } from "@/kernel/hooks/hook-bus"
import { ProjectionRegistry } from "@/kernel/projections/projection"
import { ModuleRegistry, ModuleRuntime, RosModule } from "@/kernel/modules/module-registry"
import { AggregateRepository, SnapshotPolicy } from "@/kernel/aggregates/repository"
import { loadAggregate, loadExisting, saveAggregate } from "@/kernel/aggregates/registry"
import type { IntegrationFabric } from "@/kernel/integrations/fabric"

export interface KernelConfig {
  store: EventStore
  tenant: TenantContext
  projections?: ProjectionRegistry
  snapshot?: SnapshotPolicy
  config?: AttributeBag
}

export class Kernel {
  readonly store: EventStore
  readonly tenant: TenantContext
  readonly hooks = new HookBus()
  readonly projections: ProjectionRegistry
  readonly commands: CommandBus
  readonly queries: QueryBus
  readonly repository: AggregateRepository
  readonly modules = new ModuleRegistry()
  readonly config: AttributeBag
  /** Phase 3 integration fabric; set by the integrations module when active. */
  integrations?: IntegrationFabric
  private disposers: Array<() => void> = []

  get version(): number {
    return this.store instanceof VersionedEventStore ? this.store.version : CURRENT_SCHEMA_VERSION
  }

  constructor(cfg: KernelConfig) {
    this.store = cfg.store
    this.tenant = cfg.tenant
    this.projections = cfg.projections ?? new ProjectionRegistry()
    this.repository = new AggregateRepository({
      events: cfg.store,
      snapshot: cfg.snapshot,
      load: loadExisting,
      read: loadAggregate,
      saveAggregate,
    })
    this.commands = new CommandBus({
      events: cfg.store,
      hooks: this.hooks,
      projections: this.projections,
      repository: this.repository,
    })
    this.queries = new QueryBus({ events: cfg.store, projections: this.projections, repository: this.repository })
    this.config = cfg.config ?? {}
  }

  runtime(): ModuleRuntime {
    return {
      kernel: this,
      commands: this.commands,
      queries: this.queries,
      hooks: this.hooks,
      events: this.store,
      projections: this.projections,
      repository: this.repository,
      tenant: this.tenant,
      config: this.config,
    }
  }

  async execute(
    commandType: string,
    payload: AttributeBag,
    actor: ActorContext,
    requestId?: Id
  ): Promise<CommandResult> {
    return this.commands.dispatch(commandType, payload, {
      tenant: this.tenant,
      actor,
      requestId: requestId ?? randomUUID(),
    })
  }

  async ask<TParams extends AttributeBag>(
    queryType: string,
    params: TParams,
    actor?: ActorContext
  ): Promise<QueryResult<unknown>> {
    return this.queries.ask(queryType, params, { tenant: this.tenant, actor })
  }

  async installModule(module: RosModule, activate = true): Promise<void> {
    const runtime = this.runtime()
    await this.modules.install(module, runtime)
    if (activate) await this.modules.activate(module.id, runtime)
  }

  async boot(): Promise<void> {
    await this.projections.rebuildAll()
    this.projections.startAll()
  }

  /** Register cleanup (timers, schedulers) run by shutdown(). */
  addDisposer(dispose: () => void): void {
    this.disposers.push(dispose)
  }

  async shutdown(): Promise<void> {
    this.projections.stopAll()
    for (const dispose of this.disposers.splice(0)) {
      try {
        dispose()
      } catch (err) {
        console.error("[kernel:shutdown] disposer failed:", err)
      }
    }
  }
}
