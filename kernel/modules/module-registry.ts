import { CommandBus } from "@/kernel/commands/command-bus"
import { QueryBus } from "@/kernel/queries/query-bus"
import { HookBus } from "@/kernel/hooks/hook-bus"
import { EventStore } from "@/kernel/event-store/event-store"
import { ProjectionRegistry } from "@/kernel/projections/projection"
import { Kernel } from "@/kernel/kernel"
import { AttributeBag, TenantContext } from "@/kernel/types"

export interface ModuleCapabilities {
  commands?: string[]
  queries?: string[]
  eventTypes?: string[]
}

export interface ModuleLifecycle {
  validate?: () => Promise<void>
  install?: (runtime: ModuleRuntime) => Promise<void>
  activate?: (runtime: ModuleRuntime) => Promise<void>
  deactivate?: (runtime: ModuleRuntime) => Promise<void>
  uninstall?: (runtime: ModuleRuntime) => Promise<void>
}

export interface ModuleRuntime {
  kernel: Kernel
  commands: CommandBus
  queries: QueryBus
  hooks: HookBus
  events: EventStore
  projections: ProjectionRegistry
  repository: import("@/kernel/aggregates/repository").AggregateRepository
  tenant: TenantContext
  config: AttributeBag
}

export interface RosModule {
  id: string
  name: string
  version: string
  capabilities: ModuleCapabilities
  dependencies?: string[]
  lifecycle?: ModuleLifecycle
}

export type ModuleStatus = "installed" | "active" | "inactive" | "failed"

interface RegisteredModule {
  module: RosModule
  status: ModuleStatus
}

export class ModuleRegistry {
  private modules = new Map<string, RegisteredModule>()

  list(): Array<{ id: string; name: string; version: string; status: ModuleStatus }> {
    return [...this.modules.values()].map((r) => ({
      id: r.module.id,
      name: r.module.name,
      version: r.module.version,
      status: r.status,
    }))
  }

  get(id: string): RosModule | undefined {
    return this.modules.get(id)?.module
  }

  async install(module: RosModule, runtime: ModuleRuntime): Promise<void> {
    if (this.modules.has(module.id)) {
      throw new Error(`Module already installed: ${module.id}`)
    }
    for (const dep of module.dependencies ?? []) {
      const d = this.modules.get(dep)
      if (!d || d.status !== "active") {
        throw new Error(`Module "${module.id}" requires active dependency "${dep}"`)
      }
    }
    const record: RegisteredModule = { module, status: "installed" }
    this.modules.set(module.id, record)
    try {
      await module.lifecycle?.validate?.()
      await module.lifecycle?.install?.(runtime)
    } catch (err) {
      record.status = "failed"
      throw err
    }
  }

  async activate(id: string, runtime: ModuleRuntime): Promise<void> {
    const record = this.modules.get(id)
    if (!record) throw new Error(`Module not installed: ${id}`)
    await record.module.lifecycle?.activate?.(runtime)
    record.status = "active"
  }

  async deactivate(id: string, runtime: ModuleRuntime): Promise<void> {
    const record = this.modules.get(id)
    if (!record) return
    try {
      await record.module.lifecycle?.deactivate?.(runtime)
    } finally {
      record.status = "inactive"
    }
  }

  async uninstall(id: string, runtime: ModuleRuntime): Promise<void> {
    const record = this.modules.get(id)
    if (!record) return
    if (record.status === "active") await this.deactivate(id, runtime)
    await record.module.lifecycle?.uninstall?.(runtime)
    this.modules.delete(id)
  }

  activeModules(): RosModule[] {
    return [...this.modules.values()].filter((r) => r.status === "active").map((r) => r.module)
  }
}
