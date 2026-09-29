// types/pos/gift-card.types.ts
import { User } from './auth.types';
import { Customer } from './customer.types'; // For linking to a customer
import { Order } from './order.types'; // For linking redemption/purchase to an order
import { Location } from './multi-location.types';

export type GiftCardStatus =
  | "active"
  | "inactive" // Not yet activated
  | "redeemed_fully"
  | "expired"
  | "voided"
  | "lost_stolen";

export type GiftCardTransactionType =
  | "issue_activate" // Initial creation and activation
  | "load_value" // Adding more funds
  | "redeem" // Using funds for a purchase
  | "check_balance"
  | "void"
  | "refund_to_card" // Refunding an order payment back to the gift card
  | "deactivate"
  | "report_lost_stolen";

export interface GiftCardTransaction {
  id: string;
  giftCardId: GiftCard['id'];
  transactionType: GiftCardTransactionType;
  amount: number; // Value of the transaction (positive for load, negative for redeem, in cents/decimal)
  balanceBefore: number; // Balance before this transaction (cents/decimal)
  balanceAfter: number; // Balance after this transaction (cents/decimal)
  transactionDate: Date;
  orderId?: Order['id']; // If redeemed/issued as part of an order
  locationId?: Location['id']; // Location where transaction occurred
  staffUserId?: User['id']; // Staff who processed the transaction
  notes?: string;
  referenceId?: string; // e.g., POS transaction ID for the order
}

export interface GiftCard {
  id: string; // Unique gift card identifier (e.g., generated code or scanned number)
  restaurantId: string;
  cardNumber: string; // The actual card number/code, should be unique
  pin?: string; // Optional PIN for added security (store hashed if used for online redemption)
  initialBalance: number; // In cents/decimal
  currentBalance: number; // In cents/decimal
  currency: string; // e.g., "USD"
  status: GiftCardStatus;
  issueDate: Date;
  expiryDate?: Date; // Optional expiry
  issuedAtLocationId?: Location['id'];
  issuedByUserId?: User['id']; // Staff who issued it
  purchasedByCustomerId?: Customer['id']; // Customer who bought the gift card
  recipientCustomerId?: Customer['id']; // Customer who is the intended recipient
  recipientName?: string; // If not a known customer
  recipientEmail?: string; // For sending digital gift cards
  isDigital: boolean;
  designTemplateId?: string; // If you have different visual designs for gift cards
  notes?: string;
  transactionHistory: GiftCardTransaction[]; // Could embed or query separately
  createdAt: Date;
  updatedAt: Date;
}