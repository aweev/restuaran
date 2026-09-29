// types/pos/auth.types.ts
import { Location } from './multi-location.types'; // If staff are tied to a default location

export type UserRole =
  | "owner" // Super admin, typically the business owner
  | "admin" // Can manage most aspects of the system, including users
  | "manager" // Manages daily operations, staff, inventory, reports for assigned location(s)
  | "shift_lead" // Can perform some managerial tasks during their shift
  | "waiter" // Takes orders, serves customers
  | "cashier" // Handles payments
  | "bartender" // Manages bar orders and inventory
  | "kitchen_staff" // Prepares food, views orders for KDS
  | "delivery_driver" // Manages delivery orders
  | "host_staff" // Manages reservations and waitlist
  | "back_office_staff" // For accounting or data entry roles
  | "custom_role"; // For roles with fully custom permissions

export type PermissionName =
  // General
  | "dashboard:view"
  // Restaurant/Business Profile
  | "business_profile:view"
  | "business_profile:edit"
  // Location Management
  | "location:view"
  | "location:create"
  | "location:edit"
  | "location:delete"
  | "location_settings:edit"
  // Menu Management
  | "menu:view"
  | "menu:create_items"
  | "menu:edit_items"
  | "menu:delete_items"
  | "menu:manage_categories"
  | "menu:manage_modifiers"
  | "menu:set_availability"
  | "menu:set_pricing"
  // Order Management
  | "order:view_all" // View all orders (e.g., manager)
  | "order:view_assigned" // View orders assigned to them (e.g., waiter)
  | "order:create"
  | "order:edit_own" // Edit their own orders
  | "order:edit_any" // Edit any order
  | "order:cancel_own"
  | "order:cancel_any"
  | "order:apply_discount_item"
  | "order:apply_discount_order"
  | "order:process_payment"
  | "order:issue_refund"
  | "order:split_bill"
  | "order:transfer_items"
  | "order:change_status" // e.g., from preparing to ready
  // Table Management
  | "table_layout:view"
  | "table_layout:edit"
  | "table:view_status"
  | "table:change_status" // available, occupied, dirty
  | "table:assign_to_order"
  | "table:assign_server"
  // Customer Management (POS-side)
  | "customer:view"
  | "customer:create"
  | "customer:edit"
  | "customer:delete"
  | "customer:view_order_history"
  | "loyalty:manage_points"
  // Staff User Management
  | "user:view_list"
  | "user:view_details"
  | "user:create"
  | "user:edit_profile" // Edit any user's profile
  | "user:edit_own_profile"
  | "user:delete"
  | "user:assign_role"
  | "user:manage_permissions"
  | "user:manage_shifts"
  | "user:reset_password"
  // Reporting & Analytics
  | "report:view_sales"
  | "report:view_inventory"
  | "report:view_staff_performance"
  | "report:view_financial" // P&L, etc.
  | "report:export_data"
  // Inventory Management
  | "inventory:view_stock"
  | "inventory:manage_ingredients" // create, edit, delete
  | "inventory:perform_stock_take"
  | "inventory:record_wastage"
  | "inventory:manage_purchase_orders"
  | "inventory:manage_vendors"
  // Reservations & Waitlist
  | "reservation:view"
  | "reservation:create"
  | "reservation:edit"
  | "reservation:cancel"
  | "reservation:seat_party"
  | "waitlist:manage"
  // Marketing & Promotions (POS-side)
  | "promotion:view"
  | "promotion:create"
  | "promotion:edit"
  | "promotion:activate_deactivate"
  // Accounting & Financial
  | "expense:manage"
  | "tax_settings:manage"
  | "accounting_integration:manage"
  | "payout:view"
  // System Settings
  | "system_settings:view"
  | "system_settings:edit" // Global POS settings
  | "printer_settings:manage"
  | "device_settings:manage"
  // Communication (Internal)
  | "internal_communication:send_messages" // To other staff/kitchen
  // Dynamic Pricing
  | "dynamic_pricing_rules:manage"
  // Audit Log
  | "audit_log:view";

