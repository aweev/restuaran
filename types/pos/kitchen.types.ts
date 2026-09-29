// types/pos/kitchen.types.ts
import { Order, OrderItem, OrderStatus as PosOrderStatus } from './order.types'; // Main POS order types
import { DiningMode } from './cart.types'; // For dining modes
// import { CartItem } from './cart.types'; // For item details on KDS
import { Table } from './table-management.types';
import { User } from './auth.types'; // For staff interactions
import { Location } from './multi-location.types';
// import { MenuItemModifierSelection } from './cart.types'; // Using CartItemModifierSelection for consistency

export type KitchenItemStatus =
  | "pending_confirmation" // New item, not yet acknowledged by kitchen
  | "acknowledged_by_kitchen" // Kitchen has seen it
  | "preparation_queued"
  | "preparing"
  | "quality_check" // Optional step
  | "ready_for_pickup" // By server for dine-in, or for packaging for takeaway/delivery
  | "on_hold" // Preparation paused
  | "cancelled_by_kitchen"
  | "issue_reported"; // e.g., ingredient unavailable

export type KitchenOrderStatus = PosOrderStatus | "partially_ready"; // Can reuse POS OrderStatus and add kitchen-specific ones

export interface KdsItem {
  id: OrderItem['id']; // Corresponds to the OrderItem ID
  kdsOrderId: string; // Corresponds to KdsOrder id
  menuItemId: OrderItem['menuItemId'];
  itemName: OrderItem['itemNameSnapshot'];
  quantity: OrderItem['quantity'];
  status: KitchenItemStatus;
  modifiersToDisplay?: {
    modifierName: string;
    optionName: string;
  }[]; // Simplified display of selected modifiers
  specialInstructions?: OrderItem['specialInstructions'];
  preparationTimeMinutes?: number; // Estimated for this item
  priority?: number; // 1 (highest) to N
  course?: string; // e.g., "Appetizers", "Mains"
  seatNumber?: number; // For dine-in
  addedAt: Date; // When this item hit the KDS
  acknowledgedAt?: Date;
  startedPreparationAt?: Date;
  readyAt?: Date;
  bumpedByUserId?: User['id']; // User who marked it ready/bumped
  timerSeconds?: number; // Countdown timer displayed on KDS
  isDelayed?: boolean;
  delayReason?: string;
}

export interface KdsOrder {
  id: Order['id']; // Corresponds to the main Order ID
  orderNumber: Order['orderNumber']; // User-friendly order number
  locationId: Location['id'];
  status: KitchenOrderStatus;
  diningMode: DiningMode;
  tableName?: Table['tableNumber']; // For dine-in
  customerName?: Order['customerNameSnapshot']; // For takeaway/delivery
  items: KdsItem[];
  orderPlacedAt: Date; // Timestamp when order was confirmed and sent to kitchen
  estimatedReadyTime?: Date;
  kitchenTicketNumber?: string; // If kitchen uses separate ticket numbers
  notesForKitchen?: Order['notesForKitchen']; // Specific notes from order meant for kitchen
  rushOrder: boolean;
  orderSource?: "pos" | "online_platform" | "kiosk"; // Where the order originated
  totalItems: number;
  itemsReady: number;
  itemsInProgress: number;
  overallTimerSeconds?: number; // Timer for the whole order
  isDelayed?: boolean;
}

export interface KdsScreenState {
  screenId: string; // Identifier for this specific KDS device/view
  locationId: Location['id'];
  filterByDiningModes?: DiningMode[]; // e.g., one KDS for dine-in, another for takeaway
  filterByCategories?: string[]; // e.g., "Hot Line", "Salad Station"
  activeOrders: KdsOrder[];
  recentlyCompletedOrders?: KdsOrder[]; // For recall functionality
  isLoading: boolean;
  error: string | null;
  lastUpdatedAt: Date;
  displaySettings?: {
    sortBy: "time_asc" | "time_desc" | "priority";
    theme: "light" | "dark";
    fontSize: "small" | "medium" | "large";
    showTimers: boolean;
    alertSoundEnabled: boolean;
  };
}

export interface KitchenOrderUpdateEventData {
  kdsOrderId: KdsOrder['id'];
  newStatus?: KitchenOrderStatus;
  updatedItemsStatus?: { itemId: KdsItem['id'], newStatus: KitchenItemStatus }[];
  estimatedReadyTime?: Date;
  // Any other fields from KdsOrder that can be updated
}

export interface KitchenItemUpdateEventData {
  kdsOrderId: KdsOrder['id'];
  kdsItemId: KdsItem['id'];
  newStatus: KitchenItemStatus;
  startedPreparationAt?: Date;
  readyAt?: Date;
  bumpedByUserId?: User['id'];
}

export type KitchenEventType =
  | "KDS_ORDER_NEW" // A new order appears on KDS
  | "KDS_ORDER_UPDATED" // Status of whole order or multiple items change
  | "KDS_ITEM_UPDATED" // Status of a single item changes
  | "KDS_ORDER_BUMPED"; // Entire order marked as ready/completed from kitchen

export interface KitchenEvent {
  type: KitchenEventType;
  locationId: Location['id']; // To route event to correct KDS screens
  timestamp: Date;
  payload: KdsOrder | KitchenOrderUpdateEventData | KitchenItemUpdateEventData; // KdsOrder for NEW, specific data for UPDATED
}
