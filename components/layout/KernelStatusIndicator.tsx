"use client"

import { useKernel } from "@/kernel/react/kernel-provider"
import { Wifi, WifiOff, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

export function KernelStatusIndicator() {
  const { connection, pendingCount } = useKernel()

  const getStatusConfig = () => {
    switch (connection) {
      case "live":
        return { icon: Wifi, color: "text-green-500", label: "Live", tooltip: "Connected" }
      case "connecting":
        return { icon: Loader2, color: "text-yellow-500 animate-spin", label: "Connecting", tooltip: "Reconnecting..." }
      case "offline":
        return { icon: WifiOff, color: "text-red-500", label: "Offline", tooltip: "Offline - changes queued" }
    }
  }

  const config = getStatusConfig()
  const Icon = config.icon

  return (
    <div className="flex items-center gap-2 px-3 py-1.5" title={config.tooltip}>
      <Icon className={cn("h-4 w-4", config.color)} aria-hidden />
      <span className={cn("text-xs font-medium", config.color)}>{config.label}</span>
      {pendingCount > 0 && (
        <span
          className={cn(
            "flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-semibold text-white animate-pulse",
            connection === "offline" && "bg-yellow-500"
          )}
          aria-label={`${pendingCount} pending change${pendingCount !== 1 ? "s" : ""}`}
        >
          {pendingCount > 9 ? "9+" : pendingCount}
        </span>
      )}
    </div>
  )
}