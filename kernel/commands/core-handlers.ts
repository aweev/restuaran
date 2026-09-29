import { randomUUID } from "crypto"
import { AttributeBag, Command, CommandResult, StoredEvent } from "@/kernel/types"
import { CommandHandler, KernelDeps } from "@/kernel/commands/command-bus"
import { QueryHandler } from "@/kernel/queries/query-bus"
import { Aggregate } from "@/kernel/aggregates/aggregate"
import {
  InventoryItemAggregate,
  OrderAggregate,
  TableAggregate,
} from "@/kernel/aggregates"
import { OrderState } from "@/kernel/aggregates/order.aggregate"

const str = (v: unknown): string => String(v)
const num = (v: unknown): number => Number(v)

async function publish(deps: KernelDeps, committed: StoredEvent[]): Promise<void> {
  for (const e of committed) await deps.hooks.emit("event:published", { event: e })
}

/**
 * Load-with-guard + mutate + save + publish. Every mutating handler funnels
 * through the AggregateRepository so snapshot policy and AGGREGATE_NOT_FOUND
 * enforcement are uniform across core and module domains.
 */
async function mutate<T extends Aggregate>(
  deps: KernelDeps,
  type: string,
  id: string,
  behavior: (agg: T) => void
): Promise<StoredEvent[]> {
  const agg = await deps.repository.load<T>(type, deps.tenant, id)
  behavior(agg)
  const committed = await deps.repository.save(agg)
  await publish(deps, committed)
  return committed
}

/** New aggregate from a static factory: build, save, publish. */
async function create(deps: KernelDeps, build: () => Aggregate): Promise<StoredEvent[]> {
  const agg = build()
  const committed = await deps.repository.save(agg)
  await publish(deps, committed)
  return committed
}

function handler<TPayload extends AttributeBag>(
  commandType: string,
  requiredPermission: string,
  run: (cmd: Command<TPayload>, deps: KernelDeps) => Promise<CommandResult>
): CommandHandler<TPayload> {
  return { commandType, requiredPermission, handle: run as CommandHandler["handle"] }
}

function ok(cmd: Command, aggregateId: string, events: StoredEvent[]): CommandResult {
  return { success: true, commandId: cmd.commandId, aggregateId, events }
}

// ============================ ORDER ============================

const createOrder = handler<AttributeBag>("order.create", "order:create", async (cmd, deps) => {
  const id = cmd.payload.orderId ? str(cmd.payload.orderId) : randomUUID()
  const committed = await create(deps, () => OrderAggregate.create(deps.tenant, {
    id,
    channel: cmd.payload.channel as OrderState["channel"],
    tableId: cmd.payload.tableId ? str(cmd.payload.tableId) : undefined,
    serverId: cmd.payload.serverId ? str(cmd.payload.serverId) : undefined,
    customerId: cmd.payload.customerId ? str(cmd.payload.customerId) : undefined,
    dinerName: cmd.payload.dinerName ? str(cmd.payload.dinerName) : undefined,
    actor: cmd.actor,
  }))
  return ok(cmd, id, committed)
})

const addOrderLine = handler<AttributeBag>("order.addLine", "order:edit", async (cmd, deps) => {
  const orderId = str(cmd.payload.orderId)
  const committed = await mutate<OrderAggregate>(deps, OrderAggregate.TYPE, orderId, (agg) =>
    agg.addLine(cmd.actor, {
      menuItemId: str(cmd.payload.menuItemId),
      name: str(cmd.payload.name),
      unitPrice: num(cmd.payload.unitPrice),
      quantity: num(cmd.payload.quantity ?? 1),
      modifiers: cmd.payload.modifiers as never,
      course: cmd.payload.course ? num(cmd.payload.course) : undefined,
    })
  )
  return ok(cmd, orderId, committed)
})

const sendToKitchen = handler<AttributeBag>("order.sendToKitchen", "order:process", async (cmd, deps) => {
  const orderId = str(cmd.payload.orderId)
  const committed = await mutate<OrderAggregate>(deps, OrderAggregate.TYPE, orderId, (agg) =>
    agg.sendToKitchen(cmd.actor, cmd.payload.lineIds as string[] | undefined)
  )
  return ok(cmd, orderId, committed)
})

const recordPayment = handler<AttributeBag>("order.recordPayment", "order:pay", async (cmd, deps) => {
  const orderId = str(cmd.payload.orderId)
  const committed = await mutate<OrderAggregate>(deps, OrderAggregate.TYPE, orderId, (agg) =>
    agg.recordPayment(cmd.actor, {
      method: str(cmd.payload.method),
      amount: num(cmd.payload.amount),
      gateway: cmd.payload.gateway ? str(cmd.payload.gateway) : undefined,
    })
  )
  return ok(cmd, orderId, committed)
})

