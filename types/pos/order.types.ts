// types/pos/order.types.ts
import { DiningMode, CartItemModifierSelection } from './cart.types'; 
import { Table } from './table-management.types';
import { User } from './auth.types';
import { Customer } from './customer.types';
import { Location } from './multi-location.types';
import { PaymentDetails, PaymentStatus as POSPaymentStatus } from './payments.types'; // Renaming for clarity
import { Promotion } from './marketing.types'; // For applied promotions
import { TaxSetting } from './accounting.types'; // For tax breakdown
import { RestaurantDeliveryInfo } from './customer.types'; // For restaurant-managed deliveries

export interface OrderItem {
  id: string; // Unique ID for this order item instance (can be same as CartItem.id if cart becomes order)
  orderId: Order['id'];
  menuItemId: string; // From original CartItem.menuItemId
  itemNameSnapshot: string; // From CartItem.itemName (name at time of order)
  itemImageSnapshot?: string; // From CartItem.itemImage
  itemFoodTypeSnapshot?: string; // From CartItem.itemFoodType, use FoodType from menu.types

  quantity: number;
  unitPriceSnapshot: number; // Price per unit at time of order (from CartItem.unitPrice)

  selectedModifiersSnapshot: CartItemModifierSelection[]; // From CartItem.selectedModifiers
  modifierTotalPriceSnapshot: number; // From CartItem.modifierTotalPrice

  // Price before item-specific discounts
  itemSubtotalSnapshot: number; // From CartItem.itemSubtotal

  // Item-specific discounts applied
  itemDiscountsApplied?: {
    promotionId: Promotion['id'];
    promotionName: Promotion['name']; // Denormalized
    amount: number; // Amount discounted for this item line (already factored for quantity)
  }[];
  totalItemDiscountAmountSnapshot: number; // From CartItem.totalItemDiscountAmount

  // Net price for this line item after item-specific discounts
  netPriceSnapshot: number; // From CartItem.netPrice

  specialInstructions?: string;
  kitchenItemStatus?: string; // Detailed status from kitchen (e.g., from KitchenItemStatus in kitchen.types)
  preparationTimeMinutes?: number; // Estimated for this item
  startedPreparationAt?: Date; // When kitchen started this item
  readyAt?: Date; // When kitchen marked this item ready
  servedAt?: Date; // When server marked this item as served (for dine-in)
  course?: string; // e.g., "Appetizers", "Mains"
  seatNumber?: number; // For dine-in item assignment
  notes?: string; // Additional notes specific to this item in the order
  addedToOrderAt: Date;
  addedByUserId?: User['id'];
  voided?: boolean;
  voidedAt?: Date;
  voidedByUserId?: User['id'];
  voidReason?: string;
  costOfGoodsSold?: number; // Can be calculated and stored here for reporting
}

export type OrderStatus =
  | "draft" // Order being built in cart, not yet placed
  | "pending_confirmation" // Submitted, awaiting kitchen/staff confirmation (e.g., online orders)
  | "confirmed_accepted" // Accepted by restaurant
  | "preparation_in_progress"
  | "partially_ready" // Some items are ready
  | "ready_for_pickup" // For takeaway
  | "ready_for_service" // For dine-in items ready at pass
  | "out_for_delivery" // For delivery
  | "served_at_table" // All dine-in items served
  | "delivered_to_customer"
  | "completed_paid" // Order finished and fully paid
  | "completed_unpaid" // Order finished, but payment pending/failed (rare, needs handling)
  | "cancelled_by_customer"
  | "cancelled_by_restaurant"
  | "voided" // Erroneous order, not fulfilled, not counted in sales typically
  | "on_hold"; // Order processing paused

export interface Order {
  id: string;
  restaurantId: string;
  locationId: Location['id'];
  orderNumber: string; // User-friendly, sequential or unique per day/location
  externalOrderId?: string; // If order came from a platform (e.g., PlatformOrder['id'])
  orderSource: "pos_manual_entry" | "online_platform" | "kiosk" | "phone_in" | "table_self_order";

