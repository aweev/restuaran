// ====== ACCOUNTING ======

export interface AccountingIntegration {
  id: string
  provider: "quickbooks" | "xero" | "sage" | "freshbooks" | "wave"
  isConnected: boolean
  lastSyncDate?: Date
  settings: {
    apiKey?: string
    refreshToken?: string
    companyId?: string
    autoSync: boolean
    syncFrequency: "daily" | "weekly" | "monthly" | "manual"
  }
  createdAt: Date
  updatedAt: Date
}

export interface FinancialReport {
  id: string
  type: "daily_sales" | "profit_loss" | "balance_sheet" | "cash_flow" | "tax"
  startDate: Date
  endDate: Date
  data: unknown
  createdAt: Date
}

export interface Expense {
  id: string
  category: string
  amount: number
  date: Date
  description?: string
  receipt?: string
  paymentMethod: string
  isRecurring: boolean
  recurringFrequency?: "daily" | "weekly" | "monthly" | "yearly"
  vendorId?: string
  locationId?: string
  createdBy: string
  createdAt: Date
  updatedAt: Date
}

export interface TaxSettings {
  id: string
  name: string
  rate: number
  isDefault: boolean
  appliesTo: {
    menuItemIds?: string[]
    categoryIds?: string[]
  }
  locationIds?: string[]
  createdAt: Date
  updatedAt: Date
}

// ====== ANALYTICS ======

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

// ====== AUTH/USER ======

export type UserRole = "admin" | "manager" | "staff" | "kitchen" | "waiter" | "cashier" | "delivery"

export type PermissionName =
  // Menu permissions
  | "menu:view"
  | "menu:create"
  | "menu:edit"
  | "menu:delete"
  // Order permissions
  | "order:view"
  | "order:create"
  | "order:edit"
  | "order:delete"
  | "order:process"
  // Table permissions
  | "table:view"
  | "table:create"
  | "table:edit"
  | "table:delete"
  | "table:assign"
  // User permissions
  | "user:view"
  | "user:create"
  | "user:edit"
  | "user:delete"
  // Report permissions
  | "report:view"
  | "report:export"
  // Inventory permissions
  | "inventory:view"
  | "inventory:create"
  | "inventory:edit"
  | "inventory:delete"
  // Reservation permissions
  | "reservation:view"
  | "reservation:create"
  | "reservation:edit"
  | "reservation:delete"
  // Settings permissions
  | "settings:view"
  | "settings:edit"
  // Communication permissions
  | "send_messages"

// Canonical identity types live in ./auth (the shape AuthContext uses).
// Re-exported here so `@/types` stays a valid source for User/AuthState.
export type { User, UserShift, AuthState } from "./auth"

// Re-export aliases for backward compatibility (single canonical User/AuthState).
export type { User as LegacyUser, AuthState as LegacyAuthState } from "./auth"

export interface LoginCredentials {
  email: string
  password: string
}

export interface RegisterUserData {
  name: string
  email: string
  password: string
  role: UserRole
  permissions?: PermissionName[]
}

export interface UpdateUserData {
  name?: string
  email?: string
  role?: UserRole
  permissions?: PermissionName[]
  avatar?: string
}

export interface PasswordResetConfirm {
  token: string
  password: string
}

export interface ChangePasswordData {
  currentPassword: string
  newPassword: string
}

