import { ActorContext, AttributeBag, Id, kernelError, TenantContext } from "@/kernel/types"
import { Aggregate, AggregateEvent } from "./aggregate"

export interface VenueState extends AttributeBag {
  name: string
  orgId: Id
  timezone: string
  currency: string
  address: string | null
  phone: string | null
  isActive: boolean
  /** Tax rate as a decimal fraction (0–1). Null until configured by the owner. */
  taxRate: number | null
  serviceModel: "table" | "counter" | "both"
  tableCount: number
  slaMinutes: number
  /** Default gratuity/service-charge rate as a fraction (0–1). */
  gratuityRate: number
  /** Solo-operator mode: collapse the UI to order/kitchen/cash essentials. */
  soloMode: boolean
  /**
   * Venue-enabled module keys (client vocabulary, e.g. "reservations").
   * Null means all modules. Persisted here so every device shares the same
   * progressive-disclosure state; localStorage remains the offline cache.
   */
  enabledModules: string[] | null
}

export interface NewVenue {
  name: string
  orgId?: Id
  timezone?: string
  currency?: string
  address?: string
  phone?: string
  taxRate?: number
  serviceModel?: VenueState["serviceModel"]
  tableCount?: number
  slaMinutes?: number
  gratuityRate?: number
  soloMode?: boolean
  enabledModules?: string[] | null
}

/**
 * A venue (a physical site within an organisation). Previously the venue
 * switcher was fed by a mock REST endpoint with no table behind it; making the
 * venue a first-class event-sourced aggregate gives the switcher a real,
 * shared read model and a write path for future venue management.
 */
export class VenueAggregate extends Aggregate<VenueState> {
  static readonly TYPE = "Venue"

  constructor(tenant: TenantContext) {
    super(VenueAggregate.TYPE, tenant, {
      name: "",
      orgId: "",
      timezone: "UTC",
      currency: "USD",
      address: null,
      phone: null,
      isActive: true,
      taxRate: null,
      serviceModel: "table",
      tableCount: 0,
      slaMinutes: 20,
      gratuityRate: 0,
      soloMode: false,
      enabledModules: null,
    })
  }

  static create(tenant: TenantContext, opts: NewVenue & { id: Id; actor: ActorContext }): VenueAggregate {
    const agg = new VenueAggregate(tenant)
    agg.initialize(opts.id)
    if (!opts.name?.trim()) throw kernelError("INVALID_VENUE", "Venue name is required")
    assertVenueConfig(opts as unknown as Record<string, unknown>)
    agg.raise(
      "venue.created",
      {
        name: opts.name.trim(),
        orgId: opts.orgId ?? tenant.orgId,
        timezone: opts.timezone ?? "UTC",
        currency: opts.currency ?? "USD",
        address: opts.address ?? null,
        phone: opts.phone ?? null,
        isActive: true,
        taxRate: opts.taxRate ?? null,
        serviceModel: opts.serviceModel ?? "table",
        tableCount: opts.tableCount ?? 0,
        slaMinutes: opts.slaMinutes ?? 20,
        gratuityRate: opts.gratuityRate ?? 0,
        soloMode: opts.soloMode ?? false,
        enabledModules: opts.enabledModules ?? null,
      },
      opts.actor,
    )
    return agg
  }

  /** Apply a partial change. Callers must omit keys they are not changing, or a
   *  literal `undefined` would overwrite the current value on replay. */
  update(actor: ActorContext, patch: AttributeBag): void {
    if (patch.name != null && !String(patch.name).trim()) {
      throw kernelError("INVALID_VENUE", "Venue name cannot be blank")
    }
    assertVenueConfig(patch)
    this.raise("venue.updated", patch, actor)
  }

  protected applyEvent(event: AggregateEvent): VenueState {
    switch (event.eventType) {
      case "venue.created":
      case "venue.updated":
        return { ...this.state, ...event.payload } as VenueState
      case "venue.taxConfigured":
        return {
          ...this.state,
          taxRate: Number(event.payload.taxRate),
          currency:
            event.payload.currency != null ? String(event.payload.currency) : this.state.currency,
        }
      default:
        return this.state
    }
  }

  /** Server-authoritative tax configuration. Rate is a fraction (0–1). */
  configureTax(actor: ActorContext, taxRate: number, currency?: string): void {
    if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 1) {
      throw kernelError("INVALID_TAX", "Tax rate must be between 0 and 1")
    }
    this.raise("venue.taxConfigured", { taxRate, currency: currency ?? this.state.currency }, actor)
  }
}

/** Shared validation for venue fiscal/service configuration. */
function assertVenueConfig(patch: Record<string, unknown>): void {
  if (patch.taxRate != null) {
    const r = Number(patch.taxRate)
    if (!Number.isFinite(r) || r < 0 || r > 1) throw kernelError("INVALID_TAX", "Tax rate must be between 0 and 1")
  }
  if (patch.serviceModel != null) {
    const m = String(patch.serviceModel)
    if (m !== "table" && m !== "counter" && m !== "both") {
      throw kernelError("INVALID_VENUE", "serviceModel must be table, counter or both")
    }
  }
  if (patch.tableCount != null) {
    const n = Number(patch.tableCount)
    if (!Number.isFinite(n) || n < 0) throw kernelError("INVALID_VENUE", "tableCount cannot be negative")
  }
  if (patch.slaMinutes != null) {
    const n = Number(patch.slaMinutes)
    if (!Number.isFinite(n) || n < 1 || n > 180) {
      throw kernelError("INVALID_VENUE", "slaMinutes must be between 1 and 180")
    }
  }
  if (patch.gratuityRate != null) {
    const r = Number(patch.gratuityRate)
    if (!Number.isFinite(r) || r < 0 || r > 1) {
      throw kernelError("INVALID_TAX", "Gratuity rate must be between 0 and 1")
    }
  }
  if (patch.soloMode != null && typeof patch.soloMode !== "boolean") {
    throw kernelError("INVALID_VENUE", "soloMode must be a boolean")
  }
  if (patch.enabledModules != null) {
    if (!Array.isArray(patch.enabledModules)) {
      throw kernelError("INVALID_VENUE", "enabledModules must be an array of module keys or null")
    }
    if (patch.enabledModules.length > 20) {
      throw kernelError("INVALID_VENUE", "enabledModules holds at most 20 entries")
    }
    for (const m of patch.enabledModules) {
      if (typeof m !== "string" || !m.trim() || m.length > 40) {
        throw kernelError("INVALID_VENUE", "enabledModules must be non-empty strings")
      }
    }
  }
}
