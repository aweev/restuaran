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