// Role-based permission mapping
export const ROLE_PERMISSIONS: Record<UserRole, PermissionName[]> = {
  admin: [
    "menu:view",
    "menu:create",
    "menu:edit",
    "menu:delete",
    "order:view",
    "order:create",
    "order:edit",
    "order:delete",
    "order:process",
    "table:view",
    "table:create",
    "table:edit",
    "table:delete",
    "table:assign",
    "user:view",
    "user:create",
    "user:edit",
    "user:delete",
    "report:view",
    "report:export",
    "inventory:view",
    "inventory:create",
    "inventory:edit",
    "inventory:delete",
    "reservation:view",
    "reservation:create",
    "reservation:edit",
    "reservation:delete",
    "settings:view",
    "settings:edit",
    "send_messages",
  ],
  manager: [
    "menu:view",
    "menu:create",
    "menu:edit",
    "order:view",
    "order:create",
    "order:edit",
    "order:process",
    "table:view",
    "table:create",
    "table:edit",
    "table:assign",
    "user:view",
    "user:create",
    "user:edit",
    "report:view",
    "report:export",
    "inventory:view",
    "inventory:create",
    "inventory:edit",
    "reservation:view",
    "reservation:create",
    "reservation:edit",
    "reservation:delete",
    "settings:view",
    "settings:edit",
    "send_messages",
  ],
  staff: [
    "menu:view",
    "order:view",
    "order:create",
    "order:edit",
    "table:view",
    "table:assign",
    "reservation:view",
    "reservation:create",
    "send_messages",
  ],
  kitchen: ["menu:view", "order:view", "order:process", "inventory:view", "send_messages"],
  waiter: [
    "menu:view",
    "order:view",
    "order:create",
    "order:edit",
    "table:view",
    "table:assign",
    "reservation:view",
    "send_messages",
  ],
  cashier: [
    "order:view",
    "order:edit",
    "order:delete",
    "table:view",
    "table:assign",
    "reservation:view",
    "send_messages",
  ],
  delivery: [
    "order:view",
    "order:edit",
    "order:delete",
    "table:view",
    "table:assign",
    "reservation:view",
    "send_messages",
  ],
}

// ====== MENU ======

export type MenuCategory =
  | "all"
  | "breakfast"
  | "soups"
  | "pasta"
  | "main"
  | "burgers"
  | "desserts"
  | "drinks"
  | "sides"

export type FoodType = "Veg" | "Non Veg"

export interface MenuItem {
  id: string
  title: string
  description: string
  price: number
  image: string
  category: MenuCategory
  type: FoodType
  available: boolean
  preparationTime?: number; // in minutes
  discount?: number
  popular?: boolean
  allergens?: string[]
  nutritionalInfo?: {
    calories: number
    protein: number
    carbs: number
    fat: number
  }
  modifiers?: MenuItemModifier[]
}

export interface MenuItemModifier {
  id: string
  name: string
  options: {
    id: string
    name: string
    price: number
  }[]
  required: boolean
  multiple: boolean
}

export interface MenuState {
  categories: { id: MenuCategory; label: string; items: number }[]
  items: MenuItem[]
  loading: boolean
  error: string | null
  selectedCategory: MenuCategory
}

// ======= CART ======

export interface CartModifier {
  id: string
  name: string
  options: {
    id: string
    name: string
    price: number
  }[]
  required: boolean
  multiple: boolean
}
export interface CartItemModifier {
  id: string
  name: string
  options: {
    id: string
    name: string
    price: number
  }[]
  required: boolean
  multiple: boolean
}

export interface CartModifierSelection {
  modifierId: string
  optionIds: string[]
}

export interface CartItem {
  id: string
  menuItemId: string
  title: string
  price: number
  quantity: number
  image?: string
  type: "Veg" | "Non Veg"
  modifiers?: CartModifierSelection[]
  specialInstructions?: string
  totalPrice: number
  course?: number
}

export type DiningMode = "Dine in" | "Take Away" | "Delivery"

export interface CartState {
  items: CartItem[]
  tableId: string | null
  customerName: string | null
  diningMode: DiningMode
  subtotal: number
  total: number
  discount: number
  discountCode?: string
}

// ===== INVENTORY ======

export interface Ingredient {
  id: string
  name: string
  category: string
  currentStock: number
  unit: string
  costPerUnit: number
  reorderPoint: number
  reorderQuantity: number
  vendorId: string
  locationId?: string
  usageLastMonth: number
  isActive: boolean
  createdAt: Date
  lastUpdated: string
}

