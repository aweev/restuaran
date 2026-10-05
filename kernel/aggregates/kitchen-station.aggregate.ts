import { ActorContext, AttributeBag, Id, kernelError, TenantContext } from "@/kernel/types"
import { Aggregate, AggregateEvent } from "./aggregate"

export interface KitchenStationState extends AttributeBag {
  staffId: Id
  station: string | null
  assignedAt: string | null
  updatedAt: string | null
}

/**
 * Who works which KDS station. Keyed by staff id (not shift): the dinner
 * rush reassigns stations without touching the time clock, so this stream is
 * deliberately independent of StaffShift. `staff.board` folds
 * `kitchen.stationAssigned` onto roster rows and materializes a presence row
 * when the staffer has no scheduled shift yet.
 */
export class KitchenStationAggregate extends Aggregate<KitchenStationState> {
  static readonly TYPE = "KitchenStation"

  constructor(tenant: TenantContext) {
    super(KitchenStationAggregate.TYPE, tenant, {
      staffId: "",
      station: null,
      assignedAt: null,
      updatedAt: null,
    })
  }

  assign(actor: ActorContext, staffId: Id, station: string): void {
    if (!staffId?.trim()) throw kernelError("INVALID_STATION", "Staff id is required")
    if (!station?.trim()) throw kernelError("INVALID_STATION", "Station is required")
    this.raise(
      "kitchen.stationAssigned",
      { staffId, station: station.trim(), assignedAt: new Date().toISOString() },
      actor,
    )
  }

  clear(actor: ActorContext): void {
    if (!this.state.station) throw kernelError("NOT_ASSIGNED", "No station assignment to clear")
    this.raise("kitchen.stationCleared", { staffId: this.id, station: null }, actor)
  }

  protected applyEvent(event: AggregateEvent): KitchenStationState {
    const s = this.state
    switch (event.eventType) {
      case "kitchen.stationAssigned":
      case "kitchen.stationCleared":
        return { ...s, ...(event.payload as Partial<KitchenStationState>), updatedAt: event.occurredAt }
      default:
        return s
    }
  }
}
