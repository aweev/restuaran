"use client"

import type { ReactNode } from "react"
import { useAuth } from "@/context/AuthContext"
import type { PermissionName } from "@/types/auth"
import { hasPermission, hasAnyPermission, hasAllPermissions } from "@/lib/auth-utils"

interface PermissionGuardProps {
  permission: PermissionName
  children: ReactNode
  fallback?: ReactNode
}

export function PermissionGuard({ permission, children, fallback }: PermissionGuardProps) {
  const { state } = useAuth()
  const { user } = state

  if (user && hasPermission(user, permission)) {
    return <>{children}</>
  }

  return fallback ? <>{fallback}</> : null
}

interface AnyPermissionGuardProps {
  permissions: PermissionName[]
  children: ReactNode
  fallback?: ReactNode
}

export function AnyPermissionGuard({ permissions, children, fallback }: AnyPermissionGuardProps) {
  const { state } = useAuth()
  const { user } = state

  if (user && hasAnyPermission(user, permissions)) {
    return <>{children}</>
  }

  return fallback ? <>{fallback}</> : null
}

interface AllPermissionsGuardProps {
  permissions: PermissionName[]
  children: ReactNode
  fallback?: ReactNode
}

export function AllPermissionsGuard({ permissions, children, fallback }: AllPermissionsGuardProps) {
  const { state } = useAuth()
  const { user } = state

  if (user && hasAllPermissions(user, permissions)) {
    return <>{children}</>
  }

  return fallback ? <>{fallback}</> : null
}