  customerId?: Customer['id'];
  customerNameSnapshot?: string; // Snapshot of customer name (even if not in DB)
  customerPhoneNumberSnapshot?: string;
  customerEmailSnapshot?: string;

  diningMode: DiningMode;
  tableId?: Table['id']; // If dine-in
  numberOfGuests?: number; // Party size

  items: OrderItem[];
  totalQuantityOfItems: number; // Sum of OrderItem.quantity

  // Financial Summary (Snapshotted from Cart at time of order placement)
  subtotalAmount: number; // Sum of all OrderItem.netPriceSnapshot
  orderLevelDiscountsApplied?: {
    promotionId: Promotion['id'];
    promotionName: Promotion['name'];
    codeApplied?: string;
    amount: number;
  }[];
  totalOrderDiscountAmount: number;
  discountedSubtotalAmount: number; // subtotalAmount - totalOrderDiscountAmount

  taxesApplied?: {
    taxSettingId: TaxSetting['id'];
    taxName: TaxSetting['name'];
    rate: TaxSetting['rate'];
    amountAppliedToOrder: number;
  }[];
  totalTaxAmount: number;

  serviceChargeApplied?: {
    name: string;
    rate?: number;
    fixedAmount?: number;
    amount: number;
  };
  tipAmount: number;
  grandTotalAmount: number; // Final amount due/paid

  // Payment Status
  amountPaid: number;
  balanceDue: number; // grandTotalAmount - amountPaid
  paymentStatus: POSPaymentStatus; // pending, completed, failed, refunded, partially_paid
  payments: PaymentDetails[]; // Array of payment transactions made for this order

  // Order Status & Workflow
  status: OrderStatus;
  statusHistory?: {
    status: OrderStatus;
    timestamp: Date;
    changedByUserId?: User['id'];
    notes?: string;
  }[];
  estimatedPreparationMinutes?: number; // Overall order prep time
  scheduledPickupTime?: Date; // For takeaway
  scheduledDeliveryTime?: Date; // For delivery
  orderPlacedAt: Date; // When the order was officially placed/confirmed
  preparationStartedAt?: Date;
  readyAt?: Date; // When the entire order is ready
  servedOrDeliveredAt?: Date; // When order was fully served or delivered
  completedAt?: Date; // When order is fully processed (paid and served/delivered)
  voidedAt?: Date;
  voidedByUserId?: User['id'];
  voidReason?: string;

  // Staff Assignment
  createdByUserId: User['id']; // Staff who created/took the order
  serverUserId?: User['id']; // Primary server for dine-in
  cashierUserId?: User['id']; // Staff who processed final payment(s)

  // Delivery Details (if applicable and managed by restaurant)
  restaurantDeliveryInfoId?: RestaurantDeliveryInfo['id'];

  // Notes & Communication
  notesForKitchen?: string;
  notesForCustomer?: string; // e.g., special instructions printed on receipt
  internalNotes?: string;

  // System Fields
  createdAt: Date; // When the record was created (usually same as orderPlacedAt)
  updatedAt: Date;
  updatedByUserId?: User['id'];
}

export interface UpdateOrderStatusDTO {
  orderId: Order['id'];
  newStatus: OrderStatus;
  notes?: string;
  userId: User['id']; // User making the change
}

export interface OrderEvent {
  type: "ORDER_CREATED" | "ORDER_UPDATED" | "ORDER_DELETED" | "ORDER_STATUS_CHANGED";
  restaurantId: string;
  locationId: string;
  payload: Order | { orderId: string; updates: Partial<Order>; changedByUserId?: string };
}

export interface OrderItemEvent {
  type: "ORDER_ITEM_ADDED" | "ORDER_ITEM_UPDATED" | "ORDER_ITEM_REMOVED";
  restaurantId: string;
  locationId: string;
  payload: { orderId: string; orderItem: OrderItem; updates?: Partial<OrderItem>; changedByUserId?: string };
}

export interface OrderStateUI {
  orders: Order[];
  activeOrders: Order[];
  completedOrders: Order[];
  isLoading: boolean;
  error: string | null;
  selectedOrder: Order | null;
}
