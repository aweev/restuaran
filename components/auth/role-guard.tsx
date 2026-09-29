"use client"

import type { ReactNode } from "react"
import { useAuth } from "@/context/AuthContext"
import type { UserRole } from "@/types/auth"

interface RoleGuardProps {
  roles: UserRole[]
  children: ReactNode
  fallback?: ReactNode
}

export function RoleGuard({ roles, children, fallback }: RoleGuardProps) {
  const { state } = useAuth()
  const { user } = state

  if (user && roles.includes(user.role)) {
    return <>{children}</>
  }

  return fallback ? <>{fallback}</> : null
}