export interface InventoryTransaction {
  id: string
  ingredientId: string
  quantity: number
  type: "received" | "used" | "waste" | "adjustment"
  orderId?: string
  purchaseOrderId?: string
  notes?: string
  createdBy: string
  createdAt: Date
}

export interface InventoryAlert {
  id: string
  ingredientId: string
  type: "low_stock" | "out_of_stock" | "expiring_soon" | "expired"
  message: string
  isResolved: boolean
  createdAt: Date
  resolvedAt?: Date
}

export interface AutoReorderSettings {
  ingredientId: string
  isEnabled: boolean
  reorderPoint: number
  reorderQuantity: number
  vendorId: string
}

export interface InventoryForecast {
  ingredientId: string
  projectedUsage: number
  daysUntilReorder: number
  suggestedReorderDate: Date
}

// ===== VENDOR MANAGEMENT ======

export interface Vendor {
  id: string
  name: string
  contactName: string
  email: string
  phone: string
  address: string
  city: string
  state: string
  zip: string
  country: string
  website?: string
  notes?: string
  isActive: boolean
  paymentTerms: string
  createdAt: Date
  updatedAt: Date
}

export interface PurchaseOrder {
  id: string
  vendorId: string
  status: "draft" | "sent" | "confirmed" | "received" | "cancelled"
  orderDate: Date
  expectedDeliveryDate?: Date
  actualDeliveryDate?: Date
  subtotal: number
  tax: number
  total: number
  notes?: string
  createdBy: string
  createdAt: Date
  updatedAt: Date
}

export interface PurchaseOrderItem {
  id: string
  purchaseOrderId: string
  ingredientId: string
  quantity: number
  unitPrice: number
  total: number
}

export interface VendorPerformance {
  vendorId: string
  onTimeDeliveryRate: number
  qualityRating: number
  pricingCompetitiveness: number
  responseTime: number
  totalOrders: number
  totalSpent: number
  lastOrderDate: Date
}

export interface VendorInvoice {
  id: string
  vendorId: string
  purchaseOrderId?: string
  invoiceNumber: string
  issueDate: Date
  dueDate: Date
  amount: number
  status: "pending" | "paid" | "overdue" | "disputed"
  paymentDate?: Date
  notes?: string
}

// ====== MARKETING ======

export interface CustomerSegment {
  id: string
  name: string
  description?: string
  criteria: {
    visitFrequency?: {
      min?: number
      max?: number
      period?: "day" | "week" | "month"
    }
    averageSpend?: {
      min?: number
      max?: number
    }
    lastVisit?: {
      min?: Date
      max?: Date
    }
    favoriteItems?: string[]
    favoriteCategories?: string[]
    orderTypes?: ("dine_in" | "takeout" | "delivery")[]
    locationIds?: string[]
  }
  customerCount: number
  createdAt: Date
  updatedAt: Date
}

export interface MarketingCampaign {
  id: string
  name: string
  description?: string
  type: "email" | "sms" | "push_notification" | "in_app"
  status: "draft" | "scheduled" | "in_progress" | "completed" | "cancelled"
  segmentId: string
  content: {
    subject?: string
    body: string
    imageUrl?: string
    callToAction?: {
      text: string
      url: string
    }
  }
  scheduledDate?: Date
  sentDate?: Date
  metrics: {
    sent: number
    delivered: number
    opened: number
    clicked: number
    converted: number
    unsubscribed: number
  }
  createdAt: Date
  updatedAt: Date
}

export interface Promotion {
  id: string
  name: string
  description?: string
  code: string
  type: "percentage" | "fixed_amount" | "free_item" | "bogo"
  value: number
  minOrderAmount?: number
  maxDiscount?: number
  startDate: Date
  endDate: Date
  isActive: boolean
  usageLimit?: number
  usageCount: number
  menuItemIds?: string[]
  categoryIds?: string[]
  campaignId?: string
  createdAt: Date
  updatedAt: Date
}

