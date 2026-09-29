// types/pos/audit-log.types.ts
import { User } from './auth.types'; // Staff user

export type AuditLogActionType =
  // User & Auth Actions
  | "USER_LOGIN_SUCCESS"
  | "USER_LOGIN_FAILURE"
  | "USER_LOGOUT"
  | "USER_CREATED"
  | "USER_UPDATED"
  | "USER_DELETED"
  | "USER_PASSWORD_CHANGED"
  | "USER_PASSWORD_RESET_REQUESTED"
  | "USER_PASSWORD_RESET_COMPLETED"
  | "USER_ROLE_ASSIGNED"
  | "USER_PERMISSIONS_UPDATED"
  // Menu Actions
  | "MENU_ITEM_CREATED"
  | "MENU_ITEM_UPDATED"
  | "MENU_ITEM_DELETED"
  | "MENU_CATEGORY_CREATED"
  | "MENU_CATEGORY_UPDATED"
  | "MENU_CATEGORY_DELETED"
  | "MODIFIER_GROUP_CREATED"
  | "MODIFIER_GROUP_UPDATED"
  | "MODIFIER_GROUP_DELETED"
  // Order Actions
  | "ORDER_CREATED"
  | "ORDER_UPDATED" // Generic update
  | "ORDER_STATUS_CHANGED"
  | "ORDER_ITEM_ADDED"
  | "ORDER_ITEM_UPDATED"
  | "ORDER_ITEM_REMOVED"
  | "ORDER_PAYMENT_PROCESSED"
  | "ORDER_REFUND_PROCESSED"
  | "ORDER_VOIDED"
  | "ORDER_DELETED"
  // Inventory Actions
  | "INVENTORY_ITEM_CREATED"
  | "INVENTORY_ITEM_UPDATED"
  | "INVENTORY_STOCK_ADJUSTED"
  | "INVENTORY_STOCK_RECEIVED" // From PO
  | "INVENTORY_STOCK_WASTED"
  | "PURCHASE_ORDER_CREATED"
  | "PURCHASE_ORDER_STATUS_UPDATED"
  // Reservation Actions
  | "RESERVATION_CREATED"
  | "RESERVATION_UPDATED"
  | "RESERVATION_CANCELLED"
  | "RESERVATION_STATUS_CHANGED"
  // Table Actions
  | "TABLE_STATUS_UPDATED"
  | "TABLE_ASSIGNED_TO_ORDER"
  // Settings & Configuration
  | "SYSTEM_SETTINGS_UPDATED"
  | "LOCATION_SETTINGS_UPDATED"
  | "TAX_SETTINGS_UPDATED"
  | "ACCOUNTING_INTEGRATION_UPDATED"
  | "PRINTER_SETTINGS_UPDATED"
  // Financial Actions
  | "EXPENSE_CREATED"
  | "EXPENSE_UPDATED"
  | "EXPENSE_DELETED"
  | "PAYOUT_RECORDED"
  // Other significant actions
  | "REPORT_GENERATED"
  | "DATA_EXPORTED"
  | "PROMOTION_CREATED"
  | "PROMOTION_UPDATED"
  | "PROMOTION_DEACTIVATED"
  | "SHIFT_STARTED"
  | "SHIFT_ENDED"
  | string; // Allow for custom action types

/**
 * Represents the type of entity that was affected by an action.
 */
export type AuditLogEntityType =
  | "User"
  | "Role"
  | "Permission"
  | "MenuItem"
  | "MenuCategory"
  | "ModifierGroup"
  | "Order"
  | "OrderItem"
  | "Payment"
  | "Refund"
  | "Ingredient" // Or InventoryItem
  | "PurchaseOrder"
  | "StockTransaction"
  | "Reservation"
  | "Table"
  | "Customer" // POS Customer
  | "Expense"
  | "TaxSetting"
  | "Promotion"
  | "Discount"
  | "Location"
  | "Device"
  | "Printer"
  | "SystemSetting"
  | "AccountingIntegration"
  | "Report"
  | "Shift"
  | string; 

export interface AuditLogEntry {
  id: string;
  restaurantId: string; // To scope logs per restaurant
  timestamp: Date;
  userId?: User['id']; // The user who performed the action (if applicable)
  userName?: User['username']; // Denormalized for easier display
  userRole?: User['roles']; // Denormalized
  impersonatorUserId?: User['id']; // If an admin impersonated another user
  actionType: AuditLogActionType;
  entityType?: AuditLogEntityType; // What kind of object was affected
  entityId?: string; // The ID of the specific object affected
  entityName?: string; // Denormalized name/identifier of the entity for readability
  changes?: AuditLogChangeDetail[]; // Array of specific field changes
  oldValue?: Record<string, unknown> | string; // Simplified: Old state of the entity or relevant part (JSON string or object)
  newValue?: Record<string, unknown> | string; // Simplified: New state of the entity or relevant part (JSON string or object)
  description?: string; // A human-readable description of the event
  ipAddress?: string; // IP address of the user performing the action
  userAgent?: string; // User agent string of the client
  source: "pos_terminal" | "web_dashboard" | "mobile_app" | "api" | "system_automated"; // Where the action originated
  status: "success" | "failure"; // Whether the action was successful
  failureReason?: string; // If the action failed
  locationId?: string; // If action is specific to a location
  deviceId?: string; // If action originated from a specific POS device
  metadata?: Record<string, unknown>; // Any other relevant contextual data
}

export interface AuditLogChangeDetail {
  field: string; // Name of the field that changed
  oldValue: unknown;
  newValue: unknown;
}