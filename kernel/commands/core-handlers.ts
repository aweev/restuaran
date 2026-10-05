import { randomUUID } from "crypto"
import { z } from "zod"
import type { ZodType } from "zod"
import { AttributeBag, Command, CommandResult, StoredEvent } from "@/kernel/types"
import { CommandHandler, KernelDeps } from "@/kernel/commands/command-bus"
import { QueryHandler } from "@/kernel/queries/query-bus"
import { Aggregate } from "@/kernel/aggregates/aggregate"
import {
  InventoryItemAggregate,
  KitchenStationAggregate,
  OrderAggregate,
  TableAggregate,
  VenueAggregate,
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
  run: (cmd: Command<TPayload>, deps: KernelDeps) => Promise<CommandResult>,
  schema?: ZodType<unknown>
): CommandHandler<TPayload> {
  return { commandType, requiredPermission, schema, handle: run as CommandHandler["handle"] }
}

function ok(cmd: Command, aggregateId: string, events: StoredEvent[]): CommandResult {
  return { success: true, commandId: cmd.commandId, aggregateId, events }
}

// ============================ ORDER ============================

/**
 * Payload schemas for the highest-traffic writes. Deliberately shape-checks,
 * not business rules: the aggregates keep owning invariants (86'd policy,
 * balance guards), while the bus rejects structurally malformed input with a
 * uniform INVALID_PAYLOAD before any policy or handler runs.
 */
const orderCreateSchema = z.object({
  orderId: z.string().min(1).optional(),
  channel: z.string().min(1).optional(),
  tableId: z.string().min(1).optional(),
  serverId: z.string().min(1).optional(),
  customerId: z.string().min(1).optional(),
  dinerName: z.string().optional(),
}).passthrough()

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
}, orderCreateSchema)

