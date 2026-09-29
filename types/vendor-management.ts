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
