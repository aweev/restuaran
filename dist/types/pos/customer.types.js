"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// Your original LoyaltyCustomer is largely covered by extending Customer.
// The key is `loyaltyMemberId`, `loyaltyPoints`, `loyaltyTier` within `Customer`.
// export interface LoyaltyCustomer {
//   id: string
//   name: string
//   email: string
//   phone: string
//   points: number
//   tier: "bronze" | "silver" | "gold" | "platinum"
//   joinDate: string
//   lastActivity: string
//   totalSpent: number
//   visitsCount: number
// }
// Your original DeliveryInfo fields are mostly covered in RestaurantDeliveryInfo.
// The 'provider' field from your original DeliveryInfo is more relevant for platform-level
// order aggregation, which would be handled in `types/platform/order.types.ts`.