// ====== MULTI-LOCATION ======

export interface Location {
  id: string
  name: string
  address: string
  city: string
  state: string
  zip: string
  country: string
  phone: string
  email?: string
  openingHours: {
    dayOfWeek: number // 0 = Sunday, 1 = Monday, etc.
    open: string // HH:MM format
    close: string // HH:MM format
  }[]
  timezone: string
  isActive: boolean
  settings: {
    currency: string
    taxRate: number
    serviceCharge?: number
    gratuityDefault?: number[]
    hasDelivery: boolean
    hasTakeout: boolean
    hasReservations: boolean
  }
  createdAt: Date
  updatedAt: Date
}

export interface LocationPerformance {
  locationId: string
  period: "daily" | "weekly" | "monthly" | "yearly"
  date: Date
  sales: number
  orders: number
  averageOrderValue: number
  laborCost: number
  foodCost: number
  profit: number
  profitMargin: number
}

export interface LocationComparison {
  period: "daily" | "weekly" | "monthly" | "yearly"
  date: Date
  locations: {
    locationId: string
    name: string
    sales: number
    orders: number
    averageOrderValue: number
    laborCost: number
    foodCost: number
    profit: number
    profitMargin: number
  }[]
}

// ====== PAYMENTS ======

export type PaymentMethod = "cash" | "credit" | "debit" | "mobile" | "gift"
export type PaymentStatus = "pending" | "completed" | "failed" | "refunded" | "cancelled"

export type PaymentGateway = "stripe" | "square" | "manual"

export interface PaymentDetails {
  id: string
  orderId: string
  method: PaymentMethod
  amount: number
  tip?: number
  reference?: string
  gateway?: PaymentGateway
  transactionId?: string
  timestamp: string
  metadata?: Record<string, unknown>
}

export interface TipOption {
  label: string
  value: number
  type: "percentage" | "fixed"
}

export interface Discount {
  id: string
  name: string
  code?: string
  type: "percentage" | "fixed"
  value: number
  active: boolean
  startDate?: string
  endDate?: string
  minimumOrderAmount?: number
  applicableItems?: string[] // Item IDs this discount applies to
  applicableCategories?: string[] // Category IDs this discount applies to
}

export interface PaymentState {
  payments: PaymentDetails[]
  activePayment: PaymentDetails | null
  loading: boolean
  error: string | null
  discounts: Discount[]
  appliedDiscountId: string | null
  promoCode: string | null
}

// ====== STAFF-MANAGEMENT ======

export interface StaffMember {
  id: string
  userId: string
  position: string
  hourlyRate: number
  maxHoursPerWeek: number
  isFullTime: boolean
  locationId?: string
}

export interface StaffAvailability {
  id: string
  staffId: string
  dayOfWeek: number // 0 = Sunday, 1 = Monday, etc.
  startTime: string // HH:MM format
  endTime: string // HH:MM format
  isRecurring: boolean
  specificDate?: Date
}

export interface StaffShift {
  id: string
  staffId: string
  locationId: string
  startTime: Date
  endTime: Date
  position: string
  status: "scheduled" | "confirmed" | "in_progress" | "completed" | "missed"
  notes?: string
  createdAt: Date
  updatedAt: Date
}

export interface BusyPeriodPrediction {
  locationId: string
  date: Date
  hour: number
  predictedBusyness: number // 1-10 scale
  confidence: number // 0-1 scale
  requiredStaff: {
    position: string
    count: number
  }[]
}

export interface StaffSchedule {
  weekStartDate: Date
  locationId: string
  shifts: StaffShift[]
  totalHours: number
  totalCost: number
  coverage: {
    date: Date
    hour: number
    requiredStaff: number
    scheduledStaff: number
    coverage: number // 0-1 scale
  }[]
}