const closeOrder = handler<AttributeBag>("order.close", "order:pay", async (cmd, deps) => {
  const orderId = str(cmd.payload.orderId)
  const committed = await mutate<OrderAggregate>(deps, OrderAggregate.TYPE, orderId, (agg) => agg.close(cmd.actor))
  return ok(cmd, orderId, committed)
})

const voidOrder = handler<AttributeBag>("order.void", "order:edit", async (cmd, deps) => {
  const orderId = str(cmd.payload.orderId)
  const committed = await mutate<OrderAggregate>(deps, OrderAggregate.TYPE, orderId, (agg) =>
    agg.void(cmd.actor, str(cmd.payload.reason ?? "voided"))
  )
  return ok(cmd, orderId, committed)
})

// ---- Kitchen (KDS) line lifecycle ----

function lineStatusCommand(
  commandType: string,
  method: "markLinePreparing" | "markLineReady" | "serveLine"
): CommandHandler {
  return handler(commandType, "order:process", async (cmd, deps) => {
    const orderId = str(cmd.payload.orderId)
    const lineId = str(cmd.payload.lineId)
    const committed = await mutate<OrderAggregate>(deps, OrderAggregate.TYPE, orderId, (agg) =>
      agg[method](cmd.actor, lineId)
    )
    return ok(cmd, orderId, committed)
  })
}

const beginLine = lineStatusCommand("kitchen.beginLine", "markLinePreparing")
const readyLine = lineStatusCommand("kitchen.readyLine", "markLineReady")
const serveLine = lineStatusCommand("kitchen.serveLine", "serveLine")

const voidOrderLine = handler<AttributeBag>("order.voidLine", "order:edit", async (cmd, deps) => {
  const orderId = str(cmd.payload.orderId)
  const committed = await mutate<OrderAggregate>(deps, OrderAggregate.TYPE, orderId, (agg) =>
    agg.voidLine(cmd.actor, str(cmd.payload.lineId), str(cmd.payload.reason ?? "voided"))
  )
  return ok(cmd, orderId, committed)
})

// ============================ TABLE ============================

const createTable = handler<AttributeBag>("table.create", "table:create", async (cmd, deps) => {
  const id = cmd.payload.tableId ? str(cmd.payload.tableId) : randomUUID()
  const committed = await create(deps, () => TableAggregate.define(deps.tenant, {
    id,
    label: str(cmd.payload.label),
    capacity: num(cmd.payload.capacity ?? 2),
    floor: cmd.payload.floor ? str(cmd.payload.floor) : undefined,
    actor: cmd.actor,
  }))
  return ok(cmd, id, committed)
})

const seatTable = handler<AttributeBag>("table.seat", "table:edit", async (cmd, deps) => {
  const tableId = str(cmd.payload.tableId)
  const committed = await mutate<TableAggregate>(deps, TableAggregate.TYPE, tableId, (agg) =>
    agg.seat(cmd.actor, str(cmd.payload.orderId), str(cmd.payload.serverId))
  )
  return ok(cmd, tableId, committed)
})

const clearTable = handler<AttributeBag>("table.clear", "table:edit", async (cmd, deps) => {
  const tableId = str(cmd.payload.tableId)
  const committed = await mutate<TableAggregate>(deps, TableAggregate.TYPE, tableId, (agg) => agg.clear(cmd.actor))
  return ok(cmd, tableId, committed)
})

const cleanTable = handler<AttributeBag>("table.clean", "table:edit", async (cmd, deps) => {
  const tableId = str(cmd.payload.tableId)
  const committed = await mutate<TableAggregate>(deps, TableAggregate.TYPE, tableId, (agg) => agg.markClean(cmd.actor))
  return ok(cmd, tableId, committed)
})

// ============================ INVENTORY ============================

const defineItem = handler<AttributeBag>("inventory.defineItem", "inventory:create", async (cmd, deps) => {
  const id = cmd.payload.itemId ? str(cmd.payload.itemId) : randomUUID()
  const committed = await create(deps, () => InventoryItemAggregate.define(deps.tenant, {
    id,
    sku: str(cmd.payload.sku),
    name: str(cmd.payload.name),
    unit: str(cmd.payload.unit ?? "ea"),
    reorderPoint: cmd.payload.reorderPoint ? num(cmd.payload.reorderPoint) : undefined,
    unitCost: cmd.payload.unitCost ? num(cmd.payload.unitCost) : undefined,
    vendorId: cmd.payload.vendorId ? str(cmd.payload.vendorId) : undefined,
    actor: cmd.actor,
  }))
  return ok(cmd, id, committed)
})

