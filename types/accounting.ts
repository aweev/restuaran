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
