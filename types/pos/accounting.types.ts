// types/pos/accounting.types.ts
import { Location } from './multi-location.types'; 
import { Vendor } from './vendor.types'; 
import { User } from './auth.types'; 
import { MenuItem } from './menu.types'; 
import { MenuCategory } from './menu.types'; 

// Supported accounting software providers.
export type AccountingProvider =
  | "quickbooks"
  | "xero"
  | "sage"
  | "freshbooks"
  | "wave"
  | "zoho_books" 
  | "custom_api"; // generic API integrations

//Frequency options for automatic synchronization.
export type SyncFrequency = "daily" | "weekly" | "monthly" | "manual";

//External accounting system.
export interface AccountingIntegration {
  id: string;
  restaurantId: string; // Link to the business/restaurant
  provider: AccountingProvider;
  isConnected: boolean;
  lastSyncDate?: Date;
  lastSyncStatus?: "success" | "failed" | "partial";
  lastSyncMessage?: string;
  settings: {
    apiKey?: string; // Consider storing sensitive keys in a secure vault, not directly in DB
    apiSecret?: string; // Added for providers that use it
    refreshToken?: string;
    accessToken?: string; // Often an access token is used for API calls
    tokenExpiryDate?: Date;
    companyId?: string; // Or RealmID for QuickBooks
    subsidiaryId?: string; // For systems like NetSuite
    autoSync: boolean;
    syncFrequency: SyncFrequency;
    syncSalesAs: "summary" | "detailed"; // How to sync sales data
    mapTaxCodes?: Record<string, string>; // POS Tax Code ID -> Accounting System Tax Code ID
    mapPaymentMethods?: Record<string, string>; // POS Payment Method ID -> Accounting System Account ID
    mapExpenseCategories?: Record<string, string>; // POS Expense Category -> Accounting System Account ID
    defaultSalesAccountId?: string;
    defaultExpenseAccountId?: string;
    defaultBankAccountId?: string; // For deposits
  };
  createdAt: Date;
  updatedAt: Date;
  createdByUserId?: string; // User who set up the integration
  updatedByUserId?: string;
}

// Reports the system can generate.
export type FinancialReportType =
  | "daily_sales_summary"
  | "sales_by_category"
  | "sales_by_item"
  | "profit_and_loss"
  | "balance_sheet"
  | "cash_flow_statement"
  | "tax_summary_report"
  | "expense_report"
  | "payroll_summary" // Added
  | "inventory_valuation"; // Added

export type FinancialReportData = unknown;

export interface FinancialReport {
  id: string;
  restaurantId: string;
  locationId?: string; // Report might be specific to a location
  type: FinancialReportType;
  name?: string; // User-defined name for the report instance
  startDate: Date;
  endDate: Date;
  generatedAt: Date;
  generatedByUserId?: string;
  format: "json" | "pdf" | "csv" | "xlsx"; // Added export format
  data: FinancialReportData; // This will be refined with specific report structures
  dataUrl?: string; // If the report is stored as a file
  parameters?: Record<string, unknown>; // Parameters used to generate the report
  createdAt: Date; // When the report record was created (might be different from generatedAt if scheduled)
}

export type ExpenseCategory =
  | "food_cost"
  | "beverage_cost"
  | "labor"
  | "rent_mortgage"
  | "utilities"
  | "marketing_advertising"
  | "maintenance_repairs"
  | "supplies_office"
  | "supplies_cleaning"
  | "supplies_restaurant" // More specific than just 'supplies'
  | "insurance"
  | "licenses_permits"
  | "professional_fees" // Accounting, legal
  | "bank_charges_fees"
  | "software_subscriptions"
  | "delivery_fees_paid" // Fees paid to third-party delivery
  | "employee_benefits"
  | "training_development"
  | "travel_expenses"
  | "other";
// Consider allowing custom categories: string;

export type ExpensePaymentMethod =
  | "cash"
  | "credit_card"
  | "debit_card"
  | "bank_transfer"
  | "cheque"
  | "vendor_credit"
  | "other";

export type RecurringFrequency = "daily" | "weekly" | "bi_weekly" | "monthly" | "quarterly" | "yearly";

export interface Expense {
  id: string;
  restaurantId: string;
  locationId?: string; // Expense might be tied to a specific location
  category: ExpenseCategory | string; // Allow custom string or predefined type
  subCategory?: string; // For more granular tracking
  amount: number; // Should be stored in cents or a Decimal type to avoid floating point issues
  currency: string; // e.g., "USD", "EUR"
  date: Date; // Date the expense was incurred
  transactionDate?: Date; // Date the payment was made, if different
  description?: string;
  receiptUrl?: string; // URL to a scanned receipt
  receiptFilename?: string;
  paymentMethod: ExpensePaymentMethod;
  paidTo?: string; // Name of the payee if not a formal Vendor
  vendorId?: Vendor["id"]; // Link to Vendor if applicable
  referenceNumber?: string; // e.g., invoice number, check number
  isRecurring: boolean;
  recurringExpenseId?: string; // If part of a recurring series, link to a parent RecurringExpense definition
  recurringFrequency?: RecurringFrequency;
  recurringEndDate?: Date;
  isReimbursable?: boolean;
  reimbursedToUserId?: User["id"];
  status: "pending" | "paid" | "overdue" | "voided"; // Added status
  approvedByUserId?: User["id"];
  approvalDate?: Date;
  notes?: string;
  tags?: string[];
  createdByUserId: User["id"];
  createdAt: Date;
  updatedAt: Date;
  updatedByUserId?: User["id"];
}

export interface RecurringExpense {
  id: string;
  restaurantId: string;
  locationId?: string;
  category: ExpenseCategory | string;
  amount: number;
  currency: string;
  description?: string;
  paymentMethod: ExpensePaymentMethod;
  vendorId?: Vendor["id"];
  frequency: RecurringFrequency;
  startDate: Date;
  endDate?: Date; // Can be indefinite
  nextDueDate: Date;
  isActive: boolean;
  createdByUserId: User["id"];
  createdAt: Date;
  updatedAt: Date;
}

export interface TaxApplicationRule {
  menuItemIds?: MenuItem["id"][];
  categoryIds?: MenuCategory[]; // Using the MenuCategory type from menu.types
  applyToAllItems?: boolean; // If true, overrides menuItemIds and categoryIds for this rule
}

export interface TaxSetting {
  id: string;
  restaurantId: string;
  name: string; // e.g., "Sales Tax", "VAT", "Alcohol Tax"
  description?: string;
  rate: number; // Percentage, e.g., 0.08 for 8%
  taxNumber?: string; // Official tax registration number
  isCompound?: boolean; // If this tax is calculated on top of other taxes
  compoundOrder?: number; // Order of calculation if multiple compound taxes
  isDefault: boolean; // Is this the default tax rate for new items?
  appliesTo: TaxApplicationRule; // What items/categories this tax rate applies to
  locationIds?: Location["id"][]; // Specific locations this tax is active for (if empty, applies to all)
  isActive: boolean;
  validFrom?: Date;
  validUntil?: Date;
  accountingCode?: string; // Code used in accounting software for this tax
  createdByUserId: User["id"];
  createdAt: Date;
  updatedAt: Date;
  updatedByUserId?: User["id"];
}

export interface TaxSettings {
  id: string;
  name: string;
  rate: number;
  isDefault: boolean;
  appliesTo: {
    menuItemIds?: string[];
    categoryIds?: string[];
  };
  locationIds?: string[];
  createdAt: Date;
  updatedAt: Date;
}