export interface User {
  id: string;
  restaurantId: string; // To scope users to a specific business
  username?: string; // Optional username for login if not email
  email: string; // Primary identifier for login, must be unique within restaurantId
  emailVerified: boolean;
  phoneNumber?: string;
  phoneNumberVerified?: boolean;
  passwordHash: string; // Store hashed passwords, never plain text
  firstName: string;
  lastName: string;
  displayName?: string; // Combination of first/last or a preferred name
  avatarUrl?: string;
  pinCode?: string; // Hashed PIN for quick login on POS terminals
  roles: UserRole[]; // A user can have multiple roles
  permissions: PermissionName[]; // Specific permissions overriding or adding to role defaults
  assignedLocationIds?: string[]; // Locations this user is primarily associated with or can work at
  defaultLocationId?: string; // Default location for operations if assigned to multiple
  isActive: boolean; // Whether the user account is active or disabled
  isSystemUser?: boolean; // For automated system actions, not a real person
  lastLoginAt?: Date;
  lastLoginIp?: string;
  failedLoginAttempts?: number;
  accountLockedUntil?: Date;
  twoFactorEnabled: boolean;
  twoFactorSecret?: string; // Encrypted
  preferredLanguage: string; // e.g., 'en', 'es'
  timezone: string; // User's preferred timezone for display purposes
  metadata?: Record<string, unknown>; // Custom fields
  createdByUserId?: User['id'];
  createdAt: Date;
  updatedAt: Date;
  updatedByUserId?: User['id'];
}

export interface UserWorkShift {
  id: string;
  userId: User['id'];
  locationId?: Location['id']; 
  clockInTime: Date;
  clockInDeviceId?: string; // Device used for clock-in
  clockInNotes?: string;
  clockOutTime?: Date;
  clockOutDeviceId?: string; // Device used for clock-out
  clockOutNotes?: string;
  breakDurationMinutes?: number; // Total break time during shift
  actualHoursWorked?: number; // Calculated: (clockOutTime - clockInTime) - breakDuration
  roleDuringShift?: UserRole | string; // Role performed during this specific shift
  isApproved?: boolean;
  approvedByUserId?: User['id'];
  approvalDate?: Date;
  timesheetId?: string; // Link to a payroll timesheet if applicable
  createdAt: Date;
  updatedAt: Date;
}


export interface TimeClockEntry extends UserWorkShift {
  restaurantId: string;

  clockInTimestamp: Date;
  clockInDeviceId?: string; // ID of the POS device used for clock-in
  clockInIpAddress?: string;
  clockInGeoLocation?: { lat: number; lng: number }; // If capturing location on clock-in
  clockInNotes?: string;

  clockOutTimestamp?: Date;
  clockOutDeviceId?: string;
  clockOutIpAddress?: string;
  clockOutGeoLocation?: { lat: number; lng: number };
  clockOutNotes?: string;

  // Breaks taken during the shift
  breaks?: {
    breakStartTimestamp: Date;
    breakEndTimestamp?: Date;
    durationMinutes?: number; // Calculated or entered
    isPaid: boolean;
    type?: "meal" | "rest" | "other";
  }[];
  totalBreakDurationMinutes?: number; // Calculated sum of unpaid break durations

  durationMinutes?: number; // Total duration from clock-in to clock-out (if clocked out)
  payableHours?: number; // durationMinutes - totalUnpaidBreakDurationMinutes, converted to hours

  rolePerformed?: User['roles'] | string; // Actual role performed
  isApproved: boolean; // For timesheet approval
  approvedByUserId?: User['id'];
  approvedAt?: Date;
  timesheetId?: string; // Link to a payroll timesheet
  editHistory?: { // If entries are manually edited
    editedAt: Date;
    editedByUserId: User['id'];
    originalClockIn?: Date;
    originalClockOut?: Date;
    reason: string;
  }[];
  notes?: string; // General notes for the entry
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  accessToken: string | null; // JWT or similar
  refreshToken?: string | null; // For refreshing access tokens
  tokenExpiry?: number; // Timestamp for access token expiry
  isLoading: boolean;
  error: string | null; // Error message for login failures, etc.
  currentShift?: UserWorkShift | null; // If user is currently clocked in
  effectivePermissions?: PermissionName[]; // Calculated permissions based on roles and direct assignments
}

