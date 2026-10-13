import { InventoryItemAggregate } from "./inventory.aggregate"
import { KitchenStationAggregate } from "./kitchen-station.aggregate"
import { MenuItemAggregate } from "./menu.aggregate"
import { OrderAggregate } from "./order.aggregate"
import { PaymentIntentAggregate } from "./payment.aggregate"
import { PlatformOrderAggregate } from "./platform-order.aggregate"
import { ReservationAggregate } from "./reservation.aggregate"
import { StaffShiftAggregate } from "./shift.aggregate"
import { TableAggregate } from "./table.aggregate"
import { WaitlistAggregate } from "./waitlist.aggregate"
import { VenueAggregate } from "./venue.aggregate"
import { CustomerAggregate } from "./customer.aggregate"
import { GiftCardAggregate } from "./gift-card.aggregate"
import { PromotionAggregate } from "./promotion.aggregate"
import { CashDrawerAggregate } from "./cash-drawer.aggregate"
import { registerAggregate } from "./registry"

registerAggregate(OrderAggregate.TYPE, OrderAggregate)
registerAggregate(TableAggregate.TYPE, TableAggregate)
registerAggregate(InventoryItemAggregate.TYPE, InventoryItemAggregate)
registerAggregate(KitchenStationAggregate.TYPE, KitchenStationAggregate)
// Phase 2 domain aggregates; their modules also re-register idempotently.
registerAggregate(ReservationAggregate.TYPE, ReservationAggregate)
registerAggregate(WaitlistAggregate.TYPE, WaitlistAggregate)
registerAggregate(MenuItemAggregate.TYPE, MenuItemAggregate)
registerAggregate(StaffShiftAggregate.TYPE, StaffShiftAggregate)
// Phase 3: marketplace order injection.
registerAggregate(PlatformOrderAggregate.TYPE, PlatformOrderAggregate)
registerAggregate(PaymentIntentAggregate.TYPE, PaymentIntentAggregate)
// Venue registry, loyalty, stored value, marketing.
registerAggregate(VenueAggregate.TYPE, VenueAggregate)
registerAggregate(CustomerAggregate.TYPE, CustomerAggregate)
registerAggregate(GiftCardAggregate.TYPE, GiftCardAggregate)
registerAggregate(PromotionAggregate.TYPE, PromotionAggregate)
registerAggregate(CashDrawerAggregate.TYPE, CashDrawerAggregate)

export {
  OrderAggregate,
  TableAggregate,
  InventoryItemAggregate,
  KitchenStationAggregate,
  ReservationAggregate,
  WaitlistAggregate,
  MenuItemAggregate,
  StaffShiftAggregate,
  PlatformOrderAggregate,
  PaymentIntentAggregate,
  VenueAggregate,
  CustomerAggregate,
  GiftCardAggregate,
  PromotionAggregate,
  CashDrawerAggregate,
}
export { platformOrderId } from "./platform-order.aggregate"
export type { PlatformOrderState } from "./platform-order.aggregate"
export * from "./aggregate"
export * from "./registry"
export * from "./repository"