const addOrderLine = handler<AttributeBag>("order.addLine", "order:edit_own", async (cmd, deps) => {
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

const voidOrder = handler<AttributeBag>("order.void", "order:edit_own", async (cmd, deps) => {
  const orderId = str(cmd.payload.orderId)
  const committed = await mutate<OrderAggregate>(deps, OrderAggregate.TYPE, orderId, (agg) =>
    agg.void(cmd.actor, str(cmd.payload.reason ?? "voided"))
  )
  return ok(cmd, orderId, committed)
})

const setOrderNotes = handler<AttributeBag>("order.setNotes", "order:edit_own", async (cmd, deps) => {
  const orderId = str(cmd.payload.orderId)
  const committed = await mutate<OrderAggregate>(deps, OrderAggregate.TYPE, orderId, (agg) =>
    agg.setNotes(cmd.actor, str(cmd.payload.notes ?? ""))
  )
  return ok(cmd, orderId, committed)
})

const setOrderTable = handler<AttributeBag>("order.setTable", "order:edit_own", async (cmd, deps) => {
  const orderId = str(cmd.payload.orderId)
  const tableId = str(cmd.payload.tableId)
  const committed = await mutate<OrderAggregate>(deps, OrderAggregate.TYPE, orderId, (agg) =>
    agg.setTable(cmd.actor, tableId),
  )
  return ok(cmd, orderId, committed)
})

const outOfServiceTable = handler<AttributeBag>("table.outOfService", "table:edit", async (cmd, deps) => {
  const tableId = str(cmd.payload.tableId)
  const committed = await mutate<TableAggregate>(deps, TableAggregate.TYPE, tableId, (agg) =>
    agg.takeOutOfService(cmd.actor, cmd.payload.reason ? str(cmd.payload.reason) : undefined)
  )
  return ok(cmd, tableId, committed)
})

const repositionTable = handler<AttributeBag>("table.reposition", "table:create", async (cmd, deps) => {
  const tableId = str(cmd.payload.tableId)
  const committed = await mutate<TableAggregate>(deps, TableAggregate.TYPE, tableId, (agg) =>
    agg.reposition(cmd.actor, {
      x: cmd.payload.x != null ? num(cmd.payload.x) : undefined,
      y: cmd.payload.y != null ? num(cmd.payload.y) : undefined,
      width: cmd.payload.width != null ? num(cmd.payload.width) : undefined,
      height: cmd.payload.height != null ? num(cmd.payload.height) : undefined,
      shape: cmd.payload.shape ? str(cmd.payload.shape) as "round" | "square" | "rect" : undefined,
      zone: cmd.payload.zone ? str(cmd.payload.zone) : undefined,
    })
  )
  return ok(cmd, tableId, committed)
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

const assignStation = handler<AttributeBag>("kitchen.assignStation", "order:process", async (cmd, deps) => {
  const staffId = str(cmd.payload.staffId)
  const station = str(cmd.payload.station)
  const agg = await deps.repository.read<KitchenStationAggregate>(
    KitchenStationAggregate.TYPE, deps.tenant, staffId,
  )
  agg.assign(cmd.actor, staffId, station)
  const committed = await deps.repository.save(agg)
  await publish(deps, committed)
  return ok(cmd, staffId, committed)
})

const clearStation = handler<AttributeBag>("kitchen.clearStation", "order:process", async (cmd, deps) => {
  const staffId = str(cmd.payload.staffId)
  const committed = await mutate<KitchenStationAggregate>(deps, KitchenStationAggregate.TYPE, staffId, (agg) =>
    agg.clear(cmd.actor),
  )
  return ok(cmd, staffId, committed)
})

const voidOrderLine = handler<AttributeBag>("order.voidLine", "order:edit_own", async (cmd, deps) => {
  const orderId = str(cmd.payload.orderId)
  const committed = await mutate<OrderAggregate>(deps, OrderAggregate.TYPE, orderId, (agg) =>
    agg.voidLine(cmd.actor, str(cmd.payload.lineId), str(cmd.payload.reason ?? "voided"))
  )
  return ok(cmd, orderId, committed)
})

// ---- Comps, discounts, tax, tips, courses, splits, transfers ----

const compLine = handler<AttributeBag>("order.compLine", "order:comp", async (cmd, deps) => {
  const orderId = str(cmd.payload.orderId)
  const committed = await mutate<OrderAggregate>(deps, OrderAggregate.TYPE, orderId, (agg) =>
    agg.compLine(cmd.actor, str(cmd.payload.lineId), cmd.payload.reason ? str(cmd.payload.reason) : undefined)
  )
  return ok(cmd, orderId, committed)
})

const compOrder = handler<AttributeBag>("order.comp", "order:comp", async (cmd, deps) => {
  const orderId = str(cmd.payload.orderId)
  const committed = await mutate<OrderAggregate>(deps, OrderAggregate.TYPE, orderId, (agg) =>
    agg.compOrder(cmd.actor, cmd.payload.reason ? str(cmd.payload.reason) : undefined)
  )
  return ok(cmd, orderId, committed)
})

const applyDiscount = handler<AttributeBag>("order.applyDiscount", "order:comp", async (cmd, deps) => {
  const orderId = str(cmd.payload.orderId)
  const committed = await mutate<OrderAggregate>(deps, OrderAggregate.TYPE, orderId, (agg) =>
    agg.applyDiscount(cmd.actor, {
      kind: str(cmd.payload.kind) === "percent" ? "percent" : "amount",
      value: num(cmd.payload.value),
      label: cmd.payload.label ? str(cmd.payload.label) : undefined,
    })
  )
  return ok(cmd, orderId, committed)
})

const applyTax = handler<AttributeBag>("order.applyTax", "order:comp", async (cmd, deps) => {
  const orderId = str(cmd.payload.orderId)
  // Read tax rate from venue aggregate (server-authoritative)
  const venueAgg = await deps.repository.load<VenueAggregate>(VenueAggregate.TYPE, deps.tenant, deps.tenant.venueId)
  const taxRate = venueAgg.state.taxRate ?? 0
  const committed = await mutate<OrderAggregate>(deps, OrderAggregate.TYPE, orderId, (agg) =>
    agg.applyTax(cmd.actor, {
      rate: taxRate,
    })
  )
  return ok(cmd, orderId, committed)
})

const addTip = handler<AttributeBag>("order.addTip", "order:pay", async (cmd, deps) => {
  const orderId = str(cmd.payload.orderId)
  const committed = await mutate<OrderAggregate>(deps, OrderAggregate.TYPE, orderId, (agg) =>
    agg.addTip(
      cmd.actor,
      num(cmd.payload.amount),
      cmd.payload.splitIndex != null ? num(cmd.payload.splitIndex) : null,
    )
  )
  return ok(cmd, orderId, committed)
})

const splitCheck = handler<AttributeBag>("order.split", "order:pay", async (cmd, deps) => {
  const orderId = str(cmd.payload.orderId)
  const committed = await mutate<OrderAggregate>(deps, OrderAggregate.TYPE, orderId, (agg) =>
    agg.splitCheck(cmd.actor, num(cmd.payload.ways), cmd.payload.splitId ? str(cmd.payload.splitId) : undefined)
  )
  return ok(cmd, orderId, committed)
})

const fireCourse = handler<AttributeBag>("order.fireCourse", "order:process", async (cmd, deps) => {
  const orderId = str(cmd.payload.orderId)
  const committed = await mutate<OrderAggregate>(deps, OrderAggregate.TYPE, orderId, (agg) =>
    agg.fireCourse(cmd.actor, num(cmd.payload.course))
  )
  return ok(cmd, orderId, committed)
})

/**
 * Hold / release a course. These are kernel facts (not terminal-local UI state)
 * so every KDS sees the same hold across reloads and devices.
 */
const holdCourse = handler<AttributeBag>("order.holdCourse", "order:process", async (cmd, deps) => {
  const orderId = str(cmd.payload.orderId)
  const committed = await mutate<OrderAggregate>(deps, OrderAggregate.TYPE, orderId, (agg) =>
    agg.holdCourse(cmd.actor, num(cmd.payload.course))
  )
  return ok(cmd, orderId, committed)
})

const releaseCourse = handler<AttributeBag>("order.releaseCourse", "order:process", async (cmd, deps) => {
  const orderId = str(cmd.payload.orderId)
  const committed = await mutate<OrderAggregate>(deps, OrderAggregate.TYPE, orderId, (agg) =>
    agg.releaseCourse(cmd.actor, num(cmd.payload.course))
  )
  return ok(cmd, orderId, committed)
})

/**
 * Two-phase transfer. The source is debited first, then the destination credited
 * under a caller-supplied `transferId`. If step two fails, replaying the same
 * command with the same id is safe: both aggregates record the id and the
 * destination cannot be credited twice.
 */
const transferLines = handler<AttributeBag>("order.transferLines", "order:edit_own", async (cmd, deps) => {
  const fromId = str(cmd.payload.orderId)
  const toId = str(cmd.payload.toOrderId)
  const lineIds = (cmd.payload.lineIds as string[]) ?? []
  const transferId = str(cmd.payload.transferId ?? randomUUID())
  if (fromId === toId) {
    return { success: false, commandId: cmd.commandId, error: { code: "INVALID_TRANSFER", message: "Cannot transfer to the same order" } }
  }

  const outEvents = await mutate<OrderAggregate>(deps, OrderAggregate.TYPE, fromId, (agg) =>
    agg.transferLinesOut(cmd.actor, toId, lineIds, transferId)
  )

  // Re-read the source so the lines we hand over are exactly what it released.
  const source = await deps.repository.load<OrderAggregate>(OrderAggregate.TYPE, deps.tenant, fromId)
  const moved = source.state.lines.filter((l) =>
    lineIds.includes(l.lineId) && l.status === "voided"
  )

  const inEvents = await mutate<OrderAggregate>(deps, OrderAggregate.TYPE, toId, (agg) =>
    agg.transferLinesIn(cmd.actor, fromId, moved, transferId)
  )

  for (const e of [...outEvents, ...inEvents]) await deps.hooks.emit("event:published", { event: e })
  return ok(cmd, fromId, [...outEvents, ...inEvents])
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
    sku: cmd.payload.sku ? str(cmd.payload.sku) : str(cmd.payload.name ?? id).toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 32) || id,
    name: str(cmd.payload.name),
    unit: str(cmd.payload.unit ?? "ea"),
    reorderPoint: cmd.payload.reorderPoint ? num(cmd.payload.reorderPoint) : undefined,
    unitCost: cmd.payload.unitCost ? num(cmd.payload.unitCost) : undefined,
    vendorId: cmd.payload.vendorId ? str(cmd.payload.vendorId) : undefined,
    category: cmd.payload.category ? str(cmd.payload.category) : undefined,
    actor: cmd.actor,
  }))
  return ok(cmd, id, committed)
})

