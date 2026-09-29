// types/pos/payments.types.ts
import { User } from './auth.types';
import { Order } from './order.types';
import { Location } from './multi-location.types';
import { Customer } from './customer.types'; // For linking payment to customer if not through order
import { GiftCard } from './gift-card.types'; // For gift card payments

export type PaymentMethod =
  | "cash"
  | "credit_card"
  | "debit_card"
  | "gift_card"
  | "mobile_payment" // e.g., Apple Pay, Google Pay
  | "online_payment_gateway" // Stripe, PayPal via platform
  | "loyalty_points_redemption"
  | "house_account_charge" // Charge to a customer's account
  | "employee_meal_comp"
  | "manager_comp"
  | "voucher" // Different from gift card, often single-use promotional
  | "split_payment_component" // Internal type if a payment is part of a larger split
  | "other";

export type PaymentStatus =
  | "pending_authorization" // Awaiting gateway approval
  | "authorized" // Approved, funds held, but not yet captured
  | "captured_completed" // Funds successfully transferred
  | "failed_declined"
  | "refund_pending"
  | "partially_refunded"
  | "fully_refunded"
  | "voided_cancelled" // Transaction cancelled before settlement
  | "disputed_chargeback";

export type PaymentGateway =
  | "stripe"
  | "square"
  | "paypal"
  | "adyen"
  | "braintree"
  | "pos_integrated_terminal" // For direct integration with physical terminals
  | "manual_external_terminal" // If staff use a separate terminal and just record it
  | "cash_drawer_manual" // For cash
  | "none"; // For comps or non-monetary payments

export interface CardDetails {
  brand: "visa" | "mastercard" | "amex" | "discover" | "diners_club" | "jcb" | "unionpay" | "other";
  last4Digits: string;
  expiryMonth?: number; // MM
  expiryYear?: number; // YYYY
  cardholderName?: string;
  entryMode?: "swiped" | "chip_emv" | "contactless_nfc" | "keyed_manual" | "card_on_file";
  authorizationCode?: string; // From payment processor
  cvcCheckResult?: "pass" | "fail" | "not_checked" | "unavailable";
  avsZipCheckResult?: "pass" | "fail" | "not_checked" | "unavailable";
  avsStreetCheckResult?: "pass" | "fail" | "not_checked" | "unavailable";
}

export interface PaymentDetails {
  id: string; // Unique ID for this payment transaction
  restaurantId: string;
  locationId: Location['id'];
  orderId?: Order['id']; // Link to the order this payment is for (usually required)
  customerId?: Customer['id']; // If payment is not directly tied to an order (e.g., loading gift card)
  paymentMethod: PaymentMethod;
  amount: number; // Amount of this payment transaction (in cents/decimal)
  currency: string; // e.g., "USD"
  tipAmount?: number; // Tip included in this specific transaction (cents/decimal)
  surchargeAmount?: number; // e.g., credit card surcharge (cents/decimal)
  totalTransactionAmount: number; // amount + (tipAmount || 0) + (surchargeAmount || 0)
  status: PaymentStatus;
  gateway?: PaymentGateway;
  gatewayTransactionId?: string; // ID from the payment processor
  gatewayResponseCode?: string;
  gatewayResponseMessage?: string;
  referenceNumber?: string; // e.g., check number, voucher code
  cardDetails?: CardDetails; // If card payment
  giftCardId?: GiftCard['id']; // If paid by gift card
  loyaltyPointsRedeemed?: number; // If paid by loyalty points

  transactionTimestamp: Date; // When the payment was processed
  processedByUserId: User['id']; // Staff who handled the payment
  deviceId?: string; // POS device used for payment

  // For refunds
  isRefund: boolean;
  originalPaymentId?: PaymentDetails['id']; // If this is a refund, link to the original payment
  refundReason?: string;

  notes?: string;
  metadata?: Record<string, unknown>; // Additional gateway-specific data or custom fields
  createdAt: Date; // When the payment record was created in POS
}

export interface TipOption {
  label: string; // e.g., "15%", "18%", "20%", "Custom Amount", "No Tip"
  value: number; // Percentage (e.g., 15) or fixed amount (in cents/decimal if type is 'fixed')
  type: "percentage_on_subtotal" | "percentage_on_total" | "fixed_amount";
  isDefaultSuggestion?: boolean;
}

export interface PaymentUIState {
  // activePaymentsForOrder: PaymentDetails[]; // Payments being processed for the current order
  currentOrderTotal: number;
  amountRemainingToPay: number;
  selectedPaymentMethod?: PaymentMethod;
  tipOptions: TipOption[];
  selectedTipAmount?: number;
  isLoading: boolean; // While communicating with payment gateway
  error: string | null;
}

export interface Discount {
  id: string;
  name: string;
  code?: string;
  type: "percentage" | "fixed";
  value: number;
  active: boolean;
  startDate?: string;
  endDate?: string;
  minimumOrderAmount?: number;
  applicableItems?: string[]; // Item IDs this discount applies to
  applicableCategories?: string[]; // Category IDs this discount applies to
}