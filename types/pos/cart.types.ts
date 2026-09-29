// types/pos/cart.types.ts
import { MenuItem, MenuItemModifierGroup, FoodType } from './menu.types';
import { Discount } from './payments.types'; // Assuming Discount is defined here or in a promotion type
import { TaxSetting } from './accounting.types'; // For calculated tax breakdown
import { Table } from './table-management.types'; // For dine-in
import { User } from './auth.types'; // For associating server/cashier
import { Customer } from './customer.types'; // For associating customer to cart

export interface CartItemModifierSelection {
  menuItemModifierId: MenuItemModifierGroup['id']; // ID of the modifier definition on the MenuItem
  modifierName: string; // Denormalized for display
  selectedOption: {
    optionId: string; // ID of the specific option chosen from MenuItemModifier.options
    optionName: string; // Denormalized
    priceAdjustment: number; // Price change for this option
  };
  // If modifier allows multiple selections for its options (e.g. "Extra Cheese x2")
  quantity?: number; // Default is 1 if not present and multiple are allowed by modifier itself
}

export interface CartItem {
  id: string; // Unique ID for this cart item instance (e.g., UUID)
  menuItemId: MenuItem['id'];
  itemName: MenuItem['title']; // Denormalized from MenuItem for cart snapshot
  itemImage?: MenuItem['imageUrl']; // Denormalized
  itemFoodType?: FoodType; // Denormalized

  quantity: number;
  unitPrice: number; // Price of one unit of the MenuItem at the time it was added
  basePrice: number; // unitPrice * quantity (before modifiers and item-specific discounts)

  selectedModifiers: CartItemModifierSelection[];
  modifierTotalPrice: number; // Sum of priceAdjustments for all selected modifiers * quantity

  itemSubtotal: number; // (unitPrice + sum_of_modifier_adjustments_for_one_unit) * quantity
                        // OR basePrice + modifierTotalPrice

  // Item-specific discounts (e.g., "50% off this specific pizza")
  itemDiscounts?: {
    discountId: Discount['id'];
    discountName: Discount['name'];
    amount: number; // Amount discounted for this item line (already factored for quantity)
  }[];
  totalItemDiscountAmount: number; // Sum of all item-specific discount amounts

  // Net price for this line item after item-specific discounts
  // itemSubtotal - totalItemDiscountAmount
  netPrice: number;

  specialInstructions?: string;
  status?: "new" | "sent_to_kitchen" | "preparing" | "ready" | "served"; // If tracking item status within cart/order building
  linkedSeatNumber?: number; // For dine-in, if assigning items to specific seats at a table
  courseNumber?: number; // For dine-in, e.g., Appetizer, Main, Dessert
  addedByUserId?: User['id']; // Staff who added this item
  addedAt: Date;
}

export type DiningMode =
  | "dine_in"
  | "take_away" // Or "pickup"
  | "delivery_by_restaurant"
  | "delivery_by_platform" // If integrating with your platform layer
  | "curbside_pickup";

export interface Cart {
  id: string; // Unique ID for this cart session
  restaurantId: string;
  locationId: string;
  items: CartItem[];

  diningMode: DiningMode;
  tableId?: Table['id']; // For dine-in
  customerId?: Customer['id']; // For associating with a known POS customer
  customerName?: string; // For walk-in or if customerId not available
  customerPhoneNumber?: string; // For takeaway/delivery contact

  // Order-level details
  serverId?: User['id']; // Staff member managing this cart/order
  cashierId?: User['id']; // Staff member processing payment

  subtotal: number; // Sum of all CartItem.netPrice (sum of items after item-discounts)
  orderDiscounts?: {
    discountId: Discount['id']; // Or Promotion['id']
    discountName: string;
    codeApplied?: string;
    amount: number; // Amount discounted from the subtotal
  }[];
  totalOrderDiscountAmount: number; // Sum of all order-level discount amounts

  // Amount after order-level discounts: subtotal - totalOrderDiscountAmount
  discountedSubtotal: number;

  // Taxes
  appliedTaxes?: {
    taxSettingId: TaxSetting['id'];
    taxName: TaxSetting['name'];
    rate: TaxSetting['rate'];
    amount: number; // Tax amount calculated for this cart
  }[];
  totalTaxAmount: number;

  // Service Charge (if applicable, often configurable by location)
  serviceCharge?: {
    name: string;
    rate?: number; // Percentage
    fixedAmount?: number;
    amountApplied: number;
  };

  tipAmount?: number;

  // Final total: discountedSubtotal + totalTaxAmount + (serviceCharge?.amountApplied || 0) + (tipAmount || 0)
  grandTotal: number;

  // Payment related (might be more detailed in Order later)
  amountPaid: number;
  balanceDue: number;
  paymentStatus?: "unpaid" | "partially_paid" | "paid";

  notes?: string; // General notes for the order
  createdByUserId: User['id'];
  createdAt: Date;
  updatedAt: Date;
  cartSessionTimeout?: Date; // If carts expire
}

export interface CartStateUI {
  currentCart: Cart | null;
  isLoading: boolean;
  error: string | null;
  availableDiscounts: Discount[]; // For display
  selectedTableId?: string | null;
  selectedCustomerId?: string | null;
}
