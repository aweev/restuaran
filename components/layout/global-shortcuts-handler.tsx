"use client"

import { useRouter } from "next/navigation"
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts"

export function GlobalShortcutsHandler() {
  const router = useRouter()

  useKeyboardShortcuts([
    {
      key: "F2",
      callback: () => router.push("/dashboard/orders"),
      description: "Quick Navigate to Orders",
    },
    {
      key: "F4",
      callback: () => router.push("/dashboard/tables"),
      description: "Quick Navigate to Tables",
    },
    {
      key: "F8",
      callback: () => router.push("/dashboard/kitchen"),
      description: "Quick Navigate to Kitchen Display",
    },
  ])

  return null
}
