export interface Ingredient {
  id: string
  name: string
  currentStock: number
  unit: string
  costPerUnit: number
  reorderPoint: number
  reorderQuantity: number
  vendorId: string
  locationId?: string
  createdAt: Date
  updatedAt: Date
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
