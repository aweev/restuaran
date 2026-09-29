import { InventoryItemAggregate } from "./inventory.aggregate"
import { MenuItemAggregate } from "./menu.aggregate"
import { OrderAggregate } from "./order.aggregate"
import { PlatformOrderAggregate } from "./platform-order.aggregate"
import { ReservationAggregate } from "./reservation.aggregate"
import { StaffShiftAggregate } from "./shift.aggregate"
import { TableAggregate } from "./table.aggregate"
import { WaitlistAggregate } from "./waitlist.aggregate"
import { registerAggregate } from "./registry"

registerAggregate(OrderAggregate.TYPE, OrderAggregate)
registerAggregate(TableAggregate.TYPE, TableAggregate)
registerAggregate(InventoryItemAggregate.TYPE, InventoryItemAggregate)
// Phase 2 domain aggregates; their modules also re-register idempotently.
registerAggregate(ReservationAggregate.TYPE, ReservationAggregate)
registerAggregate(WaitlistAggregate.TYPE, WaitlistAggregate)
registerAggregate(MenuItemAggregate.TYPE, MenuItemAggregate)
registerAggregate(StaffShiftAggregate.TYPE, StaffShiftAggregate)
// Phase 3: marketplace order injection.
registerAggregate(PlatformOrderAggregate.TYPE, PlatformOrderAggregate)

export {
  OrderAggregate,
  TableAggregate,
  InventoryItemAggregate,
  ReservationAggregate,
  WaitlistAggregate,
  MenuItemAggregate,
  StaffShiftAggregate,
  PlatformOrderAggregate,
}
export { platformOrderId } from "./platform-order.aggregate"
export type { PlatformOrderState } from "./platform-order.aggregate"
export * from "./aggregate"
export * from "./registry"
export * from "./repository"
