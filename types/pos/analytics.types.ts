// types/pos/analytics.types.ts
import { Location } from './multi-location.types'; 
import { MenuItem, MenuCategory } from './menu.types'; 
import { User, UserRole } from './auth.types'; 
import { PaymentMethod } from './payments.types';

// ====== GENERAL SALES ANALYTICS ======

export interface SalesSummary {
  totalSales: number; // Gross sales before discounts, taxes
  netSales: number; // Gross sales - discounts
  totalOrders: number;
  averageOrderValue: number; // Based on netSales / totalOrders
  totalItemsSold: number;
  totalDiscounts: number;
  totalTaxes: number;
  totalTips: number;
  totalRevenue: number; // netSales + taxes + tips (or however you define it)
  totalCostOfGoodsSold?: number; // COGS if available
  grossProfit?: number; // netSales - COGS
  grossProfitMargin?: number; // (grossProfit / netSales) * 100
}

export interface TimePeriod {
  startDate: Date;
  endDate: Date;
}

export interface DatedSalesSummary extends SalesSummary {
  date: Date; // Or string if you prefer 'YYYY-MM-DD'
}

export interface DailySales {
  date: string;
  totalSales: number;
  orderCount: number;
  averageOrderValue: number;
  taxCollected: number;
}

export interface SalesByPeriodAnalytics extends SalesSummary {
  period: TimePeriod;
  dailyBreakdown?: DatedSalesSummary[]; // Optional daily breakdown for weekly/monthly reports
  hourlyBreakdown?: HourlySalesData[]; // Optional hourly breakdown for daily reports
  comparisonToPreviousPeriod?: {
    percentageChange: number; // For totalSales or netSales
    trend: "up" | "down" | "stable";
  };
}

export interface HourlySalesData {
  hour: number; // 0-23
  salesAmount: number;
  orderCount: number;
  averageOrderValue: number;
}

export interface SalesByPaymentMethod extends SalesSummary {
  paymentMethod: PaymentMethod | string; // Allow for custom/new payment methods
  transactionCount: number;
}

export interface SalesByDiningMode extends SalesSummary {
  diningMode: string; // "Dine-in", "Takeaway", "Delivery"
  orderCount: number;
}

// ====== ITEM & CATEGORY ANALYTICS ======

export interface ItemSalesDetail {
  itemId: MenuItem['id'];
  itemName: MenuItem['title'];
  itemCategory?: MenuCategory | string;
  quantitySold: number;
  grossSales: number; // Price * quantity (before item-specific discounts)
  discountsApplied: number; // Discounts specifically on this item
  netSales: number; // grossSales - discountsApplied
  totalCost?: number; // If recipe costing is implemented (quantitySold * unitCost)
  profit?: number; // netSales - totalCost
  profitMargin?: number; // (profit / netSales) * 100
  percentageOfTotalSales?: number; // This item's netSales / overall netSales
}

export interface TopSellingItemData extends ItemSalesDetail {
  rank: number;
  trendComparedToPrevious?: "up" | "down" | "stable";
  percentageChangeInSales?: number;
}

export interface CategorySalesDetail {
  categoryId: MenuCategory | string; // Or a specific ID if categories are entities
  categoryName: string;
  totalItemsSold: number;
  grossSales: number;
  discountsApplied: number;
  netSales: number;
  totalCost?: number;
  profit?: number;
  profitMargin?: number;
  percentageOfTotalSales?: number; // This category's netSales / overall netSales
  topItemsInCategory?: ItemSalesDetail[]; // Top N items within this category
}

export interface ItemPerformanceByTimeSlot {
  timeSlot: string; // "08:00-09:00", "Lunch Rush"
  itemId: MenuItem['id'];
  itemName: MenuItem['title'];
  quantitySold: number;
  netSales: number;
}

export interface ItemAnalyticsReport {
  period: TimePeriod;
  topSellingItems: TopSellingItemData[];
  worstPerformingItems: ItemSalesDetail[]; // Could be based on low sales, low profit, or high wastage
  categoryPerformance: CategorySalesDetail[];
  itemPerformanceByTime: ItemPerformanceByTimeSlot[];
  totalUniqueItemsSold: number;
  overallSalesSummary: SalesSummary; // Sales summary for all items considered
  profitabilityMatrix?: ItemProfitabilityQuadrant[]; // For advanced analysis
}

export interface ItemProfitabilityQuadrant {
  itemId: MenuItem['id'];
  itemName: MenuItem['title'];
  popularityMetric: number; // quantity sold, percentage of orders
  profitabilityMetric: number; // profit margin, total profit
  quadrant: "star" | "plowhorse" | "puzzle" | "dog"; // Standard menu engineering terms
}


// ====== STAFF PERFORMANCE ANALYTICS ======

export interface StaffSalesPerformance extends SalesSummary {
  staffId: User['id'];
  staffName: User['username'];
  staffRole?: UserRole | string;
  ordersProcessed: number; // Same as totalOrders for this staff member
  averageItemsPerOrder: number;
  averageOrderProcessingTimeSeconds?: number; // If tracked
  tablesServed?: number; // For waitstaff
  tipPercentage?: number; // (totalTips / netSales) * 100
  salesPerHour?: number; // netSales / hoursWorked
}

