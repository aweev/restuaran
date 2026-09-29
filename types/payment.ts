export type PaymentMethod = "cash" | "credit" | "debit" | "mobile" | "gift"

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
