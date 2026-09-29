import { randomUUID } from "crypto"
import { AttributeBag, kernelError, StoredEvent } from "@/kernel/types"
import { defineCommand } from "@/kernel/commands/define-command"
import { QueryHandler } from "@/kernel/queries/query-bus"
import { MenuItemAggregate, MenuModifierGroupView } from "@/kernel/aggregates/menu.aggregate"
import { RosModule, ModuleRuntime } from "@/kernel/modules/module-registry"
import { defineProjection, Projection } from "@/kernel/projections/projection"
import { CommandPolicy } from "@/kernel/commands/command-bus"
import { Command } from "@/kernel/types"

export interface MenuBoardRow {
  id: string
  name: string
  categoryId: string
  price: number
  cost: number
  margin: number
  available: boolean
  eightySixed: boolean
  allergens: string[]
}

export interface MenuBoardState extends AttributeBag {
  items: MenuBoardRow[]
}

export function menuBoardProjection(
  store: ModuleRuntime["events"],
  tenant: ModuleRuntime["tenant"]
): Projection<MenuBoardState> {
  return defineProjection<MenuBoardState>(
    {
      name: "menu.board",
      initial: { items: [] },
      watchedEventTypes: [
        "menu.itemCreated",
        "menu.priceChanged",
        "menu.availabilityChanged",
        "menu.eightySixed",
        "menu.eightySixCleared",
        "menu.modifierGroupAdded",
      ],
      reduce: (state, event: StoredEvent): MenuBoardState => {
        const items = [...state.items]
        const idx = items.findIndex((i) => i.id === event.aggregateId)
        const p = event.payload as Record<string, unknown>
        const base: MenuBoardRow =
          idx >= 0
            ? items[idx]
            : { id: event.aggregateId, name: "", categoryId: "", price: 0, cost: 0, margin: 0, available: true, eightySixed: false, allergens: [] }
        const next: MenuBoardRow = { ...base }
        switch (event.eventType) {
          case "menu.itemCreated":
            next.name = String(p.name ?? "")
            next.categoryId = String(p.categoryId ?? "")
            next.price = Number(p.basePrice ?? 0)
            next.cost = Number(p.cost ?? 0)
            next.allergens = (p.allergens as string[]) ?? []
            break
          case "menu.priceChanged":
            next.price = Number(p.basePrice ?? next.price)
            break
          case "menu.availabilityChanged":
            next.available = Boolean(p.available)
            break
          case "menu.eightySixed":
            next.eightySixed = true
            next.available = false
            break
          case "menu.eightySixCleared":
            next.eightySixed = false
            next.available = true
            break
        }
        next.margin = next.price - next.cost
        if (idx >= 0) items[idx] = next
        else items.push(next)
        return { items }
      },
    },
    store,
    tenant
  )
}

const createItem = defineCommand({
  commandType: "menu.createItem",
  requiredPermission: "menu:manage",
  async execute(ctx) {
    const id = (ctx.payload.itemId as string) ?? randomUUID()
    const agg = MenuItemAggregate.create(ctx.tenant, {
      id,
      actor: ctx.actor,
      name: String(ctx.payload.name ?? ""),
      categoryId: String(ctx.payload.categoryId ?? ""),
      basePrice: Number(ctx.payload.basePrice ?? 0),
      cost: ctx.payload.cost ? Number(ctx.payload.cost) : undefined,
      image: ctx.payload.image ? String(ctx.payload.image) : undefined,
      allergens: ctx.payload.allergens as string[] | undefined,
    })
    await ctx.commit(agg)
    return id
  },
})

const changePrice = defineCommand({
  commandType: "menu.changePrice",
  requiredPermission: "menu:manage",
  async execute(ctx) {
    const id = String(ctx.payload.itemId)
    const agg = await ctx.load<MenuItemAggregate>(MenuItemAggregate.TYPE, id)
    agg.changePrice(ctx.actor, Number(ctx.payload.price))
    await ctx.commit(agg)
    return id
  },
})

const setAvailability = defineCommand({
  commandType: "menu.setAvailability",
  requiredPermission: "menu:manage",
  async execute(ctx) {
    const id = String(ctx.payload.itemId)
    const agg = await ctx.load<MenuItemAggregate>(MenuItemAggregate.TYPE, id)
    agg.setAvailability(ctx.actor, Boolean(ctx.payload.available))
    await ctx.commit(agg)
    return id
  },
})

const eightySix = defineCommand({
  commandType: "menu.eightySix",
  requiredPermission: "menu:manage",
  async execute(ctx) {
    const id = String(ctx.payload.itemId)
    const agg = await ctx.load<MenuItemAggregate>(MenuItemAggregate.TYPE, id)
    agg.eightySix(ctx.actor, String(ctx.payload.reason ?? "out of stock"))
    await ctx.commit(agg)
    return id
  },
})