const receiveStock = handler<AttributeBag>("inventory.receive", "inventory:edit", async (cmd, deps) => {
  const itemId = str(cmd.payload.itemId)
  const committed = await mutate<InventoryItemAggregate>(deps, InventoryItemAggregate.TYPE, itemId, (agg) =>
    agg.receive(cmd.actor, num(cmd.payload.quantity), { note: cmd.payload.note ? str(cmd.payload.note) : undefined })
  )
  return ok(cmd, itemId, committed)
})

const consumeStock = handler<AttributeBag>("inventory.consume", "inventory:edit", async (cmd, deps) => {
  const itemId = str(cmd.payload.itemId)
  const committed = await mutate<InventoryItemAggregate>(deps, InventoryItemAggregate.TYPE, itemId, (agg) =>
    agg.consume(cmd.actor, num(cmd.payload.quantity), cmd.payload.orderId ? str(cmd.payload.orderId) : undefined)
  )
  return ok(cmd, itemId, committed)
})

const recordWastage = handler<AttributeBag>("inventory.recordWastage", "inventory:edit", async (cmd, deps) => {
  const itemId = str(cmd.payload.itemId)
  const committed = await mutate<InventoryItemAggregate>(deps, InventoryItemAggregate.TYPE, itemId, (agg) =>
    agg.recordWastage(cmd.actor, num(cmd.payload.quantity), str(cmd.payload.reason ?? "unspecified"))
  )
  return ok(cmd, itemId, committed)
})

const adjustStock = handler<AttributeBag>("inventory.adjust", "inventory:edit", async (cmd, deps) => {
  const itemId = str(cmd.payload.itemId)
  const committed = await mutate<InventoryItemAggregate>(deps, InventoryItemAggregate.TYPE, itemId, (agg) =>
    agg.adjust(cmd.actor, num(cmd.payload.counted), str(cmd.payload.reason ?? "stock take"))
  )
  return ok(cmd, itemId, committed)
})

// ============================ QUERIES ============================

const getOrder: QueryHandler = {
  queryType: "get.order",
  requiredPermission: "order:view",
  async handle(params, ctx) {
    const agg = await ctx.repository.load<OrderAggregate>(OrderAggregate.TYPE, ctx.tenant, str(params.orderId))
    return { id: agg.id, version: agg.version, state: agg.state, total: agg.orderTotal() }
  },
}

const getTable: QueryHandler = {
  queryType: "get.table",
  requiredPermission: "table:view",
  async handle(params, ctx) {
    const agg = await ctx.repository.load<TableAggregate>(TableAggregate.TYPE, ctx.tenant, str(params.tableId))
    return { id: agg.id, version: agg.version, state: agg.state }
  },
}

const getInventoryItem: QueryHandler = {
  queryType: "get.inventoryItem",
  requiredPermission: "inventory:view",
  async handle(params, ctx) {
    const agg = await ctx.repository.load<InventoryItemAggregate>(
      InventoryItemAggregate.TYPE, ctx.tenant, str(params.itemId)
    )
    return { id: agg.id, version: agg.version, state: agg.state, available: agg.available() }
  },
}

const AUDIT_EVENT_LIMIT = 200

const getAggregateEvents: QueryHandler = {
  queryType: "get.aggregateEvents",
  // Raw event streams carry payment + PII payloads and actor identities:
  // audit:view (mapped from granular audit_log:view) is mandatory.
  requiredPermission: "audit:view",
  async handle(params, ctx) {
    const requested = params.limit ? num(params.limit) : AUDIT_EVENT_LIMIT
    const limit = Math.min(Math.max(requested, 1), AUDIT_EVENT_LIMIT)
    return ctx.events.readAggregate(
      ctx.tenant,
      str(params.aggregateType),
      str(params.aggregateId),
      params.fromVersion ? num(params.fromVersion) : undefined,
      limit
    )
  },
}

// ============================ REGISTRATION ============================

export const coreCommandHandlers: CommandHandler[] = [
  createOrder, addOrderLine, sendToKitchen, recordPayment, closeOrder, voidOrder,
  beginLine, readyLine, serveLine, voidOrderLine,
  createTable, seatTable, clearTable, cleanTable,
  defineItem, receiveStock, consumeStock, recordWastage, adjustStock,
]

export const coreQueryHandlers: QueryHandler[] = [
  getOrder, getTable, getInventoryItem, getAggregateEvents,
]
