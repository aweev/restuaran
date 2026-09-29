// types/pos/financial-internal.types.ts
// import { Expense } from './accounting.types'; // For linking journal entries to expenses
// import { Order } from './order.types'; // For linking journal entries to sales
// import { Payout } from './payout.types'; // For bank reconciliation
import { User } from './auth.types';
import { Location } from './multi-location.types';

export type AccountType =
  | "asset"
  | "liability"
  | "equity"
  | "revenue"
  | "cost_of_goods_sold" // COGS
  | "expense"
  | "other_income"
  | "other_expense";

export interface Account {
  id: string;
  restaurantId: string;
  accountCode: string; // e.g., "1010", "4000" - must be unique within restaurant
  accountName: string; // e.g., "Cash on Hand", "Sales Revenue", "Food Costs"
  accountType: AccountType;
  description?: string;
  parentAccountId?: Account['id']; // For hierarchical chart of accounts
  isActive: boolean;
  isSystemAccount?: boolean; // True if this is a default/system-managed account
  defaultTaxRateId?: string; // If specific accounts have default tax implications
  balance?: number; // Current balance (calculated, in cents/decimal) - might not be stored directly
  currency: string; // e.g., "USD"
  createdAt: Date;
  updatedAt: Date;
  updatedByUserId?: User['id'];
}

export interface JournalEntryLine {
  id: string;
  accountId: Account['id'];
  accountName?: string; // Denormalized
  description?: string;
  debitAmount: number; // In cents/decimal (0 if credit)
  creditAmount: number; // In cents/decimal (0 if debit)
  locationId?: Location['id'];
  departmentId?: string;
  projectId?: string;
}

export interface JournalEntry {
  id: string;
  restaurantId: string;
  entryNumber: string; // System-generated, sequential
  transactionDate: Date; // Date the transaction occurred
  postingDate?: Date; // Date the entry was posted to the ledger
  description: string; // Overall description of the journal entry
  lines: JournalEntryLine[];
  totalDebits: number; // Sum of all debitAmounts, must equal totalCredits
  totalCredits: number; // Sum of all creditAmounts, must equal totalDebits
  status: "draft" | "posted" | "voided" | "reversed";
  sourceDocumentType?: "invoice" | "receipt" | "order" | "expense_claim" | "payout" | "manual_entry";
  sourceDocumentId?: string; // e.g., Order['id'], Expense['id']
  isReconciled?: boolean;
  reconciliationId?: string; // Link to a BankReconciliation record
  createdByUserId: User['id'];
  approvedByUserId?: User['id'];
  postedByUserId?: User['id'];
  createdAt: Date;
  updatedAt: Date;
  notes?: string;
}

export interface BankReconciliation {
  id: string;
  restaurantId: string;
  accountId: Account['id']; // The bank account being reconciled
  statementDate: Date; // Date of the bank statement
  statementEndingBalance: number; // Ending balance from the bank statement (cents/decimal)
  bookBalanceAsOfStatementDate: number; // Calculated balance in POS ledger (cents/decimal)
  outstandingChecksTotal?: number; // (cents/decimal)
  depositsInTransitTotal?: number; // (cents/decimal)
  bankCharges?: number; // (cents/decimal)
  interestEarned?: number; // (cents/decimal)
  adjustedBookBalance: number; // (cents/decimal)
  difference: number; // Should be 0 if reconciled (cents/decimal)
  isReconciled: boolean;
  reconciledByUserId: User['id'];
  reconciliationDate: Date;
  notes?: string;
  linkedJournalEntryIds?: JournalEntry['id'][]; // JEs created during reconciliation (e.g., for bank fees)
  createdAt: Date;
}