const clearEightySix = defineCommand({
  commandType: "menu.clearEightySix",
  requiredPermission: "menu:manage",
  async execute(ctx) {
    const id = String(ctx.payload.itemId)
    const agg = await ctx.load<MenuItemAggregate>(MenuItemAggregate.TYPE, id)
    agg.clearEightySix(ctx.actor)
    await ctx.commit(agg)
    return id
  },
})

const addModifierGroup = defineCommand({
  commandType: "menu.addModifierGroup",
  requiredPermission: "menu:manage",
  async execute(ctx) {
    const id = String(ctx.payload.itemId)
    const agg = await ctx.load<MenuItemAggregate>(MenuItemAggregate.TYPE, id)
    agg.addModifierGroup(ctx.actor, ctx.payload.group as Omit<MenuModifierGroupView, "groupId"> & { groupId?: string })
    await ctx.commit(agg)
    return id
  },
})

/**
 * Cross-module policy: an order line cannot reference an item that is 86'd.
 * This is the flagship example of a module enforcing a rule on *another* module's
 * command — impossible in a monolithic POS where order logic and menu logic are
 * tangled in the same file.
 */
export const noSoldItems86dPolicy: CommandPolicy = {
  id: "ros.menu.noSoldItems86d",
  async check(command: Command, deps) {
    if (command.commandType !== "order.addLine") return null
    const menuItemId = command.payload.menuItemId as string | undefined
    if (!menuItemId) return null
    const agg = await deps.repository.read<MenuItemAggregate>(MenuItemAggregate.TYPE, deps.tenant, menuItemId)
    // Unknown item id is a referential concern, not this module's; only veto
    // items the venue has explicitly made unsellable (86'd / unavailable).
    if (agg.version === 0) return null
    if (!agg.sellable()) {
      return kernelError(
        "MENU_ITEM_UNAVAILABLE",
        agg.state.eightySixed
          ? `"${agg.state.name}" is 86'd${agg.state.eightySixReason ? `: ${agg.state.eightySixReason}` : ""}`
          : `"${agg.state.name}" is not available`
      )
    }
    return null
  },
}

const getItem: QueryHandler = {
  queryType: "get.menuItem",
  requiredPermission: "menu:view",
  async handle(params, ctx) {
    const agg = await ctx.repository.load<MenuItemAggregate>(MenuItemAggregate.TYPE, ctx.tenant, String(params.itemId))
    return { id: agg.id, version: agg.version, state: agg.state, sellable: agg.sellable(), margin: agg.margin() }
  },
}

const listMenu: QueryHandler = {
  queryType: "list.menu",
  requiredPermission: "menu:view",
  async handle(_params, ctx) {
    return ctx.projections.get<MenuBoardState>("menu.board").state.items
  },
}

const listSellable: QueryHandler = {
  queryType: "list.menu.sellable",
  requiredPermission: "menu:view",
  async handle(_params, ctx) {
    return ctx.projections.get<MenuBoardState>("menu.board").state.items.filter((i) => i.available && !i.eightySixed)
  },
}

export function menuModule(): RosModule {
  return {
    id: "ros.menu",
    name: "Menu",
    version: "1.0.0",
    capabilities: {
      commands: [
        "menu.createItem", "menu.changePrice", "menu.setAvailability",
        "menu.eightySix", "menu.clearEightySix", "menu.addModifierGroup",
      ],
      queries: ["get.menuItem", "list.menu", "list.menu.sellable"],
      eventTypes: [
        "menu.itemCreated", "menu.priceChanged", "menu.availabilityChanged",
        "menu.eightySixed", "menu.eightySixCleared", "menu.modifierGroupAdded",
      ],
    },
    lifecycle: {
      async install(runtime: ModuleRuntime) {
        runtime.projections.register(menuBoardProjection(runtime.events, runtime.tenant))
      },
      async activate(runtime: ModuleRuntime) {
        runtime.commands.register(createItem)
        runtime.commands.register(changePrice)
        runtime.commands.register(setAvailability)
        runtime.commands.register(eightySix)
        runtime.commands.register(clearEightySix)
        runtime.commands.register(addModifierGroup)
        runtime.commands.use(noSoldItems86dPolicy)
        runtime.queries.register(getItem)
        runtime.queries.register(listMenu)
        runtime.queries.register(listSellable)
      },
      async deactivate(runtime: ModuleRuntime) {
        runtime.commands.removePolicy?.(noSoldItems86dPolicy.id)
      },
    },
  }
}
