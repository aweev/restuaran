"use client"

import { useEffect, useMemo, useState } from "react"
import { useProjection } from "@/kernel/react/kernel-provider"
import type { KitchenQueueState } from "@/kernel/projections/builtins"
import type { TableBoardState } from "@/kernel/projections/builtins"
import type { InventoryBoardState } from "@/kernel/projections/builtins"
import type { OrderBoardState } from "@/kernel/projections/orders-board"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { TriangleAlert, AlertCircle, Clock, Truck, ChefHat, Users, WifiOff, Zap, ShoppingCart, CheckCircle, Info } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { cn } from "@/lib/utils"

export interface Signal {
  id: string
  type: "warning" | "error" | "info" | "success"
  category: "kitchen" | "tables" | "inventory" | "orders" | "staff" | "system"
  title: string
  description: string
  timestamp: string
  actionHref?: string
  actionLabel?: string
  dismissible?: boolean
}

interface SignalDashboardProps {
  maxSignals?: number
  categories?: Signal["category"][]
}

const SLA_THRESHOLD_MS = 20 * 60 * 1000 // 20 minutes
const TABLE_WAIT_THRESHOLD_MS = 15 * 60 * 1000 // 15 minutes

export function SignalDashboard({ maxSignals = 10, categories }: SignalDashboardProps) {
  const { state: kitchenState } = useProjection<KitchenQueueState>("kitchen.queue", 5000)
  const { state: tableState } = useProjection<TableBoardState>("tables.board", 5000)
  const { state: inventoryState } = useProjection<InventoryBoardState>("inventory.board", 30000)
  const { state: orderState } = useProjection<OrderBoardState>("orders.board", 5000)

  const [signals, setSignals] = useState<Signal[]>([])
  const [dismissedIds, setDismissedIds] = useState<string[]>([])

  const dismiss = (id: string) => setDismissedIds((prev) => (prev.includes(id) ? prev : [...prev, id]));

  // Generate signals from projections
  useEffect(() => {
    const newSignals: Signal[] = []
    const now = Date.now()

    // Kitchen SLA breaches
    if (kitchenState?.tickets) {
      for (const ticket of kitchenState.tickets) {
        if (ticket.status === "queued" || ticket.status === "in_progress") {
          const sentTime = Date.parse(ticket.sentAt)
          if (!Number.isNaN(sentTime) && now - sentTime > SLA_THRESHOLD_MS) {
            newSignals.push({
              id: `kitchen-sla-${ticket.orderId}`,
              type: "error",
              category: "kitchen",
              title: `SLA breach: Table ${ticket.tableLabel}`,
              description: `Order waiting ${formatDistanceToNow(new Date(sentTime), { addSuffix: true })} — expedite now`,
              timestamp: ticket.sentAt,
              actionHref: `/dashboard/kitchen/display?order=${ticket.orderId}`,
              actionLabel: "View on KDS",
            })
          }
        }
        // Tickets with ready items not yet served
        if (ticket.status === "ready") {
          newSignals.push({
            id: `kitchen-ready-${ticket.orderId}`,
            type: "info",
            category: "kitchen",
            title: `Ready for pickup: Table ${ticket.tableLabel}`,
            description: `${ticket.lines.length} item${ticket.lines.length !== 1 ? "s" : ""} ready`,
            timestamp: ticket.sentAt,
            actionHref: `/dashboard/kitchen/display?order=${ticket.orderId}`,
            actionLabel: "Mark served",
          })
        }
      }
    }

    // Tables waiting too long
    if (tableState?.rows) {
      for (const table of tableState.rows) {
        if (table.status === "occupied" && table.seatedAt) {
          const seatedTime = Date.parse(table.seatedAt)
          if (!Number.isNaN(seatedTime) && now - seatedTime > TABLE_WAIT_THRESHOLD_MS) {
            newSignals.push({
              id: `table-wait-${table.tableId}`,
              type: "warning",
              category: "tables",
              title: `Long wait: Table ${table.label}`,
              description: `Seated ${formatDistanceToNow(new Date(seatedTime), { addSuffix: true })}`,
              timestamp: table.seatedAt,
              actionHref: `/dashboard/tables?table=${table.tableId}`,
              actionLabel: "Check table",
            })
          }
        }
        // Dirty tables needing bussing
        if (table.status === "dirty") {
          newSignals.push({
            id: `table-dirty-${table.tableId}`,
            type: "info",
            category: "tables",
            title: `Table ${table.label} needs bussing`,
            description: "Marked dirty, awaiting cleanup",
            timestamp: new Date().toISOString(),
            actionHref: `/dashboard/tables?table=${table.tableId}`,
            actionLabel: "View table",
          })
        }
      }
    }

    // Low inventory / 86'd items
    if (inventoryState?.rows) {
      for (const item of inventoryState.rows) {
        if (!item.isActive) continue
        if (item.onHand <= item.reorderPoint && item.reorderPoint > 0) {
          newSignals.push({
            id: `inventory-low-${item.itemId}`,
            type: item.onHand <= 0 ? "error" : "warning",
            category: "inventory",
            title: item.onHand <= 0 ? `Out of stock: ${item.name}` : `Low stock: ${item.name}`,
            description: `${item.onHand} ${item.unit} remaining (reorder at ${item.reorderPoint})`,
            timestamp: new Date().toISOString(),
            actionHref: `/dashboard/inventory?item=${item.itemId}`,
            actionLabel: "Reorder",
          })
        }
      }
    }

    // Order SLA breaches (from orders.board)
    if (orderState?.rows) {
      for (const order of orderState.rows) {
        if (order.status === "open" || order.status === "draft") {
          const openedTime = Date.parse(order.openedAt)
          if (!Number.isNaN(openedTime) && now - openedTime > SLA_THRESHOLD_MS) {
            newSignals.push({
              id: `order-sla-${order.orderId}`,
              type: "error",
              category: "orders",
              title: `Order SLA breach: ${order.tableId ? `Table ${order.tableId}` : "Takeaway"}`,
              description: `Open for ${formatDistanceToNow(new Date(openedTime), { addSuffix: true })}`,
              timestamp: order.openedAt,
              actionHref: `/dashboard/orders/${order.orderId}`,
              actionLabel: "View order",
            })
          }
        }
        // Unpaid completed orders
        if (order.status === "closed" && order.balanceDue > 0) {
          newSignals.push({
            id: `order-unpaid-${order.orderId}`,
            type: "warning",
            category: "orders",
            title: `Unpaid order: ${order.tableId ? `Table ${order.tableId}` : "Takeaway"}`,
            description: `$${order.balanceDue.toFixed(2)} balance due`,
            timestamp: order.closedAt ?? order.updatedAt,
            actionHref: `/dashboard/orders/${order.orderId}`,
            actionLabel: "Collect payment",
          })
        }
      }
    }

    // Sort by severity and timestamp
    newSignals.sort((a, b) => {
      const severityOrder = { error: 0, warning: 1, info: 2, success: 3 }
      const severityDiff = severityOrder[a.type] - severityOrder[b.type]
      if (severityDiff !== 0) return severityDiff
      return Date.parse(b.timestamp) - Date.parse(a.timestamp)
    })

    for (const s of newSignals) {
      if (s.dismissible === undefined) s.dismissible = true;
    }
    setSignals(newSignals.slice(0, maxSignals))
  }, [kitchenState, tableState, inventoryState, orderState, maxSignals])

  const filteredSignals = useMemo(() => {
    const visible = signals.filter((s) => !dismissedIds.includes(s.id))
    if (!categories || categories.length === 0) return visible
    return visible.filter((s) => categories.includes(s.category))
  }, [signals, categories, dismissedIds])

  const signalsByCategory = useMemo(() => {
    const grouped: Record<Signal["category"], Signal[]> = {
      kitchen: [],
      tables: [],
      inventory: [],
      orders: [],
      staff: [],
      system: [],
    }
    for (const signal of filteredSignals) {
      grouped[signal.category].push(signal)
    }
    return grouped
  }, [filteredSignals])

  const totalCount = filteredSignals.length
  const errorCount = filteredSignals.filter((s) => s.type === "error").length
  const warningCount = filteredSignals.filter((s) => s.type === "warning").length

  if (totalCount === 0) {
    return (
      <Card className="bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-green-700 dark:text-green-400">
            <CheckCircle className="h-5 w-5" />
            All clear
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-green-600 dark:text-green-500">
            No active signals. Service is running smoothly.
          </p>
        </CardContent>
      </Card>
    )
  }

  const categoryIcons: Record<Signal["category"], React.ReactNode> = {
    kitchen: <ChefHat className="h-4 w-4" />,
    tables: <Users className="h-4 w-4" />,
    inventory: <Truck className="h-4 w-4" />,
    orders: <ShoppingCart className="h-4 w-4" />,
    staff: <Users className="h-4 w-4" />,
    system: <WifiOff className="h-4 w-4" />,
  }

  const categoryLabels: Record<Signal["category"], string> = {
    kitchen: "Kitchen",
    tables: "Tables",
    inventory: "Inventory",
    orders: "Orders",
    staff: "Staff",
    system: "System",
  }

  return (
    <div className="space-y-4" aria-live="polite" aria-atomic="false">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium">Signals</span>
          <Badge variant={errorCount > 0 ? "destructive" : warningCount > 0 ? "secondary" : "outline"} className="gap-1">
            <Zap className="h-3 w-3" />
            {totalCount} active
          </Badge>
        </div>
      </div>

      <ScrollArea className="h-96">
        <div className="space-y-4">
          {(Object.entries(categoryLabels) as [Signal["category"], string][]).map(([category, label]) => {
            const categorySignals = signalsByCategory[category]
            if (!categorySignals.length) return null
            return (
              <div key={category} className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-medium uppercase text-muted-foreground">
                  {categoryIcons[category]}
                  <span>{label} ({categorySignals.length})</span>
                </div>
                <div className="space-y-1 pl-6 border-l border-muted/20">
                  {categorySignals.map((signal) => (
                    <Alert
                      key={signal.id}
                      variant={signal.type === "error" ? "destructive" : "default"}
                      className={cn("mb-1", signal.dismissible && "cursor-pointer")}
                    >
                      <div className="flex gap-2">
                        {signal.type === "error" && <AlertCircle className="h-4 w-4 shrink-0" />}
                        {signal.type === "warning" && <TriangleAlert className="h-4 w-4 shrink-0" />}
                        {signal.type === "info" && <Info className="h-4 w-4 shrink-0" />}
                        {signal.type === "success" && <CheckCircle className="h-4 w-4 shrink-0" />}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <AlertTitle className="text-sm">{signal.title}</AlertTitle>
                            {signal.dismissible !== false && (
                              <button
                                type="button"
                                aria-label={`Dismiss ${signal.title}`}
                                onClick={() => dismiss(signal.id)}
                                className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                              >
                                ×
                              </button>
                            )}
                          </div>
                          <AlertDescription className="text-xs">{signal.description}</AlertDescription>
                          <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            <span>{formatDistanceToNow(new Date(signal.timestamp), { addSuffix: true })}</span>
                            {signal.actionHref && signal.actionLabel && (
                              <a href={signal.actionHref} className="underline hover:text-primary">
                                {signal.actionLabel}
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    </Alert>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </ScrollArea>
    </div>
  )
}