// ===== TABLE ======

export type TableType = "indoor" | "outdoor" | "private" | "bar" | "booth"
export type TableShape = "rectangle" | "square" | "round" | "oval" | "custom"
export type TableSize = "small" | "medium" | "large" | "extra_large"
export type TableStyle = "modern" | "classic" | "rustic" | "industrial" | "elegant"
export type TablePosition = "left" | "right" | "center" | "corner" | "island"
export type TableOrientation = "portrait" | "landscape"
export type TableColor = "red" | "blue" | "green" | "yellow" | "black" | "white" | "custom"
export type TableMaterial = "wood" | "metal" | "glass" | "plastic" | "marble" | "stone"
export type TableStatus = "available" | "occupied" | "reserved" | "dirty"

export interface Table {
  id: string
  number: string
  capacity: number
  status: TableStatus
  customerName?: string
  customerCount?: number
  startTime?: string
  orderId?: string
  serverName?: string
  position: { x: number; y: number }
}

export interface TableState {
  tables: Table[]
  loading: boolean
  error: string | null
  selectedTable: Table | null
}

// ===== = ORDER ======

export type OrderStatus = "pending" | "preparing" | "ready" | "served" | "delivered" | "completed" | "cancelled"

export interface Payment {
  method: PaymentMethod
  amount: number
  reference?: string
  timestamp: string
  gateway?: PaymentGateway
  paymentMethodId?: string
  tip?: number
}

export interface Order {
  id: string
  orderNumber?: string
  tableId: string | null
  tableNumber?: string
  table: Table
  customerName: string | null
  items: CartItem[]
  quantity: number
  status: OrderStatus
  prepTime?: number; // Estimated preparation time in minutes
  startedAt?: string; // When preparation started
  completedAt?: string; // When item was completed
  modifiers?: Array<{id: string, name: string, price: number}>;
  createdAt: string
  updatedAt: string
  subtotal: number
  tax: number
  discount: number
  total: number
  payments: Payment[]
  isPaid: boolean
  diningMode: DiningMode
  serverId: string
  notes?: string
  /** Courses the kitchen has parked (held); projected from the kernel read model. */
  heldCourses?: number[]
}

export interface OrderData {
  id: string;
  tableId: string;
  customerId?: string;
  customerName: string;
  serverName?: string;
  serverId?: string;
  orderItems: Order[];
  totalAmount: number;
  tax?: number;
  tip?: number;
  discounts?: Array<{code: string, amount: number}>;
  status: "pending" | "confirmed" | "preparing" | "partially-ready" | "ready" | "served" | "paid" | "cancelled";
  estimatedCompletionTime?: string;
  createdAt: string;
  updatedAt: string;
  paymentMethod?: "cash" | "credit" | "debit" | "mobile";
  paymentStatus?: "unpaid" | "partially-paid" | "paid";
}

export interface OrderUpdateData {
  id: string;
  status?: string;
  updatedAt: string;
  estimatedCompletionTime?: string;
  orderItems?: Order[];
  paymentStatus?: "unpaid" | "partially-paid" | "paid";
  paymentMethod?: "cash" | "credit" | "debit" | "mobile";
  tip?: number;
}

export interface OrderDeleteData {
  id: string;
}

export interface OrderItemAddData {
  id: string;
  orderId: string;
  itemId: string;
  name: string;
  price: number;
  quantity: number;
  modifiers?: Array<{id: string, name: string, price: number}>;
  notes?: string;
  status: "pending";
  createdAt: string;
  updatedAt: string;
}

export interface OrderItemUpdateData {
  id: string;
  orderId: string;
  status?: "pending" | "preparing" | "ready" | "served" | "cancelled";
  quantity?: number;
  notes?: string;
  modifiers?: Array<{id: string, name: string, price: number}>;
  prepTime?: number;
  startedAt?: string;
  completedAt?: string;
  updatedAt: string;
}