const updateInventoryItem = handler<AttributeBag>("inventory.updateItem", "inventory:edit", async (cmd, deps) => {
  const itemId = str(cmd.payload.itemId)
  const committed = await mutate<InventoryItemAggregate>(deps, InventoryItemAggregate.TYPE, itemId, (agg) =>
    agg.updateDetails(cmd.actor, {
      ...(cmd.payload.name !== undefined ? { name: str(cmd.payload.name) } : {}),
      ...(cmd.payload.unit !== undefined ? { unit: str(cmd.payload.unit) } : {}),
      ...(cmd.payload.reorderPoint !== undefined ? { reorderPoint: num(cmd.payload.reorderPoint) } : {}),
      ...(cmd.payload.unitCost !== undefined ? { unitCost: num(cmd.payload.unitCost) } : {}),
      ...(cmd.payload.category !== undefined ? { category: str(cmd.payload.category) } : {}),
      ...(cmd.payload.vendorId !== undefined ? { vendorId: cmd.payload.vendorId ? str(cmd.payload.vendorId) : null } : {}),
      ...(cmd.payload.isActive !== undefined ? { isActive: Boolean(cmd.payload.isActive) } : {}),
    })
  )
  return ok(cmd, itemId, committed)
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
    const cursor = params.cursor != null ? Math.max(num(params.cursor) || 0, 0) : 0
    const events = await ctx.events.readAggregate(
      ctx.tenant,
      str(params.aggregateType),
      str(params.aggregateId),
      params.fromVersion ? num(params.fromVersion) : undefined,
      limit + cursor
    )
    return events.slice(cursor, cursor + limit)
  },
}

// ============================ REGISTRATION ============================

export const coreCommandHandlers: CommandHandler[] = [
  createOrder, addOrderLine, sendToKitchen, recordPayment, closeOrder, voidOrder, setOrderNotes, setOrderTable,
  beginLine, readyLine, serveLine, assignStation, clearStation, voidOrderLine,
  compLine, compOrder, applyDiscount, applyTax, addTip, splitCheck, fireCourse, holdCourse, releaseCourse, transferLines,
  createTable, seatTable, clearTable, cleanTable, repositionTable, outOfServiceTable,
  defineItem, receiveStock, consumeStock, recordWastage, adjustStock, updateInventoryItem,
]

export const coreQueryHandlers: QueryHandler[] = [
  getOrder, getTable, getInventoryItem, getAggregateEvents,
]
