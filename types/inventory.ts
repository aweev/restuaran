export interface Ingredient {
  id: string
  name: string
  category: string
  unit: string
  currentStock: number
  reorderLevel: number
  unitCost: number
  usageLastMonth: number
  isActive: boolean
  lastUpdated: string
}