export interface OrderItemDeleteData {
  id: string;
  orderId: string;
}

export interface OrderState {
  orders: Order[]
  activeOrders: Order[]
  completedOrders: Order[]
  loading: boolean
  error: string | null
  selectedOrder: Order | null
}

export interface OrderEvent {
  type: "order_new" | "order_update" | "order_delete";
  data: Order | OrderUpdateData | OrderDeleteData;
}

export interface OrderItemEvent {
  type: "order_item_add" | "order_item_update" | "order_item_delete";
  orderId: string;
  data: OrderItemAddData | OrderItemUpdateData | OrderItemDeleteData;
}

// ===== RESERVATIONS ======
export interface Reservation {
  id: string;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  partySize: number;
  tableId: string;
  reservationTime: string;
  specialRequests?: string;
  status: "pending" | "confirmed" | "seated" | "completed" | "cancelled" | "no-show";
  date: string
  notes?: string
  createdAt: string
  updatedAt: string
}

export interface ReservationUpdate {
  id: string;
  status?: string;
  tableId?: string;
  reservationTime?: string;
  partySize?: number;
  specialRequests?: string;
  updatedAt: string;
}

export interface ReservationDelete {
  id: string;
}

export interface ReservationEvent {
  type: "reservation_new" | "reservation_update" | "reservation_delete";
  data: Reservation | ReservationUpdate | ReservationDelete;
}

// ======= WAITLIST ======
export interface WaitListEntry {
  id: string
  customerName: string
  phoneNumber: string
  partySize: number
  estimatedWaitTime: number
  notes: string
  notified: boolean
  createdAt: string
  updatedAt: string
}

// ======= CUSTOMER ======

export interface Customer {
  id: string
  name: string
  email: string
  phone: string
  notes: string
  allergies: string
  dietaryRestrictions: string
  favoriteItems: string
  seatingPreferences: string
  visitCount: number
  lastVisit: string
  totalSpent: number
}

/**
 * Deprecated: LoyaltyCustomer is superseded by the kernel's CustomerAggregate.
 * Use `CustomerState` / `LoyaltyTier` from `@/kernel/aggregates/customer.aggregate`
 * as the canonical customer identity. Orders now reference the kernel customer
 * UUID via the `customerId` field on `order.created`, so there is a single
 * customer identity across the whole system.
 *
 * The duplicate `LoyaltyCustomer` shape (REST `/api/customer/loyalty/*`) is
 * retained only for backward compatibility with the self-service loyalty page
 * during the migration period.
 */
/** @deprecated Use CustomerState from @/kernel/aggregates/customer.aggregate */
export interface LoyaltyCustomer {
  id: string
  name: string
  email: string
  phone: string
  points: number
  tier: "bronze" | "silver" | "gold" | " platinum"
  joinDate: string
  lastActivity: string
  totalSpent: number
  visitsCount: number
}

/** @deprecated Use LoyaltyReward from @/kernel/aggregates/customer.aggregate */
export interface LoyaltyReward {
  id: string
  name: string
  description: string
  pointsCost: number
  category: "food" | "drink" | "discount" | "experience"
  icon: string
  available: boolean
}

export interface DeliveryInfo {
  id: string
  orderId: string
  provider: "doordash" | "ubereats" | "grubhub" | "restaurant"
  status: "pending" | "accepted" | "picked_up" | "delivered" | "cancelled"
  driverId?: string
  driverName?: string
  estimatedDeliveryTime: string
  actualDeliveryTime?: string
  address: {
    street: string
    city: string
    state: string
    zipCode: string
    instructions?: string
  }
}

// ======= NOTIFICATIONS ======
export interface NotificationData {
  id?: string;
  message: string;
  level: "info" | "warning" | "error" | "success";
  target?: "all" | "kitchen" | "servers" | "reception";
  userId?: string;
  read?: boolean;
  createdAt?: string;
}

