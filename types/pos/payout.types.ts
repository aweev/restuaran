// types/pos/payout.types.ts
import { PaymentGateway } from './payments.types';
// import { Location } from './multi-location.types'; // If payouts are location-specific
// import { User } from './auth.types';
import { PaymentDetails } from './payments.types'; // For linking individual transactions

export interface Payout {
  id: string; // Unique ID for this payout record
  restaurantId: string;
  payoutReferenceId: string; // ID from the payment processor (e.g., Stripe Payout ID: po_xxxx)
  paymentGateway: PaymentGateway;
  payoutDate: Date; // Date the funds were scheduled to be or were deposited
  expectedArrivalDate?: Date; // If processor provides this
  actualArrivalDate?: Date; // When funds actually arrived in bank account
  status:
    | "pending" // Processor has initiated, not yet in bank
    | "in_transit"
    | "paid_to_bank" // Confirmed in bank account
    | "failed"
    | "cancelled_by_processor";
  currency: string; // e.g., "USD"
  grossAmount: number; // Total amount of transactions included in payout (cents/decimal)
  feesDeducted: number; // Total fees charged by processor for these transactions (cents/decimal)
  adjustments?: number; // Other adjustments (e.g., for refunds processed, chargebacks) (cents/decimal)
  netAmountDeposited: number; // grossAmount - feesDeducted + adjustments (cents/decimal)
  bankAccountId?: string; // Internal ID of the bank account where funds were deposited
  bankAccountLast4?: string; // For display
  includedPaymentTransactionIds?: PaymentDetails['id'][];
  includedTransactionsSummary?: {
    count: number;
    type: 'charge' | 'refund' | 'dispute';
    totalAmount: number; // cents/decimal
  }[];
  statementDescriptor?: string; // How it appears on bank statement
  notes?: string;
  reconciliationJournalEntryId?: string; // If linked to an internal JE for bank reconciliation
  createdAt: Date; // When this payout record was created/synced in POS
  processedBySystemAt?: Date; // When POS system processed/reconciled this
}