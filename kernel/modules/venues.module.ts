import { randomUUID } from "crypto"
import { AttributeBag, StoredEvent } from "@/kernel/types"
import { defineCommand } from "@/kernel/commands/define-command"
import { QueryHandler } from "@/kernel/queries/query-bus"
import { VenueAggregate } from "@/kernel/aggregates/venue.aggregate"
import { RosModule, ModuleRuntime } from "@/kernel/modules/module-registry"
import { defineProjection, Projection, maybePaginate } from "@/kernel/projections/projection"

export interface VenueBoardRow {
  id: string
  name: string
  orgId: string
  timezone: string
  currency: string
  address: string | null
  phone: string | null
  isActive: boolean
  taxRate: number | null
  serviceModel: "table" | "counter" | "both"
  tableCount: number
  slaMinutes: number
  gratuityRate: number
  soloMode: boolean
  enabledModules: string[] | null
}

export interface VenuesBoardState extends AttributeBag {
  venues: VenueBoardRow[]
}

/**
 * The venue read model.
 *
 * Venues are organisation configuration that predates the event store and there
 * is no `Venue` table to replay from. Rather than ship an empty switcher, the
 * board is seeded with the venue set the app used to return from `/api/venues`;
 * every `venue.created` / `venue.updated` event then layers on top, so the board
 * is a genuine projection (shared and auditable) rather than a per-client mock.
 */
const DEFAULT_VENUES: VenueBoardRow[] = [
  {
    id: "venue-1", name: "Maison Chili", orgId: "org-1", timezone: "America/New_York", currency: "USD",
    address: "123 Main St, New York, NY 10001", phone: "+1-212-555-0100", isActive: true,
    taxRate: null, serviceModel: "table", tableCount: 14, slaMinutes: 20, gratuityRate: 0,
    soloMode: false, enabledModules: null,
  },
  {
    id: "venue-2", name: "Maison Chili - Downtown", orgId: "org-1", timezone: "America/New_York", currency: "USD",
    address: "456 Broadway, New York, NY 10003", phone: "+1-212-555-0200", isActive: true,
    taxRate: null, serviceModel: "table", tableCount: 10, slaMinutes: 20, gratuityRate: 0,
    soloMode: false, enabledModules: null,
  },
]

export function venuesBoardProjection(
  store: ModuleRuntime["events"],
  tenant: ModuleRuntime["tenant"],
): Projection<VenuesBoardState> {
  return defineProjection<VenuesBoardState>(
    {
      name: "venues.board",
      initial: { venues: DEFAULT_VENUES },
      watchedEventTypes: ["venue.created", "venue.updated", "venue.taxConfigured"],
      reduce: (state, event: StoredEvent): VenuesBoardState => {
        const p = event.payload as Record<string, unknown>
        const venues = [...state.venues]
        const idx = venues.findIndex((v) => v.id === event.aggregateId)
        const base: VenueBoardRow =
          idx >= 0
            ? venues[idx]
            : { id: event.aggregateId, name: "", orgId: "", timezone: "UTC", currency: "USD", address: null, phone: null, isActive: true, taxRate: null, serviceModel: "table", tableCount: 0, slaMinutes: 20, gratuityRate: 0, soloMode: false, enabledModules: null }
        const serviceModel =
          p.serviceModel === "counter" || p.serviceModel === "both" || p.serviceModel === "table"
            ? (p.serviceModel as VenueBoardRow["serviceModel"])
            : base.serviceModel
        const next: VenueBoardRow = {
          ...base,
          name: p.name != null ? String(p.name) : base.name,
          orgId: p.orgId != null ? String(p.orgId) : base.orgId,
          timezone: p.timezone != null ? String(p.timezone) : base.timezone,
          currency: p.currency != null ? String(p.currency) : base.currency,
          address: p.address !== undefined ? (p.address ? String(p.address) : null) : base.address,
          phone: p.phone !== undefined ? (p.phone ? String(p.phone) : null) : base.phone,
          isActive: p.isActive !== undefined ? Boolean(p.isActive) : base.isActive,
          taxRate: p.taxRate !== undefined ? (p.taxRate == null ? null : Number(p.taxRate)) : base.taxRate,
          serviceModel,
          tableCount: p.tableCount !== undefined ? Number(p.tableCount) : base.tableCount,
          slaMinutes: p.slaMinutes !== undefined ? Number(p.slaMinutes) : base.slaMinutes,
          gratuityRate: p.gratuityRate !== undefined ? Number(p.gratuityRate) : base.gratuityRate,
          soloMode: p.soloMode !== undefined ? Boolean(p.soloMode) : base.soloMode,
          enabledModules:
            p.enabledModules !== undefined
              ? (p.enabledModules == null ? null : (Array.isArray(p.enabledModules) ? (p.enabledModules as unknown[]).map(String) : base.enabledModules))
              : base.enabledModules,
        }
        if (idx >= 0) venues[idx] = next
        else venues.push(next)
        return { venues }
      },
    },
    store,
    tenant,
  )
}