export interface LoginCredentials {
  emailOrUsername: string;
  password?: string; // Password might be optional if using PIN or other methods
  pinCode?: string; // For POS terminal login
  restaurantId?: string; // May be needed if platform supports multiple restaurants on one login page
}

export interface RegisterUserData {
  restaurantId: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  roles: UserRole[];
  assignedLocationIds?: string[];
}

export interface UpdateUserProfileData {
  // Fields from User that can be updated by user or admin
  firstName?: string;
  lastName?: string;
  displayName?: string;
  email?: string; // May require re-verification
  phoneNumber?: string; // May require re-verification
  avatarUrl?: string;
  pinCode?: string; // For setting/changing PIN
  preferredLanguage?: string;
  timezone?: string;
}

export interface UpdateUserByAdminData extends UpdateUserProfileData {
  // Admin-specific updates
  roles?: UserRole[];
  permissions?: PermissionName[];
  assignedLocationIds?: string[];
  isActive?: boolean;
}

export interface PasswordResetRequest {
  email: string;
  restaurantId?: string;
}

export interface PasswordResetConfirmData {
  token: string; // Reset token received via email/SMS
  newPassword: string;
}

export interface ChangePasswordData {
  currentPassword?: string; // May not be needed if admin is resetting or 2FA is involved
  newPassword: string;
  userId: User['id']; // For admin changing other user's password
}

export interface VerifyEmailData {
  token: string;
}

export interface TwoFactorSetupResponse {
  otpAuthUrl: string; // e.g., otpauth://totp/YourApp:user@example.com?secret=JBSWY3DPEHPK3PXP&issuer=YourApp
  recoveryCodes?: string[];
}

export interface TwoFactorVerifyData {
  code: string; // The TOTP code entered by the user
}

