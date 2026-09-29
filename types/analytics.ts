// Sales Analytics Types
export interface DailySales {
  date: string
  totalSales: number
  orderCount: number
  averageOrderValue: number
  taxCollected: number
}

export interface CategorySales {
  category: string
  sales: number
  percentage: number
}

export interface PaymentMethodBreakdown {
  method: string
  amount: number
  percentage: number
  count: number
}

export interface HourlySales {
  hour: number
  sales: number
  orders: number
}

export interface SalesAnalytics {
  totalSales: number
  totalOrders: number
  averageOrderValue: number
  dailySales: DailySales[]
  weeklySales: number[]
  monthlySales: number[]
  categorySales: CategorySales[]
  paymentMethods: PaymentMethodBreakdown[]
  hourlySales: HourlySales[]
  comparisonToPrevious: {
    percentage: number
    trend: "up" | "down" | "stable"
  }
}

// Item Analytics Types
export interface TopSellingItem {
  id: string
  name: string
  quantitySold: number
  revenue: number
  percentageOfSales: number
  category: string
  trend: "up" | "down" | "stable"
  percentageChange: number
}

export interface ItemCategoryPerformance {
  category: string
  itemsSold: number
  revenue: number
  percentageOfSales: number
}

export interface ItemPerformanceByTime {
  hour: number
  topSellingItem: string
  quantitySold: number
}

export interface ItemAnalytics {
  topItems: TopSellingItem[]
  worstPerformingItems: TopSellingItem[]
  categoryPerformance: ItemCategoryPerformance[]
  itemPerformanceByTime: ItemPerformanceByTime[]
  totalItemsSold: number
}

// Staff Analytics Types
export interface StaffPerformanceData {
  id: string
  name: string
  role: string
  ordersProcessed: number
  totalSales: number
  averageOrderValue: number
  tips: number
  averageOrderTime: number
  tablesServed: number
}

export interface StaffPerformanceByDay {
  day: string
  staffId: string
  staffName: string
  sales: number
  orders: number
}

export interface StaffAnalytics {
  staffPerformance: StaffPerformanceData[]
  topPerformers: StaffPerformanceData[]
  staffPerformanceByDay: StaffPerformanceByDay[]
  averageOrderProcessingTime: number
  totalTips: number
  averageTipsPerStaff: number
}

// Customer Analytics Types
export interface CustomerVisitPattern {
  dayOfWeek: number
  hour: number
  visitCount: number
}

export interface TopCustomer {
  id: string
  name: string
  visitCount: number
  totalSpent: number
  averageSpend: number
  lastVisit: string
  favoriteItems: string[]
}

export interface CustomerRetentionData {
  period: string
  newCustomers: number
  returningCustomers: number
  retentionRate: number
}

export interface CustomerAnalytics {
  totalCustomers: number
  newCustomers: number
  returningCustomers: number
  averageSpendPerCustomer: number
  topCustomers: TopCustomer[]
  visitPatterns: CustomerVisitPattern[]
  retentionData: CustomerRetentionData[]
}

// Inventory Analytics Types
export interface InventoryItem {
  id: string
  name: string
  startingStock: number
  currentStock: number
  used: number
  wastage: number
  cost: number
  reorderPoint: number
  needsReorder: boolean
}

export interface InventoryUsageByDay {
  date: string
  used: number
  wastage: number
}

export interface InventoryAnalytics {
  inventoryItems: InventoryItem[]
  totalInventoryValue: number
  totalUsage: number
  totalWastage: number
  wastagePercentage: number
  usageByDay: InventoryUsageByDay[]
  itemsNeedingReorder: InventoryItem[]
}
