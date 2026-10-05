export type UserRole =
  | "admin"
  | "manager"
  | "owner"
  | "server"
  | "waiter"
  | "host"
  | "host_staff"
  | "cashier"
  | "bartender"
  | "delivery"
  | "kitchen"
  | "staff"

export type PermissionName =
  // Menu permissions
  | "menu:view"
  | "menu:create"
  | "menu:edit"
  | "menu:delete"
  | "menu:manage"
  // Order permissions
  | "order:view"
  | "order:create"
  | "order:edit"
  | "order:delete"
  | "order:process"
  | "order:comp"
  | "order:pay"
  // Table permissions
  | "table:view"
  | "table:create"
  | "table:edit"
  | "table:delete"
  | "table:assign"
  // User permissions
  | "user:view"
  | "user:create"
  | "user:edit"
  | "user:delete"
  | "staff:view"
  | "staff:schedule"
  | "staff:clock"
  // Report permissions
  | "report:view"
  | "report:export"
  // Inventory permissions
  | "inventory:view"
  | "inventory:create"
  | "inventory:edit"
  | "inventory:delete"
  // Reservation permissions
  | "reservation:view"
  | "reservation:create"
  | "reservation:edit"
  | "reservation:delete"
  | "reservation:manage"
  // Settings permissions
  | "settings:view"
  | "settings:edit"
  // Communication permissions
  | "send_messages"
  // Gift card permissions
  | "giftcard:view"
  | "giftcard:issue"
  | "giftcard:redeem"
  | "giftcard:manage"
  // Venue (multi-venue) permissions
  | "venue:view"
  | "venue:manage"
  // Waitlist permissions
  | "waitlist:view"
  | "waitlist:manage"
  // Customer permissions
  | "customer:view"
  | "customer:manage"
  | "customer:view_pii"
  // Promotion permissions
  | "promotion:view"
  | "promotion:manage"
  // Feedback permissions
  | "feedback:submit"
  // Integration permissions
  | "integration:view"
  | "integration:manage"
  // Audit permissions
  | "audit:view"

export interface User {
  id: string
  name: string
  email: string
  role: UserRole
  permissions?: PermissionName[]
  customPermissions?: PermissionName[]
  avatar?: string
  phone?: string
  address?: string
  shifts?: UserShift[]
}

export interface UserShift {
  id: string
  userId: string
  startTime: string
  endTime?: string
  totalHours?: number
  hoursWorked?: number
  notes?: string
}

export interface AuthState {
  user: User | null
  isAuthenticated: boolean
  accessToken: string | null
  loading: boolean
  error: string | null
  currentShift: UserShift | null
}

export interface LoginCredentials {
  email: string
  password: string
}

export interface RegisterUserData {
  name: string
  email: string
  password: string
  role: UserRole
  permissions?: PermissionName[]
  phone?: string
  address?: string
}

export interface UpdateUserData {
  name?: string
  email?: string
  role?: UserRole
  permissions?: PermissionName[]
  avatar?: string
  phone?: string
  address?: string
}

export interface PasswordResetConfirm {
  token: string
  password: string
  confirmPassword: string
}

export interface ChangePasswordData {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}

// Role-based permission mapping
// Canonical roles align with db/schema.sql and kernel/tenant/permission-map.ts.
export const ROLE_PERMISSIONS: Record<UserRole, PermissionName[]> = {
  admin: [
    "menu:view", "menu:create", "menu:edit", "menu:delete",
    "order:view", "order:create", "order:edit", "order:delete", "order:process",
    "order:comp", "order:create", "order:edit", "order:process", "order:pay",
    "table:view", "table:create", "table:edit", "table:delete", "table:assign",
    "user:view", "user:create", "user:edit", "user:delete",
    "report:view", "report:export",
    "inventory:view", "inventory:create", "inventory:edit", "inventory:delete",
    "reservation:view", "reservation:create", "reservation:edit", "reservation:delete",
    "settings:view", "settings:edit",
    "send_messages",
    "giftcard:view", "giftcard:issue", "giftcard:redeem",
    "venue:view", "venue:manage",
  ],
  manager: [
    "menu:view", "menu:create", "menu:edit", "menu:delete",
    "order:view", "order:create", "order:edit", "order:process",
    "order:comp", "order:pay",
    "table:view", "table:create", "table:edit", "table:delete", "table:assign",
    "user:view", "user:create", "user:edit",
    "report:view", "report:export",
    "inventory:view", "inventory:create", "inventory:edit",
    "reservation:view", "reservation:create", "reservation:edit", "reservation:delete",
    "settings:view", "settings:edit",
    "send_messages",
    "giftcard:view", "giftcard:issue",
    "venue:view", "venue:manage",
  ],
  owner: [
    "menu:view", "menu:create", "menu:edit", "menu:delete",
    "order:view", "order:create", "order:edit", "order:process", "order:pay",
    "order:comp",
    "table:view", "table:create", "table:edit", "table:delete", "table:assign",
    "user:view", "user:create", "user:edit", "user:delete",
    "report:view", "report:export",
    "inventory:view", "inventory:create", "inventory:edit", "inventory:delete",
    "reservation:view", "reservation:create", "reservation:edit", "reservation:delete",
    "settings:view", "settings:edit",
    "send_messages",
    "giftcard:view", "giftcard:issue", "giftcard:redeem",
    "venue:view", "venue:manage",
  ],
  server: [
    "menu:view",
    "order:view", "order:create", "order:edit",
    "table:view", "table:edit", "table:assign",
    "reservation:view", "reservation:create",
    "send_messages",
  ],
  waiter: [
    "menu:view",
    "order:view", "order:create", "order:edit",
    "table:view", "table:edit", "table:assign",
    "reservation:view", "reservation:create",
    "send_messages",
  ],
  host: [
    "table:view",
    "reservation:view", "reservation:create", "reservation:edit",
    "waitlist:view", "waitlist:manage",
    "customer:view",
    "send_messages",
  ],
  "host_staff": [
    "table:view",
    "reservation:view", "reservation:create",
    "waitlist:view",
    "customer:view",
    "send_messages",
  ],
  cashier: [
    "menu:view",
    "order:view", "order:create", "order:edit", "order:pay",
    "table:view",
    "reservation:view",
    "customer:view", "customer:manage",
    "send_messages",
    "giftcard:view", "giftcard:redeem",
    "promotion:view",
  ],
  bartender: [
    "menu:view",
    "order:view", "order:create", "order:edit", "order:pay",
    "table:view",
    "send_messages",
  ],
  delivery: [
    "order:view", "order:process",
    "table:view",
    "send_messages",
  ],
  kitchen: ["menu:view", "order:view", "order:process", "inventory:view", "send_messages"],
  staff: [
    "menu:view",
    "order:view", "order:create", "order:edit",
    "table:view",
    "send_messages",
  ],
}