export const ROLE_PERMISSIONS: Record<UserRole, PermissionName[]> = {
  owner: [
    // Essentially all permissions
    "dashboard:view", "business_profile:view", "business_profile:edit", "location:view", "location:create", "location:edit", "location:delete", "location_settings:edit", "menu:view", "menu:create_items", "menu:edit_items", "menu:delete_items", "menu:manage_categories", "menu:manage_modifiers", "menu:set_availability", "menu:set_pricing", "order:view_all", "order:create", "order:edit_any", "order:cancel_any", "order:apply_discount_item", "order:apply_discount_order", "order:process_payment", "order:issue_refund", "order:split_bill", "order:transfer_items", "order:change_status", "table_layout:view", "table_layout:edit", "table:view_status", "table:change_status", "table:assign_to_order", "table:assign_server", "customer:view", "customer:create", "customer:edit", "customer:delete", "customer:view_order_history", "loyalty:manage_points", "user:view_list", "user:view_details", "user:create", "user:edit_profile", "user:delete", "user:assign_role", "user:manage_permissions", "user:manage_shifts", "user:reset_password", "report:view_sales", "report:view_inventory", "report:view_staff_performance", "report:view_financial", "report:export_data", "inventory:view_stock", "inventory:manage_ingredients", "inventory:perform_stock_take", "inventory:record_wastage", "inventory:manage_purchase_orders", "inventory:manage_vendors", "reservation:view", "reservation:create", "reservation:edit", "reservation:cancel", "reservation:seat_party", "waitlist:manage", "promotion:view", "promotion:create", "promotion:edit", "promotion:activate_deactivate", "expense:manage", "tax_settings:manage", "accounting_integration:manage", "payout:view", "system_settings:view", "system_settings:edit", "printer_settings:manage", "device_settings:manage", "internal_communication:send_messages", "dynamic_pricing_rules:manage", "audit_log:view",
  ],
  admin: [
    "dashboard:view", "location:view", "location:create", "location:edit", "location:delete", "location_settings:edit", "menu:view", "menu:create_items", "menu:edit_items", "menu:delete_items", "menu:manage_categories", "menu:manage_modifiers", "menu:set_availability", "menu:set_pricing", "order:view_all", "order:create", "order:edit_any", "order:cancel_any", "order:apply_discount_item", "order:apply_discount_order", "order:process_payment", "order:issue_refund", "order:split_bill", "order:transfer_items", "order:change_status", "table_layout:view", "table_layout:edit", "table:view_status", "table:change_status", "table:assign_to_order", "table:assign_server", "customer:view", "customer:create", "customer:edit", "customer:delete", "customer:view_order_history", "loyalty:manage_points", "user:view_list", "user:view_details", "user:create", "user:edit_profile", "user:delete", "user:assign_role", "user:manage_permissions", "user:manage_shifts", "user:reset_password", "report:view_sales", "report:view_inventory", "report:view_staff_performance", "report:view_financial", "report:export_data", "inventory:view_stock", "inventory:manage_ingredients", "inventory:perform_stock_take", "inventory:record_wastage", "inventory:manage_purchase_orders", "inventory:manage_vendors", "reservation:view", "reservation:create", "reservation:edit", "reservation:cancel", "reservation:seat_party", "waitlist:manage", "promotion:view", "promotion:create", "promotion:edit", "promotion:activate_deactivate", "expense:manage", "tax_settings:manage", "accounting_integration:manage", "payout:view", "system_settings:view", "system_settings:edit", "printer_settings:manage", "device_settings:manage", "internal_communication:send_messages", "dynamic_pricing_rules:manage", "audit_log:view",
  ],
  manager: [
    "dashboard:view", "location:view", "location_settings:edit", "menu:view", "menu:edit_items", "menu:set_availability", "menu:set_pricing", "order:view_all", "order:create", "order:edit_any", "order:cancel_any", "order:apply_discount_order", "order:process_payment", "order:issue_refund", "order:split_bill", "order:transfer_items", "order:change_status", "table_layout:view", "table:view_status", "table:change_status", "table:assign_to_order", "table:assign_server", "customer:view", "customer:edit", "customer:view_order_history", "user:view_list", "user:view_details", "user:edit_own_profile", "user:manage_shifts", "report:view_sales", "report:view_inventory", "report:view_staff_performance", "inventory:view_stock", "inventory:perform_stock_take", "inventory:record_wastage", "inventory:manage_purchase_orders", "reservation:view", "reservation:create", "reservation:edit", "reservation:cancel", "reservation:seat_party", "waitlist:manage", "promotion:view", "promotion:edit", "expense:manage", "internal_communication:send_messages", "audit_log:view",
  ],
  shift_lead: [
    "dashboard:view", "menu:view", "menu:set_availability", "order:view_all", "order:create", "order:edit_own", "order:cancel_own", "order:apply_discount_item", "order:process_payment", "order:split_bill", "order:transfer_items", "order:change_status", "table:view_status", "table:change_status", "table:assign_to_order", "table:assign_server", "report:view_sales", "inventory:view_stock", "inventory:record_wastage", "reservation:view", "reservation:edit", "waitlist:manage", "internal_communication:send_messages",
  ],
  waiter: [
    "menu:view", "order:view_assigned", "order:create", "order:edit_own", "order:cancel_own", "order:change_status", "table:view_status", "table:assign_to_order", "reservation:view", "internal_communication:send_messages",
  ],
  cashier: [
    "menu:view", "order:view_all", "order:process_payment", "order:issue_refund", "order:apply_discount_order", "order:split_bill", "table:view_status", "internal_communication:send_messages",
  ],
  bartender: [
    "menu:view", "order:view_assigned", "order:create", "order:edit_own", "order:change_status", "inventory:view_stock", "inventory:record_wastage", // Bar specific inventory
    "internal_communication:send_messages",
  ],
  kitchen_staff: [
    "menu:view", "order:view_all", // View orders on KDS
    "order:change_status", // Update item/order status (e.g., preparing -> ready)
    "inventory:view_stock", "internal_communication:send_messages",
  ],
  delivery_driver: [
    "order:view_assigned", // View orders assigned for delivery
    "order:change_status", // Update delivery status
    "internal_communication:send_messages",
  ],
  host_staff: [
    "table_layout:view", "table:view_status", "table:change_status", "reservation:view", "reservation:create", "reservation:edit", "reservation:cancel", "reservation:seat_party", "waitlist:manage", "internal_communication:send_messages",
  ],
  back_office_staff: [
    "report:view_sales", "report:view_financial", "expense:manage", "payout:view", "audit_log:view",
  ],
  custom_role: [], // Starts with no permissions; all must be assigned directly
};