// ======= KITCHEN ======

export interface KitchenOrderUpdate {
  orderId: string;
  status: OrderStatus;
  estimatedCompletionTime?: string;
  prepTime?: number; // Estimated preparation time in minutes
  startedAt?: string; // When preparation started
  completedAt?: string; // When item was completed
}

export interface KitchenItemUpdate {
  orderId: string;
  itemId: string;
  status: "pending" | "preparing" | "ready" | "served" | "cancelled";
  quantity?: number;
  notes?: string;
  prepTime?: number;
  startedAt?: string;
  completedAt?: string;
}

export interface KitchenState {
  orders: KitchenOrderUpdate[]
  items: KitchenItemUpdate[]
  loading: boolean
  error: string | null
}

export interface KitchenOrder {
  id: string
  tableId: string
  customerName: string
  items: CartItem[]
  status: OrderStatus
  prepTime?: number; // Estimated preparation time in minutes
  startedAt?: string; // When preparation started
  completedAt?: string; // When item was completed
  createdAt: string
  updatedAt: string
}

export interface KitchenItem {
  id: string
  orderId: string
  menuItemId: string
  title: string
  price: number
  quantity: number
  status: "pending" | "preparing" | "ready" | "served" | "cancelled"
  prepTime?: number; // Estimated preparation time in minutes
  startedAt?: string; // When preparation started
  completedAt?: string; // When item was completed
  createdAt: string
  updatedAt: string
}

export interface KitchenOrderUpdateData {
  id: string
  status?: OrderStatus
  estimatedCompletionTime?: string
  prepTime?: number; // Estimated preparation time in minutes
  startedAt?: string; // When preparation started
  completedAt?: string; // When item was completed
}

export interface KitchenItemUpdateData {
  id: string
  orderId: string
  status?: "pending" | "preparing" | "ready" | "served" | "cancelled"
  quantity?: number
  notes?: string
  prepTime?: number
  startedAt?: string
  completedAt?: string
}

export interface KitchenOrderDeleteData {
  id: string
}

export interface KitchenItemDeleteData {
  id: string
  orderId: string
}

export interface KitchenOrderUpdateEvent {
  type: "kitchen_order_update";
  data: KitchenOrderUpdate;
}

export interface KitchenItemUpdateEvent {
  type: "kitchen_item_update";
  orderId: string;
  data: KitchenItemUpdate;
}

export interface KitchenOrderDeleteEvent {
  type: "kitchen_order_delete";
  data: KitchenOrderDeleteData;
}

export interface KitchenItemDeleteEvent {
  type: "kitchen_item_delete";
  orderId: string;
  data: KitchenItemDeleteData;
}

export interface KitchenEvent {
  type: "kitchen_order_update" | "kitchen_item_update";
  data: KitchenOrderUpdate | KitchenItemUpdate;
}

export interface TableEvent {
  type: "table_status_update";
  data: TableStatus;
}

export interface NotificationEvent {
  type: "notification";
  data: NotificationData;
}

// ======= DYNAMIC PRICING =======

export interface PricingRule {
  id: string
  name: string
  description?: string
  type: "time_based" | "demand_based" | "special_event" | "promotion"
  isActive: boolean
  startDate?: Date
  endDate?: Date
  daysOfWeek?: number[] // 0 = Sunday, 1 = Monday, etc.
  startTime?: string // HH:MM format
  endTime?: string // HH:MM format
  adjustmentType: "percentage" | "fixed_amount"
  adjustmentValue: number
  menuItemIds?: string[] // If empty, applies to all items
  categoryIds?: string[] // If empty, applies to all categories
  locationIds?: string[] // If empty, applies to all locations
  minOrderAmount?: number
  maxDiscount?: number
  priority: number // Higher number = higher priority
  createdAt: Date
  updatedAt: Date
}

