// types/pos/marketing.types.ts

import { User } from './auth.types';
import { Customer } from './customer.types'; // For segment criteria
import { MenuItem, MenuCategory } from './menu.types';
import { Location } from './multi-location.types';
import { DiningMode } from './cart.types'; // Or order.types
// import { Order } from './order.types'; // For tracking promotion usage

export interface POSCustomerSegmentCriteria {
  minVisitFrequency?: number;
  visitFrequencyPeriod?: "day" | "week" | "month" | "year";
  maxVisitFrequency?: number;

  minAverageSpend?: number;
  maxAverageSpend?: number;

  lastVisitAfter?: Date; // Customers who visited after this date
  lastVisitBefore?: Date; // Customers who visited before this date
  hasNotVisitedSince?: Date; // Lapsed customers

  // New criteria
  minLifetimeSpend?: number;
  maxLifetimeSpend?: number;
  firstVisitAfter?: Date;
  firstVisitBefore?: Date;
  customerTagsInclude?: string[]; // Based on Customer.tags
  customerTagsExclude?: string[];
  loyaltyTiers?: Customer['loyaltyTier'][];
  birthdayMonth?: number; // 1-12
  purchasedItemIds?: MenuItem['id'][]; // Purchased specific items
  purchasedCategoryIds?: MenuCategory[]; // Purchased from specific categories
  preferredDiningModes?: DiningMode[];
  locationIds?: Location['id'][]; // Customers primarily associated with these locations
}

export interface POSCustomerSegment {
  id: string;
  restaurantId: string;
  name: string;
  description?: string;
  criteria: POSCustomerSegmentCriteria;
  // customerCount: number; // This is dynamic, better calculated on demand or stored as snapshot
  lastCalculatedCustomerCount?: number;
  lastCalculatedDate?: Date;
  isDynamic: boolean; // True if members are automatically updated based on criteria
  // staticMemberIds?: Customer['id'][]; // If segment is a fixed list of customers
  createdAt: Date;
  updatedAt: Date;
  createdByUserId: User['id'];
}

export type POSMarketingCampaignType =
  | "email_blast"
  | "sms_blast"
  | "pos_notification" // e.g., message on POS screen for staff about a campaign
  | "receipt_message" // Message printed on customer receipts
  | "local_event_promotion";

export type POSMarketingCampaignStatus =
  | "draft"
  | "scheduled"
  | "active_running"
  | "completed"
  | "paused"
  | "archived"
  | "cancelled";

export interface POSMarketingCampaign {
  id: string;
  restaurantId: string;
  name: string;
  description?: string;
  type: POSMarketingCampaignType;
  status: POSMarketingCampaignStatus;
  targetSegmentId?: POSCustomerSegment['id']; // Link to a customer segment
  // targetAllCustomers?: boolean; // If not segment-specific

  // Content - varies by type
  emailSubject?: string;
  emailBodyHtml?: string; // For email campaigns
  smsMessageText?: string; // For SMS campaigns
  posNotificationMessage?: string; // For staff notifications
  receiptMessageText?: string; // For printing on receipts

  // Call to action - might be a linked promotion
  linkedPromotionId?: string; // Use Promotion['id'] defined below
  // callToAction?: { text: string; url?: string; }; // Generic CTA

  // Scheduling
  scheduledSendDateTime?: Date;
  actualSentDateTime?: Date;
  campaignStartDate?: Date;
  campaignEndDate?: Date;

  // Metrics (simplified for POS, external tools might provide more detail)
  recipientsCount?: number; // Number of customers targeted
  // For email/SMS if integrated with a sending service:
  sentCount?: number;
  deliveredCount?: number;
  openedCount?: number; // Email
  clickedCount?: number; // Email/SMS
  conversionCount?: number; // e.g., number of linked promotions redeemed
  costOfCampaign?: number;

  // Budget & Tracking
  budget?: number;
  notes?: string;

  createdByUserId: User['id'];
  createdAt: Date;
  updatedAt: Date;
}

export type PromotionType =
  | "percentage_off_order"
  | "fixed_amount_off_order"
  | "percentage_off_item"
  | "fixed_amount_off_item"
  | "free_item"
  | "buy_x_get_y_free" // BOGO for items
  | "buy_x_get_y_discounted"
  | "set_price_for_item"
  | "spend_x_get_discount_amount" // e.g., Spend $50, get $5 off
  | "spend_x_get_discount_percentage"; // e.g., Spend $100, get 10% off

export interface PromotionCondition {
  minOrderAmount?: number; // Minimum subtotal of the order
  minItemQuantityInOrder?: number; // Min total items in order
  // For BxGy type promotions
  buyMenuItems?: { itemId: MenuItem['id'], quantity: number }[];
  buyCategories?: { categoryId: MenuCategory, quantity: number }[];
  // For "spend x get y"
  minSpendOnSpecificItemsOrCategories?: number;
  applicableDaysOfWeek?: (0 | 1 | 2 | 3 | 4 | 5 | 6)[];
  applicableTimeRanges?: { startTime: string, endTime: string }[]; // HH:MM
  requiredCustomerSegmentId?: POSCustomerSegment['id']; // Must be in this segment
  maxUsesPerCustomer?: number;
  maxTotalUses?: number;
}

export interface PromotionEffect {
  // For item-level discounts
  discountPercentage?: number; // e.g., 10 for 10%
  discountFixedAmount?: number; // In cents/decimal
  setPrice?: number; // In cents/decimal
  // For "free item" or BxGy
  freeOrDiscountedMenuItems?: { itemId: MenuItem['id'], quantity: number, discountType?: "percentage" | "fixed", discountValue?: number }[];
  freeOrDiscountedCategories?: { categoryId: MenuCategory, quantity: number, discountType?: "percentage" | "fixed", discountValue?: number }[];
  // For order-level discounts (defined in type and value on main Promotion)
  maxDiscountAmountPerOrder?: number; // Cap on percentage discounts for the order
}

export interface Promotion {
  id: string;
  restaurantId: string;
  name: string;
  description?: string;
  code?: string; // Promo code to apply, optional (can be auto-applied)
  type: PromotionType;
  value?: number; // Primary value (e.g., percentage for % off, fixed amount for $ off order) - cents/decimal for fixed amounts
  isActive: boolean;
  isAutomaticallyApplied: boolean; // If true, POS tries to apply it if conditions met, no code needed.
  isExclusive: boolean; // If true, cannot be combined with other promotions on the same order/item.
  priority?: number; // For resolving conflicts if multiple auto-apply promotions are eligible (lower = higher priority)

  // Applicability (Conditions)
  conditions: PromotionCondition;

  // What the promotion does (Effect)
  effect: PromotionEffect;

  applicableMenuItemIds?: MenuItem['id'][];
  applicableCategoryIds?: MenuCategory[];
  excludedMenuItemIds?: MenuItem['id'][];
  excludedCategoryIds?: MenuCategory[];

  // Validity & Usage
  startDate: Date;
  endDate?: Date; // Optional, can be ongoing
  usageLimitPerCustomer?: number;
  usageLimitTotal?: number;
  currentUsageCountTotal?: number; // Tracked by system
  currentUsageByCustomer?: Record<Customer['id'], number>; // More complex to track, often done via Order links

  // Association & Display
  displayOnMenu?: boolean; // Should this promo be highlighted on menu items?
  imageUrl?: string;
  marketingCampaignId?: POSMarketingCampaign['id']; // If part of a campaign

  createdByUserId: User['id'];
  createdAt: Date;
  updatedAt: Date;
}