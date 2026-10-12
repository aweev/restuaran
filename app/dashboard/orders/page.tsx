"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useCommand, useProjection } from "@/kernel/react/kernel-provider"
import type { OrderBoardRow, OrderBoardState } from "@/kernel/projections/orders-board"
import { boardGroup as uiStatus } from "@/kernel/order-status"
import {
  PageHeader,
  LoadingGrid,
  EmptyState,
  StatusBadge,
  ConnectionPill,
  StaleDataNotice,
} from "@/components/pos/ui-states"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { useFeedback } from "@/lib/feedback"
import { RequireCapability } from "@/lib/auth-guard"
import { Search, Plus } from "lucide-react"

/**
 * The Orders screen, reading the event store rather than the legacy REST
 * collection.
 *
 * This is the reference implementation of the kernel-first read path: the list
 * is a projection (`orders.board`), so it arrives pre-joined and pre-totalled
 * with no client-side aggregation, and every mutation is a command carrying the
 * same invariants the kitchen, kiosk and marketplace get.
 */

const money = (n: number) => `$${n.toFixed(2)}`

// uiStatus: canonical board grouping — see kernel/order-status.ts.

export default function OrdersPage() {
  return (
    <RequireCapability capability="order:view">
      <OrdersBoard />
    </RequireCapability>
  )
}

function OrdersBoard() {
  const { state, connection } = useProjection<OrderBoardState>("orders.board", 4000)
  const { run, pending, pendingCount } = useCommand()
  const { notify } = useFeedback()
  const [query, setQuery] = useState("")
  const [tab, setTab] = useState("all")

  // `state` is null until the first projection read lands, so a stable empty
  // array is needed: `?? []` inline would hand useMemo a new reference every
  // render and defeat its caching.
  const rows = useMemo(() => state?.rows ?? [], [state])

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: rows.length }
    for (const row of rows) {
      const s = uiStatus(row)
      c[s] = (c[s] ?? 0) + 1
    }
    return c
  }, [rows])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter((row) => {
      if (tab !== "all" && uiStatus(row) !== tab) return false
      if (!q) return true
      return (
        row.dinerName?.toLowerCase().includes(q) ||
        row.tableId?.toLowerCase().includes(q) ||
        row.orderId.toLowerCase().includes(q) ||
        row.lines.some((l) => l.name.toLowerCase().includes(q))
      )
    })
  }, [rows, query, tab])

  /**
   * Send to kitchen is the one write this screen owns. No optimistic update is
   * applied here: the projection is the source of truth, so a local guess would
   * be overwritten by the next poll and could briefly contradict the aggregate.
   */
  const sendToKitchen = async (orderId: string) => {
    const result = await run("order.sendToKitchen", { orderId })
    if (result.success) notify("success", "Sent to kitchen")
    else notify("error", "Could not send to kitchen", result.error?.message)
  }

  if (!state) return <LoadingGrid count={6} />

  return (
    <div className="space-y-4" id="orders-header">
      <PageHeader
        title="Orders"
        subtitle={`${rows.length} tracked ${rows.length === 1 ? "check" : "checks"}`}
        live={connection === "live"}
        actions={
          <>
            <ConnectionPill state={connection} />
            {pendingCount > 0 && (
              <Badge variant="offline" title="Queued changes waiting for a connection">
                {pendingCount} queued
              </Badge>
            )}
            <Button disabled={pending} id="create-order-button">
              <Plus className="mr-2 h-4 w-4" /> New Order
            </Button>
          </>
        }
      />

      {connection === "offline" && rows.length > 0 && <StaleDataNotice />}

      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search by diner, table or item..."
          className="pl-8"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search orders"
        />
      </div>

      <Tabs value={tab} onValueChange={setTab} id="order-filters">
        <TabsList className="mb-4 flex-wrap">
          <TabsTrigger value="all">All ({counts.all ?? 0})</TabsTrigger>
          <TabsTrigger value="draft">⏸ Parked ({counts.draft ?? 0})</TabsTrigger>
          <TabsTrigger value="pending">Pending ({counts.pending ?? 0})</TabsTrigger>
          <TabsTrigger value="preparing">Preparing ({counts.preparing ?? 0})</TabsTrigger>
          <TabsTrigger value="ready">Ready ({counts.ready ?? 0})</TabsTrigger>
          <TabsTrigger value="served">Served ({counts.served ?? 0})</TabsTrigger>
          <TabsTrigger value="completed">Completed ({counts.completed ?? 0})</TabsTrigger>
          <TabsTrigger value="voided">Voided ({counts.voided ?? 0})</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="space-y-4">
          <OrdersGrid rows={visible} pending={pending} onSend={sendToKitchen} query={query} tab={tab} />
        </TabsContent>
      </Tabs>
    </div>
  )
}



/**
 * Card grid + empty state, split out so the page body stays readable and the
 * list can be reused by the order-detail sidebar later.
 */
function OrdersGrid({
  rows,
  pending,
  onSend,
  query,
  tab,
}: {
  rows: OrderBoardRow[]
  pending: boolean
  onSend: (orderId: string) => void
  query: string
  tab: string
}) {
  if (rows.length === 0) {
    return (
      <EmptyState
        title={query ? "No matching orders" : tab === "draft" ? "No parked checks" : "No checks yet"}
        hint={
          query
            ? "Try a different name, table or item."
            : tab === "draft"
              ? "Parked checks wait here — ring items on New Order, then Park instead of sending."
              : "Checks appear here the moment a server rings one in."
        }
      />
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {rows.map((row) => {
        const unsent = row.lines.filter((l) => l.status === "open").length
        const settled = row.status === "closed" || row.status === "voided"
        return (
          <Card key={row.orderId} className="pos-card-hover">
            <CardContent className="space-y-3 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-semibold">
                    {row.dinerName ?? (row.tableId ? `Table ${row.tableId}` : "Walk-in")}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {row.lines.length} {row.lines.length === 1 ? "item" : "items"} · {row.channel}
                  </p>
                </div>
                <StatusBadge value={uiStatus(row)} kind="order" />
              </div>

              <ul className="space-y-1 text-sm">
                {row.lines.slice(0, 4).map((line) => (
                  <li key={line.lineId} className="flex items-baseline justify-between gap-2">
                    <span className="min-w-0 truncate text-muted-foreground">
                      <span className="font-medium text-foreground">{line.quantity}×</span> {line.name}
                      {line.modifiers.length > 0 && (
                        <span className="text-xs"> ({line.modifiers.join(", ")})</span>
                      )}
                    </span>
                    <span className="shrink-0 tabular-nums text-xs">{money(line.lineTotal)}</span>
                  </li>
                ))}
                {row.lines.length > 4 && (
                  <li className="text-xs text-muted-foreground">+{row.lines.length - 4} more</li>
                )}
              </ul>

              <div className="flex items-center justify-between border-t pt-3">
                <div className="text-sm">
                  <span className="text-muted-foreground">Total </span>
                  <span className="font-semibold tabular-nums">{money(row.total)}</span>
                  {row.balanceDue > 0.004 && (
                    <span className="ml-2 text-xs text-status-dirty">{money(row.balanceDue)} due</span>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/dashboard/orders/${row.orderId}`}>View</Link>
                  </Button>
                  {unsent > 0 && !settled && (
                    <Button size="sm" disabled={pending} onClick={() => onSend(row.orderId)}>
                      Send {unsent}
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
