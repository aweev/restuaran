"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  BarChart3,
  Coffee,
  FileText,
  Home,
  LayoutGrid,
  Settings,
  ShoppingCart,
  Users,
  Utensils,
  Calendar,
  Package,
} from "lucide-react"

const items = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: Home,
  },
  {
    title: "Orders",
    href: "/dashboard/orders",
    icon: ShoppingCart,
  },
  {
    title: "Menu",
    href: "/dashboard/menu",
    icon: Coffee,
  },
  {
    title: "Tables",
    href: "/dashboard/tables",
    icon: LayoutGrid,
  },
  {
    title: "Table Management",
    href: "/dashboard/tables/management",
    icon: Utensils,
  },
  {
    title: "Reservations",
    href: "/dashboard/reservations",
    icon: Calendar,
  },
  {
    title: "Kitchen",
    href: "/dashboard/kitchen",
    icon: Package,
  },
  {
    title: "Reports",
    href: "/dashboard/reports",
    icon: FileText,
  },
  {
    title: "Analytics",
    href: "/dashboard/analytics",
    icon: BarChart3,
  },
  {
    title: "Inventory",
    href: "/dashboard/inventory",
    icon: Package,
  },
  {
    title: "Staff",
    href: "/dashboard/staff",
    icon: Users,
  },
  {
    title: "Settings",
    href: "/dashboard/settings",
    icon: Settings,
  },
]

export function DashboardNav() {
  const pathname = usePathname()

  return (
    <nav className="grid items-start gap-2">
      {items.map((item, index) => (
        <Link
          key={index}
          href={item.href}
          className={cn(
            "group flex items-center rounded-md px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground",
            pathname === item.href ? "bg-accent" : "transparent",
          )}
        >
          <item.icon className="mr-2 h-4 w-4" />
          <span>{item.title}</span>
        </Link>
      ))}
    </nav>
  )
}
