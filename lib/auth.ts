import { jwtDecode } from "jwt-decode"
import { type User, type PermissionName, ROLE_PERMISSIONS } from "@/types/auth"

interface JwtPayload {
  sub: string
  email: string
  role: string
  exp: number
  iat: number
}

export function isTokenExpired(token: string): boolean {
  try {
    const decoded = jwtDecode<JwtPayload>(token)
    const currentTime = Date.now() / 1000
    return decoded.exp < currentTime
  } catch {
    return true
  }
}

export function getUserPermissions(user: User): PermissionName[] {
  if (!user) return []

  // Start with role-based permissions
  const rolePermissions = ROLE_PERMISSIONS[user.role] || []

  // Add any custom permissions assigned to the user
  const customPermissions = user.customPermissions || []

  // Combine and remove duplicates
  return [...new Set([...rolePermissions, ...customPermissions])]
}

export function hasPermission(user: User | null, permission: PermissionName): boolean {
  if (!user) return false

  const permissions = getUserPermissions(user)
  return permissions.includes(permission)
}

export function hasAnyPermission(user: User | null, permissions: PermissionName[]): boolean {
  if (!user) return false

  const userPermissions = getUserPermissions(user)
  return permissions.some((permission) => userPermissions.includes(permission))
}

export function hasAllPermissions(user: User | null, permissions: PermissionName[]): boolean {
  if (!user) return false

  const userPermissions = getUserPermissions(user)
  return permissions.every((permission) => userPermissions.includes(permission))
}

// Format duration in hours and minutes
export function formatDuration(startTime: string, endTime?: string): string {
  if (!endTime) return "In progress"

  const start = new Date(startTime).getTime()
  const end = new Date(endTime).getTime()
  const durationMs = end - start

  const hours = Math.floor(durationMs / (1000 * 60 * 60))
  const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60))

  return `${hours}h ${minutes}m`
}

// Calculate hours worked
export function calculateHoursWorked(startTime: string, endTime?: string): number {
  if (!endTime) return 0

  const start = new Date(startTime).getTime()
  const end = new Date(endTime).getTime()
  const durationMs = end - start

  return Number.parseFloat((durationMs / (1000 * 60 * 60)).toFixed(2))
}
