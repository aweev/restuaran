"use client"

import { useMemo } from "react"
import { useCommand, useProjection } from "@/kernel/react/kernel-provider"
import type { KitchenQueueState, KitchenTicket } from "@/kernel/projections/builtins"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { RequireCapability } from "@/lib/auth-guard"
import { useFeedback } from "@/lib/feedback"

/**
 * Kitchen queue, kernel-backed. Replaces the legacy OrderContext polling view:
 * tickets come from the `kitchen.queue` projection (same events the display
 * wall uses), bumps are kernel commands. No 30s fetchOrders poll.
 */
function KitchenInner() {
  const { state: queue } = useProjection<KitchenQueueState>("kitchen.queue", 4000)
  const { run, pending } = useCommand()
  const { notify } = useFeedback()

  const tickets = useMemo(() => queue?.tickets ?? [], [queue])
  const queued = tickets.filter((t) => t.status === "queued")
  const inProgress = tickets.filter((t) => t.status === "in_progress")
  const ready = tickets.filter((t) => t.status === "ready")

  const bump = async (ticket: KitchenTicket) => {
    const target = ticket.lines.find((l) => l.status !== "ready")?.lineId
    if (!target) {
      for (const l of ticket.lines) {
        await run("kitchen.serveLine", { orderId: ticket.orderId, lineId: l.lineId }).catch(() => null)
      }
      notify("success", `Ticket ${ticket.orderId.slice(0, 8)} served`)
      return
    }
    const line = ticket.lines.find((l) => l.lineId === target)
    const cmd = line?.status === "sent" ? "kitchen.beginLine" : "kitchen.readyLine"
    const res = await run(cmd, { orderId: ticket.orderId, lineId: target })
    if (!res.success) notify("error", "Bump failed", res.error?.message)
  }

  const list = (rows: KitchenTicket[], empty: string) =>
    rows.length > 0 ? (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {rows.map((t) => (
          <Card key={t.orderId}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between text-sm">
                <span>#{t.orderId.slice(0, 8)} · {t.tableLabel}</span>
                <Badge variant="outline">{t.status.replace("_", " ")}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {t.dinerName && <p className="text-muted-foreground">{t.dinerName}</p>}
              <ul className="space-y-1">
                {t.lines.map((l) => (
                  <li key={l.lineId} className="flex justify-between gap-2">
                    <span>{l.quantity}× {l.name}</span>
                    <span className="text-muted-foreground">{l.status}</span>
                  </li>
                ))}
              </ul>
              <Button size="sm" className="w-full" disabled={pending} onClick={() => void bump(t)}>
                Bump
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    ) : (
      <Card>
        <CardContent className="flex h-40 items-center justify-center">
          <p className="text-muted-foreground">{empty}</p>
        </CardContent>
      </Card>
    )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Kitchen Display</h2>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-yellow-100 text-yellow-800">Queued: {queued.length}</Badge>
          <Badge variant="outline" className="bg-blue-100 text-blue-800">In progress: {inProgress.length}</Badge>
          <Badge variant="outline" className="bg-green-100 text-green-800">Ready: {ready.length}</Badge>
        </div>
      </div>

      <Tabs defaultValue="queued">
        <TabsList>
          <TabsTrigger value="queued">Queued ({queued.length})</TabsTrigger>
          <TabsTrigger value="in_progress">In progress ({inProgress.length})</TabsTrigger>
          <TabsTrigger value="ready">Ready ({ready.length})</TabsTrigger>
          <TabsTrigger value="all">All ({tickets.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="queued" className="mt-4">{list(queued, "No queued tickets")}</TabsContent>
        <TabsContent value="in_progress" className="mt-4">{list(inProgress, "Nothing cooking")}</TabsContent>
        <TabsContent value="ready" className="mt-4">{list(ready, "Nothing ready")}</TabsContent>
        <TabsContent value="all" className="mt-4">{list(tickets, "Kitchen is clear")}</TabsContent>
      </Tabs>
    </div>
  )
}

export default function KitchenPage() {
  return (
    <RequireCapability capability="order:view">
      <KitchenInner />
    </RequireCapability>
  )
}
