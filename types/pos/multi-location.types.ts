// types/pos/multi-location.types.ts
import { User } from './auth.types';
import { BusinessProfile } from './business-profile.types'; // For parent business
import { TaxSetting } from './accounting.types'; // For location-specific tax overrides
import { Printer } from './printer.types'; // For default printers per location
import { Device } from './device.types'; // For devices assigned to location
import { FloorPlan } from './floor-plan.types'; // For layouts at this location
import { DiningMode } from './cart.types'; // Or order.types
import { MenuCategory } from './menu.types'; // For default kitchen printer routing

export interface LocationOpeningHours {
  dayOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = Sunday, 6 = Saturday
  openTime: string; // HH:MM format (24-hour), local to location's timezone
  closeTime: string; // HH:MM format (24-hour), local to location's timezone
  isOpen: boolean; // Allows marking a day as closed
  notes?: string; // e.g., "Kitchen closes 30 mins prior"
}

export interface LocationSpecialOpeningHours {
  date: Date; // Specific date for special hours (e.g., holiday)
  openTime?: string; // HH:MM, optional if closed all day
  closeTime?: string; // HH:MM, optional if closed all day
  isClosed: boolean; // Explicitly closed for the day
  reason?: string; // e.g., "Holiday Closure", "Private Event"
}

export interface LocationAddress {
  street: string;
  addressLine2?: string;
  city: string;
  stateProvince: string;
  postalCode: string;
  country: string;
  latitude?: number;
  longitude?: number;
  deliveryInstructions?: string; // For delivery drivers finding the location
}

export interface Location {
  id: string;
  businessProfileId: BusinessProfile['id']; // Link to the parent business
  name: string; // e.g., "Downtown Branch", "Springfield Mall Kiosk"
  locationCode?: string; // Short code for internal reference
  description?: string;
  address: LocationAddress;
  phoneNumber: string;
  publicEmail?: string;
  managerUserId?: User['id']; // Primary manager for this location

  standardOpeningHours: LocationOpeningHours[];
  specialOpeningHours?: LocationSpecialOpeningHours[]; // For holidays, special events

  timezone: string; // IANA Time Zone Database name (e.g., "America/New_York")
  currency: string; // ISO 4217 code, may override BusinessProfile default
  language: string; // Default language for this location, may override BusinessProfile

  isActive: boolean; // Whether this location is operational
  isTestLocation?: boolean; // For staging or testing purposes

  // Location-specific settings (can override BusinessProfile or global settings)
  settings: {
    // Tax & Financial
    defaultTaxSettingIds?: TaxSetting['id'][]; // Default taxes for this location
    overrideBusinessTaxRates?: boolean; // If true, location-specific tax settings apply
    serviceCharge?: {
      name: string;
      rate?: number; // Percentage
      fixedAmount?: number; // In cents/decimal
      appliesToDiningModes?: DiningMode[];
      isAutomaticallyAdded: boolean;
    };
    gratuityDefaultSuggestions?: number[]; // e.g., [15, 18, 20] for % tip suggestions
    // Operational
    supportedDiningModes: DiningMode[]; // e.g., ["dine_in", "take_away"]
    allowsReservations: boolean;
    allowsWaitlist: boolean;
    // Delivery specific if managed by this location
    hasOwnDeliveryFleet?: boolean;
    deliveryRadiusKm?: number;
    deliveryFee?: number;
    minOrderForDelivery?: number;
    // Printers & Devices
    defaultReceiptPrinterId?: Printer['id'];
    defaultKitchenPrinterIds?: Record<MenuCategory, Printer['id']>; // Map categories to printers
    acceptsOnlineOrders?: boolean; // Via platform or direct
    onlineOrderStatusUrl?: string; // URL for customers to track orders from this location
    disableOnlineOrderingReason?: string; // If temporarily disabled
  };

  // Associations
  assignedStaffUserIds?: User['id'][]; // Staff who can work at this location
  assignedDeviceIds?: Device['id'][];
  floorPlanIds?: FloorPlan['id'][];

  imageUrl?: string; // Photo of the location
  notes?: string;

  createdAt: Date;
  updatedAt: Date;
  createdByUserId: User['id'];
  updatedByUserId?: User['id'];
}

export interface LocationPerformance {
  locationId: Location['id'];
  locationName?: Location['name']; // Denormalized
  periodType: "daily" | "weekly" | "monthly" | "quarterly" | "yearly" | "custom_range";
  periodStartDate: Date;
  periodEndDate: Date;

  // Key metrics (many can be derived from SalesSummary in analytics.types.ts)
  totalSales: number; // Gross sales
  netSales: number; // Sales after discounts
  totalOrders: number;
  averageOrderValue: number; // Based on netSales
  totalCustomersServed?: number; // If tracked
  tableTurnoverRate?: number; // For dine-in

  foodCost?: number; // COGS
  foodCostPercentage?: number; // (foodCost / netSales) * 100
  laborCost?: number;
  laborCostPercentage?: number; // (laborCost / netSales) * 100
  otherOperatingExpenses?: number;

  grossProfit?: number; // netSales - foodCost
  netProfit?: number; // grossProfit - laborCost - otherOperatingExpenses
  profitMargin?: number; // (netProfit / netSales) * 100

  onlineOrderPercentage?: number;
  averageCustomerRating?: number;
  employeeTurnoverRate?: number;
}

export interface LocationComparisonReport {
  reportId: string;
  restaurantId: string;
  periodType: "daily" | "weekly" | "monthly" | "quarterly" | "yearly" | "custom_range";
  periodStartDate: Date;
  periodEndDate: Date;
  comparisonMetric: keyof Omit<LocationPerformance, 'locationId' | 'locationName' | 'periodType' | 'periodStartDate' | 'periodEndDate'>; // Metric being compared
  locationsData: {
    locationId: Location['id'];
    locationName: Location['name']; // Denormalized
    metricValue: number;
    rank?: number;
    percentageOfTotal?: number; // This location's contribution to the total for this metric
  }[];
  totalForAllLocations?: number; // Sum of metricValue across compared locations
  generatedAt: Date;
}