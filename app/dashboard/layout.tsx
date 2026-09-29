"use client"

import type React from "react"

import { useMediaQuery } from "@/hooks/useMediaQuery"
import { DashboardNav } from "@/components/dashboard/dashboard-nav"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const isDesktop = useMediaQuery("(min-width: 768px)")

  return (
    <div className="flex min-h-screen flex-col">
      <DashboardHeader />
      <div className="flex flex-1">
        {isDesktop ? (
          <aside className="hidden w-64 border-r bg-background md:block">
            <DashboardNav />
          </aside>
        ) : null}
        <main className="flex-1 overflow-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  )
}