export interface DemandForecast {
  locationId: string
  date: Date
  hour: number
  predictedDemand: number // 1-10 scale
  confidence: number // 0-1 scale
  suggestedPriceAdjustment: number // percentage
}

export interface MenuItemProfitability {
  menuItemId: string
  name: string
  cost: number
  price: number
  margin: number
  marginPercentage: number
  popularity: number
  suggestedPrice: number
}


// General socket event type
export type SocketEvent = 
  | ReservationEvent 
  | OrderEvent 
  | OrderItemEvent 
  | KitchenEvent 
  | TableEvent 
  | NotificationEvent;

  // Socket event types
export type SocketEventType = 
| "reservation_event" 
| "order_event" 
| "order_item_event" 
| "kitchen_event" 
| "table_event" 
| "notification_event";

export type SocketEventHandler = (event: SocketEvent) => void;


// ====== SOCKET EVENT CONSTANTS ======

export const SOCKET_EVENTS = {
  // Reservation events
  RESERVATION_NEW: "reservation_new",
  RESERVATION_UPDATE: "reservation_update",
  RESERVATION_DELETE: "reservation_delete",
  
  // Order events
  ORDER_NEW: "order_new",
  ORDER_UPDATE: "order_update",
  ORDER_DELETE: "order_delete",
  
  // Order item events
  ORDER_ITEM_ADD: "order_item_add",
  ORDER_ITEM_UPDATE: "order_item_update",
  ORDER_ITEM_DELETE: "order_item_delete",
  
  // Kitchen events
  KITCHEN_ORDER_UPDATE: "kitchen_order_update",
  KITCHEN_ITEM_UPDATE: "kitchen_item_update",
  
  // Table events
  TABLE_STATUS_UPDATE: "table_status_update",
  
  // Notification events
  NOTIFICATION: "notification",
  
  // Connection events
  CONNECT: "connect",
  DISCONNECT: "disconnect",
  CONNECT_ERROR: "connect_error",
  
  // Room events
  JOIN_ROOM: "join_room",
  LEAVE_ROOM: "leave_room",
};

// Group events by type
export const SOCKET_EVENT_GROUPS = {
  RESERVATION: [
    SOCKET_EVENTS.RESERVATION_NEW,
    SOCKET_EVENTS.RESERVATION_UPDATE,
    SOCKET_EVENTS.RESERVATION_DELETE,
  ],
  ORDER: [
    SOCKET_EVENTS.ORDER_NEW,
    SOCKET_EVENTS.ORDER_UPDATE,
    SOCKET_EVENTS.ORDER_DELETE,
  ],
  ORDER_ITEM: [
    SOCKET_EVENTS.ORDER_ITEM_ADD,
    SOCKET_EVENTS.ORDER_ITEM_UPDATE,
    SOCKET_EVENTS.ORDER_ITEM_DELETE,
  ],
  KITCHEN: [
    SOCKET_EVENTS.KITCHEN_ORDER_UPDATE,
    SOCKET_EVENTS.KITCHEN_ITEM_UPDATE,
  ],
  TABLE: [
    SOCKET_EVENTS.TABLE_STATUS_UPDATE,
  ],
  NOTIFICATION: [
    SOCKET_EVENTS.NOTIFICATION,
  ],
  CONNECTION: [
    SOCKET_EVENTS.CONNECT,
    SOCKET_EVENTS.DISCONNECT,
    SOCKET_EVENTS.CONNECT_ERROR,
  ],
  ROOM: [
    SOCKET_EVENTS.JOIN_ROOM,
    SOCKET_EVENTS.LEAVE_ROOM,
  ],
};

// Socket rooms
export const SOCKET_ROOMS = {
  ALL: "all",
  KITCHEN: "kitchen",
  SERVERS: "servers",
  RECEPTION: "reception",
  MANAGEMENT: "management",
  getTableRoom: (tableId: string) => `table:${tableId}`,
  getOrderRoom: (orderId: string) => `order:${orderId}`,
};