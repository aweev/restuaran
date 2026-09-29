// types/pos/vendor.types.ts
import { User } from './auth.types';
import { Location } from './multi-location.types'; 
import { Ingredient } from './inventory.types'; 
import { UnitOfMeasure } from './units-of-measure.types';
import { Account } from './financial-internal.types'; 
import { InventoryTransaction } from './inventory.types';

export interface VendorContact {
  id: string;
  name: string;
  role?: string; // e.g., "Sales Rep", "Accounts Payable"
  email?: string;
  phone?: string;
  isPrimary: boolean;
}

export interface Vendor {
  id: string;
  restaurantId: string;
  vendorNumber?: string; // Internal vendor code
  companyName: string; 
  contacts?: VendorContact[]; // Multiple contacts per vendor
  primaryContactName?: string; 
  primaryEmail?: string; 
  primaryPhone?: string; 
  address: {
    street: string;
    city: string;
    stateProvince: string;
    postalCode: string;
    country: string;
  };
  websiteUrl?: string;
  taxIdNumber?: string;
  paymentTerms: string; // e.g., "Net 30", "Due on Receipt", "COD"
  defaultCurrency?: string; // ("USD")
  preferredPaymentMethod?: "cheque" | "bank_transfer_ach" | "credit_card" | "other";
  bankDetails?: { 
    bankName?: string;
    accountNumber?: string; // Store securely
    routingNumber?: string; // Store securely
    swiftBic?: string;
    iban?: string;
  };
  minimumOrderValue?: number; // In cents/decimal
  deliveryLeadTimeDays?: number;
  deliverySchedule?: string; // e.g., "Mon, Wed, Fri AM"
  rating?: number; // 1-5 internal rating
  notes?: string;
  tags?: string[]; // "Produce", "Dry Goods", "Preferred"
  isActive: boolean; 
  accountPayableId?: Account['id']; 
  suppliedIngredientIds?: Ingredient['id'][]; 
  createdAt: Date;
  updatedAt: Date;
  createdByUserId?: User['id'];
  updatedByUserId?: User['id'];
}


export type PurchaseOrderStatus =
  | "draft" 
  | "pending_approval" 
  | "approved_pending_send"
  | "sent_to_vendor" 
  | "acknowledged_by_vendor" 
  | "partially_received"
  | "fully_received"
  | "invoiced" 
  | "paid" 
  | "cancelled_by_restaurant"
  | "cancelled_by_vendor"
  | "closed"; 

export interface PurchaseOrderItem {
  id: string;
  purchaseOrderId: PurchaseOrder['id'];
  ingredientId: Ingredient['id'];
  ingredientNameSnapshot: Ingredient['name']; 
  description?: string; 
  quantityOrdered: number;
  unitOfMeasureId: UnitOfMeasure['id']; // UoM for quantityOrdered ("Case", "Kilogram")
  unitPrice: number; // (cents/decimal)
  receivedQuantityInBaseUnit?: number;
  taxRate?: number;
  discountPercentage?: number;
  discountAmount?: number; // (cents/decimal)
  lineTotal: number;
  quantityReceived?: number; 
  dateReceived?: Date; 
  notes?: string;
  backorderedQuantity?: number;
}

export interface PurchaseOrder {
  id: string;
  restaurantId: string;
  poNumber: string; // User-friendly, sequential PO number
  vendorId: Vendor['id'];
  vendorNameSnapshot: Vendor['companyName']; 
  locationIdForDelivery: Location['id']; // Where the items should be delivered
  status: PurchaseOrderStatus;
  orderDate: Date; // Date PO was created/placed
  expectedDeliveryDate?: Date;
  actualDeliveryDate?: Date; // Date final shipment was received
  items: PurchaseOrderItem[];
  // Financial Summary (all in cents/decimal)
  subtotalAmount: number; 
  discountAmount?: number; 
  taxAmount?: number;
  shippingCost?: number;
  otherCharges?: number;
  grandTotalAmount: number;
  amountPaid?: number; // If pre-payment or partial payments made
  // Payment details if paid
  paymentDate?: Date;
  paymentMethod?: string;
  paymentReference?: string;
  shippingInstructions?: string;
  billingAddressSnapshot?: Vendor['address']; // Can be different from vendor's main address
  shippingAddressSnapshot: Location['address'];  
  notes?: string;
  termsAndConditions?: string;
  // Attachments (e.g., vendor quote, delivery slip)
  attachmentUrls?: string[];
  // For receiving inventory
  relatedInventoryTransactionIds?: InventoryTransaction['id'][];
  relatedVendorInvoiceId?: VendorInvoice['id'];
  createdByUserId: User['id'];
  approvedByUserId?: User['id'];
  sentToVendorAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  updatedByUserId?: User['id'];
}

export interface VendorInvoice {
  id: string;
  restaurantId: string;
  vendorId: Vendor['id'];
  purchaseOrderId?: PurchaseOrder['id']; 
  invoiceNumber: string; 
  invoiceDate: Date; 
  dueDate: Date;
  amountDue: number; // (cents/decimal)
  currency: string; // "USD"
  taxAmount?: number; // (cents/decimal)
  shippingAmount?: number; // (cents/decimal)
  invoiceLineItems?: { description: string, quantity: number, unitPrice: number, total: number }[];
  status: "pending_payment" | "partially_paid" | "paid_in_full" | "overdue" | "disputed" | "voided";
  // Payment details
  amountPaid: number; // (cents/decimal)
  lastPaymentDate?: Date;
  paymentDetails?: { date: Date, amount: number, method: string, reference?: string }[];
  notes?: string;
  attachmentUrl?: string; // Scanned copy of the invoice
  relatedJournalEntryId?: string; // For accounts payable JE
  enteredByUserId: User['id'];
  approvedForPaymentByUserId?: User['id'];
  createdAt: Date;
  updatedAt: Date;
}

export interface VendorPerformance {
  vendorId: string;
  onTimeDeliveryRate: number;
  qualityRating: number; 
  pricingCompetitiveness: number; 
  responseTimeHours: number; 
  totalOrdersPlaced: number;
  totalAmountSpent: number; // (cents/decimal)
  lastOrderDate: Date;
  averageOrderValue: number; // (cents/decimal)
  disputeRate?: number; // Percentage of orders/invoices with disputes
}