const createVenue = defineCommand({
  commandType: "venue.create",
  requiredPermission: "venue:manage",
  async execute(ctx) {
    const id = (ctx.payload.venueId as string) ?? randomUUID()
    const agg = VenueAggregate.create(ctx.tenant, {
      id,
      actor: ctx.actor,
      name: String(ctx.payload.name ?? ""),
      orgId: ctx.payload.orgId ? String(ctx.payload.orgId) : undefined,
      timezone: ctx.payload.timezone ? String(ctx.payload.timezone) : undefined,
      currency: ctx.payload.currency ? String(ctx.payload.currency) : undefined,
      address: ctx.payload.address ? String(ctx.payload.address) : undefined,
      phone: ctx.payload.phone ? String(ctx.payload.phone) : undefined,
      taxRate: ctx.payload.taxRate !== undefined ? Number(ctx.payload.taxRate) : undefined,
      serviceModel: ctx.payload.serviceModel as "table" | "counter" | "both" | undefined,
      tableCount: ctx.payload.tableCount !== undefined ? Number(ctx.payload.tableCount) : undefined,
      slaMinutes: ctx.payload.slaMinutes !== undefined ? Number(ctx.payload.slaMinutes) : undefined,
      gratuityRate: ctx.payload.gratuityRate !== undefined ? Number(ctx.payload.gratuityRate) : undefined,
      soloMode: ctx.payload.soloMode !== undefined ? (ctx.payload.soloMode as boolean) : undefined,
      enabledModules:
        ctx.payload.enabledModules !== undefined
          ? ctx.payload.enabledModules == null
            ? null
            : (ctx.payload.enabledModules as unknown[]).map(String)
          : undefined,
    })
    await ctx.commit(agg)
    return id
  },
})

const updateVenue = defineCommand({
  commandType: "venue.update",
  requiredPermission: "venue:manage",
  async execute(ctx) {
    const id = String(ctx.payload.venueId)
    const agg = await ctx.load<VenueAggregate>(VenueAggregate.TYPE, id)
    // Build the patch with only the keys actually supplied, so an absent field
    // never overwrites the stored value with `undefined`.
    const patch: AttributeBag = {}
    if (ctx.payload.name != null) patch.name = String(ctx.payload.name)
    if (ctx.payload.timezone != null) patch.timezone = String(ctx.payload.timezone)
    if (ctx.payload.currency != null) patch.currency = String(ctx.payload.currency)
    if (ctx.payload.address !== undefined) patch.address = ctx.payload.address ? String(ctx.payload.address) : null
    if (ctx.payload.phone !== undefined) patch.phone = ctx.payload.phone ? String(ctx.payload.phone) : null
    if (ctx.payload.isActive !== undefined) patch.isActive = Boolean(ctx.payload.isActive)
    if (ctx.payload.taxRate !== undefined) patch.taxRate = Number(ctx.payload.taxRate)
    if (ctx.payload.serviceModel !== undefined) patch.serviceModel = String(ctx.payload.serviceModel)
    if (ctx.payload.tableCount !== undefined) patch.tableCount = Number(ctx.payload.tableCount)
    if (ctx.payload.slaMinutes !== undefined) patch.slaMinutes = Number(ctx.payload.slaMinutes)
    if (ctx.payload.gratuityRate !== undefined) patch.gratuityRate = Number(ctx.payload.gratuityRate)
    if (ctx.payload.soloMode !== undefined) patch.soloMode = ctx.payload.soloMode as boolean
    if (ctx.payload.enabledModules !== undefined) {
      patch.enabledModules =
        ctx.payload.enabledModules == null ? null : (ctx.payload.enabledModules as unknown[]).map(String)
    }
    agg.update(ctx.actor, patch)
    await ctx.commit(agg)
    return id
  },
})

/** Dedicated fiscal command so tax changes are explicit, auditable events. */
const configureTax = defineCommand({
  commandType: "venue.configureTax",
  requiredPermission: "venue:manage",
  async execute(ctx) {
    const id = String(ctx.payload.venueId)
    const agg = await ctx.load<VenueAggregate>(VenueAggregate.TYPE, id)
    agg.configureTax(
      ctx.actor,
      Number(ctx.payload.taxRate),
      ctx.payload.currency != null ? String(ctx.payload.currency) : undefined,
    )
    await ctx.commit(agg)
    return id
  },
})

const listVenues: QueryHandler = {
  queryType: "list.venues",
  requiredPermission: "venue:view",
  async handle(params, ctx) {
    return maybePaginate(ctx.projections.get<VenuesBoardState>("venues.board").state.venues, params)
  },
}

export function venuesModule(): RosModule {
  return {
    id: "ros.venues",
    name: "Venues",
    version: "1.0.0",
    capabilities: {
      commands: ["venue.create", "venue.update", "venue.configureTax"],
      queries: ["list.venues"],
      eventTypes: ["venue.created", "venue.updated", "venue.taxConfigured"],
    },
    lifecycle: {
      async install(runtime: ModuleRuntime) {
        runtime.projections.register(venuesBoardProjection(runtime.events, runtime.tenant))
      },
      async activate(runtime: ModuleRuntime) {
        runtime.commands.register(createVenue)
        runtime.commands.register(updateVenue)
        runtime.commands.register(configureTax)
        runtime.queries.register(listVenues)
      },
    },
  }
}