export interface StaffPerformanceByDayData {
  date: Date; // Or string
  staffId: User['id'];
  staffName: User['username'];
  netSales: number;
  ordersProcessed: number;
  totalTips: number;
}

export interface StaffAnalyticsReport {
  period: TimePeriod;
  overallStaffPerformance: StaffSalesPerformance[];
  topPerformingStaff: StaffSalesPerformance[]; // Based on chosen metric (sales, tips, etc.)
  staffPerformanceByDay?: StaffPerformanceByDayData[];
  averageOrderProcessingTimeOverallSeconds?: number;
  totalTipsCollectedOverall: number;
  averageTipsPerStaffMember?: number;
  teamPerformance?: Record<string, StaffSalesPerformance[]>; // by role or shift team
}


// ====== CUSTOMER ANALYTICS (POS-SIDE) ======

export interface CustomerVisitPatternData {
  dayOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6; // Sunday to Saturday
  hourOfDay: number; // 0-23
  visitCount: number;
  averageSpendPerVisit?: number;
}

export interface TopPOSCustomer {
  customerId: string; // From your existing POS Customer type
  customerName: string;
  visitCount: number;
  totalSpent: number;
  averageSpendPerVisit: number;
  lastVisitDate: Date;
  favoriteItems?: { itemId: MenuItem['id'], itemName: MenuItem['title'], purchaseCount: number }[];
  preferredDiningMode?: string;
}

export interface CustomerRetentionMetrics {
  period: string; // "March 2024", "Q1 2024"
  newCustomers: number;
  returningCustomers: number;
  totalActiveCustomers: number;
  retentionRate?: number; // (returningCustomers / (newCustomers + returningCustomers_previous_period)) * 100
  churnRate?: number;
  averageCustomerLifetimeValue?: number;
}

export interface POSCustomerAnalyticsReport {
  period: TimePeriod;
  totalUniqueCustomers: number;
  newCustomersAcquired: number;
  returningCustomerCount: number;
  averageSpendPerCustomer: number;
  averageVisitsPerCustomer: number;
  topCustomers: TopPOSCustomer[];
  visitPatterns: CustomerVisitPatternData[];
  retentionMetrics: CustomerRetentionMetrics[];
  segmentPerformance?: Record<string, { count: number; totalSpend: number }>; // If POS has customer segments
}


// ====== INVENTORY ANALYTICS ======

export interface InventoryItemUsage {
  itemId: string; // Corresponds to Ingredient['id']
  itemName: string; // Ingredient['name']
  startingStock: number;
  stockReceived: number;
  stockUsedInSales: number; // Calculated from recipes and sales
  stockAdjusted: number; // Manual adjustments
  stockWasted: number;
  endingStock: number;
  costOfGoodsSoldForItem: number; // (stockUsedInSales + stockWasted) * unitCost
  turnoverRate?: number; // COGS / Average Inventory Value
  wastagePercentage?: number; // (stockWasted / (startingStock + stockReceived)) * 100
}

export interface InventoryUsageByDate {
  date: Date; // Or string
  totalItemsUsed: number;
  totalValueUsed: number;
  totalItemsWasted: number;
  totalValueWasted: number;
}

export interface InventoryAnalyticsReport {
  period: TimePeriod;
  itemUsageDetails: InventoryItemUsage[];
  totalInventoryValueStart?: number;
  totalInventoryValueEnd?: number;
  totalCostOfGoodsSold: number;
  totalInventoryUsageValue: number;
  totalInventoryWastageValue: number;
  overallWastagePercentage: number;
  usageByDate?: InventoryUsageByDate[];
  itemsNeedingReorderCount: number;
  slowMovingItems?: InventoryItemUsage[];
  deadStockItems?: InventoryItemUsage[];
  supplierPerformanceSummary?: unknown; // Placeholder if you integrate vendor performance here
}

// ====== LOCATION PERFORMANCE (Already in your Multi-Location, good to have consolidated view here) =====

export interface LocationPerformanceAnalytics extends SalesSummary {
  locationId: Location['id'];
  locationName: Location['name'];
  // SalesSummary already covers most of these:
  sales: number;
  orders: number;
  averageOrderValue: number;
  laborCost?: number;
  laborCostPercentage?: number; // (laborCost / netSales) * 100
  foodCost?: number; // This is COGS
  foodCostPercentage?: number; // (foodCost / netSales) * 100
  otherOperatingExpenses?: number;
  netProfit?: number;
  netProfitMargin?: number;
  customerCount?: number;
  tableTurnoverRate?: number;
}

export interface MultiLocationComparisonReport {
  period: TimePeriod;
  metric: keyof LocationPerformanceAnalytics; // 'netSales', 'netProfitMargin'
  locationsData: {
    locationId: Location['id'];
    locationName: Location['name'];
    value: number;
    rank?: number;
  }[];
}

export interface OverallSalesAnalyticsReport {
  period: TimePeriod;
  summary: SalesSummary;
  dailyBreakdown: DatedSalesSummary[];
  weeklyTrend: number[]; // total net sales per week for the period
  monthlyTrend: number[]; // total net sales per month
  categoryBreakdown: CategorySalesDetail[];
  paymentMethodBreakdown: SalesByPaymentMethod[];
  hourlyPerformance: HourlySalesData[];
}