import { coreCommandHandlers } from "@/kernel/commands/core-handlers"
import { RosModule, ModuleRuntime } from "@/kernel/modules/module-registry"
import { inventoryBoardProjection, InventoryBoardState } from "@/kernel/projections/builtins"
import { QueryHandler } from "@/kernel/queries/query-bus"
import { InventoryItemAggregate } from "@/kernel/aggregates/inventory.aggregate"

export { inventoryBoardProjection }
export type { InventoryBoardState }

const INVENTORY_COMMANDS = [
  "inventory.defineItem",
  "inventory.updateItem",
  "inventory.receive",
  "inventory.consume",
  "inventory.recordWastage",
  "inventory.adjust",
]

function isDuplicateRegistration(err: unknown): boolean {
  if (!err || typeof err !== "object") return false
  const e = err as { code?: unknown; message?: unknown }
  return e.code === "DUPLICATE_HANDLER" || e.code === "DUPLICATE_PROJECTION" ||
    (typeof e.message === "string" && e.message.includes("already registered"))
}

function paginate<T>(rows: T[], params: { limit?: unknown; cursor?: unknown }): T[] {
  const limit = params.limit != null ? Math.min(Math.max(Number(params.limit) || 50, 1), 500) : 500
  const cursor = params.cursor != null ? Number(params.cursor) || 0 : 0
  return rows.slice(cursor, cursor + limit)
}

const listInventory: QueryHandler = {
  queryType: "list.inventory",
  requiredPermission: "inventory:view",
  async handle(params, ctx) {
    const rows = ctx.projections.get<InventoryBoardState>("inventory.board").state.rows
    return paginate(rows, params as { limit?: unknown; cursor?: unknown })
  },
}

const getInventoryItem: QueryHandler = {
  queryType: "get.inventoryItem",
  requiredPermission: "inventory:view",
  async handle(params, ctx) {
    const agg = await ctx.repository.load<InventoryItemAggregate>(
      InventoryItemAggregate.TYPE, ctx.tenant, String((params as Record<string, unknown>).itemId)
    )
    return { id: agg.id, version: agg.version, state: agg.state, available: agg.available() }
  },
}

export function inventoryModule(): RosModule {
  return {
    id: "ros.inventory",
    name: "Inventory",
    version: "1.0.0",
    capabilities: {
      commands: INVENTORY_COMMANDS,
      queries: ["get.inventoryItem", "list.inventory"],
      eventTypes: [
        "inventory.itemDefined",
        "inventory.received",
        "inventory.consumed",
        "inventory.wasted",
        "inventory.adjusted",
        "inventory.itemUpdated",
      ],
    },
    lifecycle: {
      async install(runtime: ModuleRuntime) {
        try {
          runtime.projections.register(inventoryBoardProjection(runtime.events, runtime.tenant))
        } catch (err) {
          // kernelError is a plain {code, message} object, not an Error
          // instance, so gate on code/message directly.
          if (!isDuplicateRegistration(err)) throw err
        }
      },
      async activate(runtime: ModuleRuntime) {
        const wanted = new Set(INVENTORY_COMMANDS)
        for (const h of coreCommandHandlers.filter((h) => wanted.has(h.commandType))) {
          try {
            runtime.commands.register(h)
          } catch (err) {
            if (!isDuplicateRegistration(err)) throw err
          }
        }
        try {
          runtime.queries.register(listInventory)
        } catch (err) {
          if (!isDuplicateRegistration(err)) throw err
        }
        try {
          runtime.queries.register(getInventoryItem)
        } catch (err) {
          if (!isDuplicateRegistration(err)) throw err
        }
      },
    },
  }
}
