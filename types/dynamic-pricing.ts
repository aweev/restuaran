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
