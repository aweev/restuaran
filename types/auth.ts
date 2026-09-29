export type UserRole = "admin" | "manager" | "staff" | "kitchen" | "waiter"

export type PermissionName =
  // Menu permissions
  | "menu:view"
  | "menu:create"
  | "menu:edit"
  | "menu:delete"
  // Order permissions
  | "order:view"
  | "order:create"
  | "order:edit"
  | "order:delete"
  | "order:process"
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
  // Settings permissions
  | "settings:view"
  | "settings:edit"
  // Communication permissions
  | "send_messages"

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
  token: string | null
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
export const ROLE_PERMISSIONS: Record<UserRole, PermissionName[]> = {
  admin: [
    "menu:view",
    "menu:create",
    "menu:edit",
    "menu:delete",
    "order:view",
    "order:create",
    "order:edit",
    "order:delete",
    "order:process",
    "table:view",
    "table:create",
    "table:edit",
    "table:delete",
    "table:assign",
    "user:view",
    "user:create",
    "user:edit",
    "user:delete",
    "report:view",
    "report:export",
    "inventory:view",
    "inventory:create",
    "inventory:edit",
    "inventory:delete",
    "reservation:view",
    "reservation:create",
    "reservation:edit",
    "reservation:delete",
    "settings:view",
    "settings:edit",
    "send_messages",
  ],
  manager: [
    "menu:view",
    "menu:create",
    "menu:edit",
    "order:view",
    "order:create",
    "order:edit",
    "order:process",
    "table:view",
    "table:create",
    "table:edit",
    "table:assign",
    "user:view",
    "user:create",
    "user:edit",
    "report:view",
    "report:export",
    "inventory:view",
    "inventory:create",
    "inventory:edit",
    "reservation:view",
    "reservation:create",
    "reservation:edit",
    "reservation:delete",
    "settings:view",
    "settings:edit",
    "send_messages",
  ],
  staff: [
    "menu:view",
    "order:view",
    "order:create",
    "order:edit",
    "table:view",
    "table:assign",
    "reservation:view",
    "reservation:create",
    "send_messages",
  ],
  kitchen: ["menu:view", "order:view", "order:process", "inventory:view", "send_messages"],
  waiter: [
    "menu:view",
    "order:view",
    "order:create",
    "order:edit",
    "table:view",
    "table:assign",
    "reservation:view",
    "send_messages",
  ],
}
