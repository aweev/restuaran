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
