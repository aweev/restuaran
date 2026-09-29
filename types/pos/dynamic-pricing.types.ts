// types/pos/dynamic-pricing.types.ts
import { MenuItem, MenuCategory } from './menu.types';
import { Location } from './multi-location.types';
import { User } from './auth.types';

export type PricingRuleType =
  | "time_based" // e.g., Happy Hour, Lunch Special
  | "demand_based" // Based on predicted or actual demand
  | "day_of_week"
  | "special_event" // e.g., Valentine's Day, Super Bowl
  | "stock_level_based" // e.g., discount items with high stock nearing expiry
  | "customer_segment_based" // e.g., discount for loyalty members (could also be Promotion)
  | "combo_deal"; // e.g., Buy X get Y free/discounted

export type PricingAdjustmentType =
  | "percentage_discount"
  | "fixed_amount_discount"
  | "set_new_price"
  | "percentage_surcharge" // For high demand periods
  | "fixed_amount_surcharge";

export interface PricingRule {
  id: string;
  restaurantId: string;
  name: string;
  description?: string;
  type: PricingRuleType;
  isActive: boolean;
  priority: number; // For conflict resolution: lower number = higher priority (or vice-versa, be consistent)
  isStackable: boolean; // Can this rule be combined with other rules/promotions?

  // Conditions for the rule to apply
  validFrom?: Date;
  validUntil?: Date;
  daysOfWeek?: (0 | 1 | 2 | 3 | 4 | 5 | 6)[]; // 0 = Sunday, 6 = Saturday
  startTime?: string; // HH:MM format (24-hour), local to location
  endTime?: string; // HH:MM format (24-hour), local to location
  minOrderValueForRule?: number; // Minimum cart subtotal for this rule to trigger (if rule is order-wide)
  appliesToSpecificItems: boolean; // True if applies to items/categories, false if order-wide adjustment
  menuItemIds?: MenuItem['id'][]; // If empty and appliesToSpecificItems is true, could mean all items in specified categories
  categoryIds?: MenuCategory[]; // If empty and appliesToSpecificItems is true, could mean all items with specified menuItemIds
  locationIds?: Location['id'][]; // If empty, applies to all active locations for this restaurant

  // Adjustment details
  adjustmentType: PricingAdjustmentType;
  adjustmentValue: number; // Percentage (e.g., 10 for 10%) or fixed amount in cents/decimal
  newPrice?: number; // Only if adjustmentType is 'set_new_price', in cents/decimal
  maxDiscountAmount?: number; // Max discount value if percentage based, in cents/decimal

  // Tracking
  usageCount?: number; // How many times this rule has been applied
  createdByUserId: User['id'];
  createdAt: Date;
  updatedAt: Date;
  updatedByUserId?: User['id'];
}

export interface DemandForecast {
  id: string;
  restaurantId: string;
  locationId: Location['id'];
  forecastDate: Date; // The date for which the demand is forecasted
  hourOfDay: number; // 0-23, hour for which this specific forecast applies
  predictedDemandLevel: number; // e.g., 1-10 scale, or number of expected orders/covers
  confidenceScore?: number; // 0-1 scale indicating confidence in the prediction
  source?: "historical_data" | "machine_learning_model" | "manual_override";
  suggestedPriceAdjustmentFactor?: number; // e.g., 1.1 for +10%, 0.9 for -10%
  createdAt: Date; // When the forecast was generated/recorded
}

export interface MenuItemProfitability {
  id: string; // Or composite key: restaurantId_menuItemId_analysisDate
  restaurantId: string;
  menuItemId: MenuItem['id'];
  itemName: MenuItem['title']; // Denormalized
  analysisPeriodStartDate: Date;
  analysisPeriodEndDate: Date;

  currentPrice: number; // In cents/decimal
  costOfGoodsSold: number; // COGS for one unit, in cents/decimal
  grossProfitPerItem: number; // currentPrice - costOfGoodsSold
  grossProfitMarginPercentage: number; // (grossProfitPerItem / currentPrice) * 100

  quantitySold: number; // During the analysis period
  totalRevenueGenerated: number; // quantitySold * currentPrice
  totalCostOfGoodsSold: number; // quantitySold * costOfGoodsSold
  totalGrossProfit: number; // totalRevenueGenerated - totalCostOfGoodsSold

  popularityRank?: number; // Rank based on quantity sold or revenue
  profitabilityRank?: number; // Rank based on gross profit margin or total gross profit

  // Menu Engineering Quadrant (Star, Plowhorse, Puzzle, Dog)
  menuEngineeringQuadrant?: "star" | "plowhorse" | "puzzle" | "dog";
  suggestedAction?: "maintain_price" | "increase_price" | "decrease_price" | "re_evaluate_cost" | "promote" | "de_emphasize" | "remove";
  suggestedPrice?: number; // Potentially from an optimization algorithm

  calculatedAt: Date;
}