import { randomUUID } from "crypto"
import { AttributeBag, kernelError, StoredEvent } from "@/kernel/types"
import { defineCommand } from "@/kernel/commands/define-command"
import { QueryHandler } from "@/kernel/queries/query-bus"
import { WaitlistAggregate } from "@/kernel/aggregates/waitlist.aggregate"
import { RosModule, ModuleRuntime } from "@/kernel/modules/module-registry"
import { defineProjection, Projection } from "@/kernel/projections/projection"
import { TableBoardState } from "@/kernel/projections/builtins"

export interface WaitlistRow {
  id: string
  customerName: string
  phone: string | null
  partySize: number
  status: string
  position: number
  joinedAt: string
  notifiedAt: string | null
}

export interface WaitlistBoardState extends AttributeBag {
  queue: WaitlistRow[]
}

export function waitlistBoardProjection(
  store: ModuleRuntime["events"],
  tenant: ModuleRuntime["tenant"]
): Projection<WaitlistBoardState> {
  return defineProjection<WaitlistBoardState>(
    {
      name: "waitlist.board",
      initial: { queue: [] },
      watchedEventTypes: ["waitlist.joined", "waitlist.notified", "waitlist.seated", "waitlist.removed", "waitlist.noShow"],
      reduce: (state, event: StoredEvent): WaitlistBoardState => {
        let queue = [...state.queue]
        const idx = queue.findIndex((r) => r.id === event.aggregateId)
        const p = event.payload as Record<string, unknown>
        switch (event.eventType) {
          case "waitlist.joined": {
            const position = queue.filter((r) => r.status === "waiting" || r.status === "notified").length + 1
            queue.push({
              id: event.aggregateId,
              customerName: String(p.customerName ?? ""),
              phone: (p.phone as string) ?? null,
              partySize: Number(p.partySize ?? 1),
              status: "waiting",
              position,
              joinedAt: String(p.joinedAt ?? event.occurredAt),
              notifiedAt: null,
            })
            break
          }
          case "waitlist.notified":
            if (idx >= 0) queue[idx] = { ...queue[idx], status: "notified", notifiedAt: String(p.notifiedAt ?? event.occurredAt) }
            break
          case "waitlist.seated":
          case "waitlist.removed":
          case "waitlist.noShow":
            queue = queue.filter((r) => r.id !== event.aggregateId)
            break
        }
        // re-dense positions on every change
        queue = queue.map((r, i) => ({ ...r, position: i + 1 }))
        return { queue }
      },
    },
    store,
    tenant
  )
}

const join = defineCommand({
  commandType: "waitlist.join",
  requiredPermission: "waitlist:manage",
  async execute(ctx) {
    const id = (ctx.payload.entryId as string) ?? randomUUID()
    const queue = ctx.projections.get<WaitlistBoardState>("waitlist.board").state.queue
    const agg = WaitlistAggregate.join(ctx.tenant, {
      id,
      actor: ctx.actor,
      customerName: String(ctx.payload.customerName ?? ""),
      partySize: Number(ctx.payload.partySize ?? 1),
      phone: ctx.payload.phone ? String(ctx.payload.phone) : undefined,
      notes: ctx.payload.notes ? String(ctx.payload.notes) : undefined,
      position: queue.filter((r) => r.status === "waiting" || r.status === "notified").length + 1,
    })
    await ctx.commit(agg)
    return id
  },
})

const notify = defineCommand({
  commandType: "waitlist.notify",
  requiredPermission: "waitlist:manage",
  async execute(ctx) {
    const id = String(ctx.payload.entryId)
    const agg = await ctx.load<WaitlistAggregate>(WaitlistAggregate.TYPE, id)
    agg.notify(ctx.actor)
    await ctx.commit(agg)
    return id
  },
})

const seat = defineCommand({
  commandType: "waitlist.seat",
  requiredPermission: "waitlist:manage",
  async execute(ctx) {
    const id = String(ctx.payload.entryId)
    const tableId = String(ctx.payload.tableId)
    // Cross-module guard: only seat onto a table the floor plan reports as available.
    const board = ctx.projections.get<TableBoardState>("tables.board")
    if (board.state.rows.length > 0) {
      const row = board.state.rows.find((r) => r.tableId === tableId)
      if (row && row.status !== "available") {
        throw kernelError("TABLE_NOT_AVAILABLE", `Table is ${row.status}`)
      }
    }
    const agg = await ctx.load<WaitlistAggregate>(WaitlistAggregate.TYPE, id)
    agg.seat(ctx.actor, tableId)
    await ctx.commit(agg)
    return id
  },
})

const remove = defineCommand({
  commandType: "waitlist.remove",
  requiredPermission: "waitlist:manage",
  async execute(ctx) {
    const id = String(ctx.payload.entryId)
    const agg = await ctx.load<WaitlistAggregate>(WaitlistAggregate.TYPE, id)
    agg.remove(ctx.actor, ctx.payload.reason ? String(ctx.payload.reason) : undefined)
    await ctx.commit(agg)
    return id
  },
})

const getEntry: QueryHandler = {
  queryType: "get.waitlistEntry",
  requiredPermission: "waitlist:view",
  async handle(params, ctx) {
    const agg = await ctx.repository.load<WaitlistAggregate>(WaitlistAggregate.TYPE, ctx.tenant, String(params.entryId))
    return { id: agg.id, version: agg.version, state: agg.state }
  },
}

const listQueue: QueryHandler = {
  queryType: "list.waitQueue",
  requiredPermission: "waitlist:view",
  async handle(_params, ctx) {
    return ctx.projections.get<WaitlistBoardState>("waitlist.board").state.queue
  },
}

export function waitlistModule(): RosModule {
  return {
    id: "ros.waitlist",
    name: "Waitlist",
    version: "1.0.0",
    capabilities: {
      commands: ["waitlist.join", "waitlist.notify", "waitlist.seat", "waitlist.remove"],
      queries: ["get.waitlistEntry", "list.waitQueue"],
      eventTypes: ["waitlist.joined", "waitlist.notified", "waitlist.seated", "waitlist.removed", "waitlist.noShow"],
    },
    lifecycle: {
      async install(runtime: ModuleRuntime) {
        runtime.projections.register(waitlistBoardProjection(runtime.events, runtime.tenant))
      },
      async activate(runtime: ModuleRuntime) {
        runtime.commands.register(join)
        runtime.commands.register(notify)
        runtime.commands.register(seat)
        runtime.commands.register(remove)
        runtime.queries.register(getEntry)
        runtime.queries.register(listQueue)
      },
    },
  }
}
