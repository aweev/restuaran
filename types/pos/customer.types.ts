export interface UserAddress {
  id?: string;
  street: string;
  city: string;
  state?: string;
  zipCode?: string;
  country?: string;
  isDefault?: boolean;
}
import { MenuItem } from './menu.types';
import { Order } from './order.types';
import { Location } from './multi-location.types';
import { User } from './auth.types'; // For createdBy/updatedBy

export type CustomerTier = "bronze" | "silver" | "gold" | "platinum" | "vip" | string; // Allow custom tiers

export interface CustomerTag {
  id: string;
  name: string;
  color?: string;
}

/**
 * Represents a customer record within the POS system.
 */
export interface Customer {
  id: string;
  restaurantId: string;
  firstName?: string;
  lastName?: string;
  fullName?: string; // Auto-generated or provided
  email?: string;
  emailVerified?: boolean;
  phoneNumber?: string;
  phoneNumberVerified?: boolean;

  // Demographics & Preferences
  dateOfBirth?: Date;
  gender?: "male" | "female" | "non_binary" | "prefer_not_to_say";
  companyName?: string;
  notes?: string; // General notes about the customer
  tags?: CustomerTag[]; // For segmentation, e.g., "VIP", "Regular", "Allergy: Nuts"
  allergies?: string[];
  dietaryRestrictions?: string[]; // e.g., "vegan", "gluten_free"
  preferences?: {
    seating?: string; // e.g., "booth", "window_seat"
    communication?: ("email" | "sms" | "push")[]; // Preferred contact methods
    marketingOptIn: boolean;
  };

  // Engagement & History
  firstVisitDate?: Date;
  lastVisitDate?: Date;
  totalVisits: number;
  totalSpent: number; // Lifetime value at this restaurant
  averageSpendPerVisit?: number;
  recentOrderIds?: Order['id'][]; // Quick access to last few orders
  // favoriteItems?: { menuItemId: MenuItem['id'], purchaseCount: number }[]; // Can be calculated

  // Loyalty Program Details (if applicable)
  loyaltyMemberId?: string; // Unique ID for loyalty program
  loyaltyPoints: number;
  loyaltyTier?: CustomerTier;
  loyaltyTierAchievedDate?: Date;
  loyaltyJoinDate?: Date;
  lastActivityDate?: Date; // Last date points were earned or redeemed

  // Addresses (primarily for delivery/takeaway or CRM)
  addresses?: UserAddress[]; // Reusing UserAddress from platform, or define POSCustomerAddress
  defaultBillingAddressId?: string;
  defaultShippingAddressId?: string; // "Shipping" might be "Delivery" in restaurant context

  isTaxExempt?: boolean;
  taxExemptionNumber?: string;

  // System Fields
  isActive: boolean; // If customer profile is active
  gdprConsent?: {
    dataProcessing: boolean;
    marketing: boolean;
    consentDate: Date;
  };
  createdByUserId?: User['id']; // Staff member who created the profile
  createdAt: Date;
  updatedAt: Date;
  updatedByUserId?: User['id'];
  mergedWithCustomerId?: Customer['id']; // If profiles were merged
}


/**
 * Represents a reward in the restaurant's loyalty program.
 */
export interface LoyaltyReward {
  id: string;
  restaurantId: string;
  name: string;
  description: string;
  pointsCost: number;
  type: "discount_percentage" | "discount_fixed_amount" | "free_item" | "gift_card_credit" | "exclusive_experience" | "other";
  // If type is 'discount_percentage' or 'discount_fixed_amount'
  discountValue?: number;
  // If type is 'free_item'
  freeMenuItemIds?: MenuItem['id'][];
  applicableCategories?: string[]; // Categories the reward applies to
  imageUrl?: string;
  isActive: boolean;
  validFrom?: Date;
  validUntil?: Date;
  usageLimitPerCustomer?: number;
  totalUsageLimit?: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Represents a transaction in the loyalty program (points earned/redeemed).
 */
export interface LoyaltyTransaction {
  id: string;
  restaurantId: string;
  customerId: Customer['id'];
  type: "earn_points" | "redeem_reward" | "points_adjustment" | "points_expired" | "tier_upgrade";
  pointsChange: number; // Positive for earn, negative for redeem/expire
  transactionDate: Date;
  description?: string;
  orderId?: Order['id']; // If points earned/redeemed via an order
  loyaltyRewardId?: LoyaltyReward['id']; // If a reward was redeemed
  staffUserId?: User['id']; // Staff who processed or adjusted
  notes?: string;
  createdAt: Date;
}


/**
 * Information specific to a delivery managed directly by the restaurant (not a platform delivery).
 * This was your original DeliveryInfo, refocused for POS-managed deliveries.
 */
export interface RestaurantDeliveryInfo {
  id: string;
  orderId: Order['id'];
  restaurantId: string;
  locationId: Location['id']; // Origin location
  status:
    | "pending_assignment"
    | "driver_assigned"
    | "out_for_delivery"
    | "delivered"
    | "delivery_failed"
    | "returned_to_store"
    | "cancelled";
  assignedDriverId?: User['id']; // Link to staff user if driver is internal
  assignedDriverName?: string; // Or name if external/contract driver
  driverNotes?: string;
  customerAddressSnapshot: UserAddress; // Snapshot of the delivery address
  estimatedDeliveryTime?: Date;
  actualDeliveryTime?: Date;
  deliveryFeeCharged?: number;
  deliveryInstructionsFromCustomer?: string;
  proofOfDeliveryImageUrl?: string;
  deliveryAttemptLogs?: {
    timestamp: Date;
    status: string;
    notes?: string;
  }[];
  createdAt: Date;
  updatedAt: Date;
}

// Your original LoyaltyCustomer is largely covered by extending Customer.
// The key is `loyaltyMemberId`, `loyaltyPoints`, `loyaltyTier` within `Customer`.
// export interface LoyaltyCustomer {
//   id: string
//   name: string
//   email: string
//   phone: string
//   points: number
//   tier: "bronze" | "silver" | "gold" | "platinum"
//   joinDate: string
//   lastActivity: string
//   totalSpent: number
//   visitsCount: number
// }

// Your original DeliveryInfo fields are mostly covered in RestaurantDeliveryInfo.
// The 'provider' field from your original DeliveryInfo is more relevant for platform-level
// order aggregation, which would be handled in `types/platform/order.types.ts`.