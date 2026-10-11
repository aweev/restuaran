"use client"

import { useEffect, useMemo, useState } from "react"
import { useCommand, useProjection } from "@/kernel/react/kernel-provider"
import type { KitchenQueueState, KitchenTicket } from "@/kernel/projections/builtins"
import { useProjection as useBoardProjection } from "@/kernel/react/kernel-provider"
import type { OrderBoardState } from "@/kernel/projections/orders-board"
import type { MenuBoardState } from "@/kernel/modules/menu.module"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { RefreshCw, Volume2, VolumeX, Flame } from "lucide-react"
import { KitchenCompletedOrders } from "@/components/kitchen/kitchen-completed-orders"
import { KitchenPerformanceMetrics } from "@/components/kitchen/kitchen-performance-metrics"
import { KitchenSocketIntegration } from "@/components/kitchen/kitchen-socket-integration"
import { KitchenNotificationSettings } from "@/components/kitchen/kitchen-notification-settings"
import { KitchenStaffAssignment } from "@/components/kitchen/kitchen-staff-assignment"
import { KernelStatusIndicator } from "@/components/layout/KernelStatusIndicator"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useKitchen } from "@/context/KitchenContext"
import { useFeedback } from "@/lib/feedback"
import { getVenueSettings } from "@/lib/settings"
import type { Order } from "@/types"

const ALLERGENS = ["milk", "egg", "nut", "peanut", "gluten", "wheat", "shellfish", "shrimp", "soy", "sesame", "fish"] as const;

function allergensIn(text: string | undefined | null): string[] {
  if (!text) return [];
  const lower = text.toLowerCase();
  return ALLERGENS.filter((a) => lower.includes(a));
}

export default function KitchenDisplayPage() {
  const { state: queue } = useProjection<KitchenQueueState>("kitchen.queue", 2000)
  const { state: board } = useBoardProjection<OrderBoardState>("orders.board", 5000)
  const { state: menu } = useBoardProjection<MenuBoardState>("menu.board", 10000)
  const { run } = useCommand()
  const { notify } = useFeedback()
  const { state: kitchenState, toggleSound } = useKitchen()
  const [refreshing, setRefreshing] = useState(false)
  const [refreshNonce, setRefreshNonce] = useState(0)
  const [station, setStation] = useState("all")
  const [course, setCourse] = useState("1")
  const [eightySixTarget, setEightySixTarget] = useState("")
  const [eightySixOpen, setEightySixOpen] = useState(false)
  const [last86, setLast86] = useState<{ itemId: string; name: string } | null>(null)

  const slaMinutes = getVenueSettings().slaMinutes

  const tickets = useMemo(() => queue?.tickets ?? [], [queue])
  const stations = useMemo(() => {
    const s = new Set<string>()
    for (const t of tickets) for (const l of t.lines) for (const m of l.modifiers) s.add(m)
    return ["all", ...[...s].sort()]
  }, [tickets])

  const visible = useMemo(
    () => (station === "all" ? tickets : tickets.map((t) => ({ ...t, lines: t.lines.filter((l) => l.modifiers.includes(station)) })).filter((t) => t.lines.length > 0)),
    [tickets, station],
  )

  const breached = useMemo(
    () => tickets.filter((t) => Number.isFinite(Date.parse(t.sentAt)) && Date.now() - Date.parse(t.sentAt) > slaMinutes * 60 * 1000),
    [tickets, slaMinutes],
  )

  // Completed orders still come from the orders board for the history tab.
  const completedOrders: Order[] = useMemo(() => {
    const rows = board?.rows ?? []
    return rows
      .filter((r) => r.status === "closed")
      .slice(0, 20)
      .map((r) => ({
        id: r.orderId,
        tableId: r.tableId,
        table: { id: r.tableId ?? "", number: r.tableId ?? "", capacity: 0, status: "occupied" },
        customerName: r.dinerName,
        items: r.lines.map((l) => ({ id: l.lineId, menuItemId: l.lineId, title: l.name, price: l.lineTotal / Math.max(l.quantity, 1), quantity: l.quantity, totalPrice: l.lineTotal })),
        quantity: r.lines.reduce((s, l) => s + l.quantity, 0),
        status: "completed",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        subtotal: r.total,
        tax: 0,
        discount: 0,
        total: r.total,
        payments: [],
        isPaid: true,
        diningMode: "Dine in",
        serverId: "",
      }) as unknown as Order)
  }, [board])

  const bump = async (ticket: KitchenTicket, lineId?: string) => {
    // Advance the oldest non-ready line (or the given line) to ready.
    const target = lineId ?? ticket.lines.find((l) => l.status !== "ready")?.lineId
    if (!target) {
      // Whole ticket ready → serve all lines.
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

  // Bump-bar shortcuts: keys 1-9 bump the Nth visible ticket.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return
      const n = Number(e.key)
      if (Number.isInteger(n) && n >= 1 && n <= 9 && visible[n - 1]) {
        void bump(visible[n - 1])
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible])

  const fireCourse = async (orderId: string, action: "fire" | "hold" | "release") => {
    const cmd = action === "fire" ? "order.fireCourse" : action === "hold" ? "order.holdCourse" : "order.releaseCourse"
    const res = await run(cmd, { orderId, course: Number(course) || 1 })
    if (res.success) notify("success", `Course ${action}d`)
    else notify("error", `Course ${action} failed`, res.error?.message)
  }

  const eightySixName = (menu?.items ?? []).find((i) => i.id === eightySixTarget)?.name ?? eightySixTarget

  const eightySix = async () => {
    if (!eightySixTarget.trim()) return
    const res = await run("menu.eightySix", { itemId: eightySixTarget.trim(), reason: "86'd from KDS" })
    if (res.success) {
      setLast86({ itemId: eightySixTarget.trim(), name: eightySixName })
      notify("success", `86'd ${eightySixName}`)
      setEightySixTarget("")
      setEightySixOpen(false)
    } else notify("error", "86 failed", res.error?.message)
  }

  const undo86 = async () => {
    if (!last86) return
    const res = await run("menu.clearEightySix", { itemId: last86.itemId })
    if (res.success) {
      notify("success", `${last86.name} back on`)
      setLast86(null)
    } else notify("error", "Could not restore item", res.error?.message)
  }

  const handleRefresh = async () => {
    // Honest refresh: projections poll (kitchen.queue every 2s). This re-mounts
    // the ticket grid so a stuck render recovers; it never pretends to refetch.
    setRefreshing(true)
    setRefreshNonce((n) => n + 1)
    await new Promise((r) => setTimeout(r, 300))
    setRefreshing(false)
  }

  return (
    <div className="space-y-4">
      {/* WebSocket integration for real-time updates */}
      <KitchenSocketIntegration />
      {breached.length > 0 && (
        <div role="alert" aria-live="assertive" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm">
          <strong>SLA breach:</strong> {breached.length} ticket{breached.length === 1 ? "" : "s"} over {slaMinutes} min — expedite now.
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-3xl font-bold tracking-tight">Kitchen Display System</h2>
        <div className="flex items-center gap-2">
          <KernelStatusIndicator />
          <Button
            variant="outline"
            size="icon"
            onClick={toggleSound}
            title={kitchenState.soundEnabled ? "Mute notifications" : "Enable sound"}
          >
            {kitchenState.soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </Button>
          <Button variant="outline" onClick={() => void handleRefresh()} disabled={refreshing}>
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Refreshing..." : "Refresh"}
          </Button>
          <KitchenNotificationSettings />
        </div>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center gap-2 p-3">
          <div className="flex max-w-full items-center gap-1 overflow-x-auto" role="group" aria-label="Station filter">
            <span className="shrink-0 text-xs text-muted-foreground">Station:</span>
            {stations.map((s) => (
              <Button key={s} size="lg" className="min-h-[44px] shrink-0" variant={station === s ? "default" : "outline"} onClick={() => setStation(s)}>
                {s}
              </Button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground">Course:</span>
            <Input value={course} onChange={(e) => setCourse(e.target.value)} className="h-11 w-16" aria-label="Course number" />
          </div>
          <div className="flex items-center gap-1">
            <Select value={eightySixTarget} onValueChange={setEightySixTarget}>
              <SelectTrigger className="h-11 w-48" aria-label="Menu item to 86"><SelectValue placeholder="Pick item to 86…" /></SelectTrigger>
              <SelectContent>
                {(menu?.items ?? []).filter((i) => !i.eightySixed).map((i) => (
                  <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="lg" className="min-h-[44px]" variant="destructive" disabled={!eightySixTarget.trim()} onClick={() => setEightySixOpen(true)}>
              <Flame className="mr-1 h-4 w-4" /> 86…
            </Button>
            {last86 && (
              <Button size="lg" className="min-h-[44px]" variant="outline" onClick={() => void undo86()}>
                Undo 86 ({last86.name})
              </Button>
            )}
          </div>
          <AlertDialog open={eightySixOpen} onOpenChange={setEightySixOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>86 {eightySixName}?</AlertDialogTitle>
                <AlertDialogDescription>Servers stop seeing it immediately. Use Undo within this shift if the kitchen recovers stock.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep selling</AlertDialogCancel>
                <AlertDialogAction onClick={(e) => { e.preventDefault(); void eightySix() }}>86 it</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <span className="ml-auto text-[11px] text-muted-foreground">Live · tickets poll every 2s · Keys 1–9 bump · SLA {slaMinutes} min (Settings)</span>
        </CardContent>
      </Card>

      <div key={refreshNonce} className="grid grid-cols-1 gap-4 md:grid-cols-3" role="log" aria-label="Kitchen ticket queue">
        {(["queued", "in_progress", "ready"] as const).map((col) => {
          const colTickets = visible.filter((t) => t.status === col)
          return (
            <Card key={col}>
              <CardHeader className={col === "queued" ? "bg-yellow-50 dark:bg-yellow-950/30" : col === "in_progress" ? "bg-blue-50 dark:bg-blue-950/30" : "bg-green-50 dark:bg-green-950/30"}>
                <CardTitle className="flex items-center justify-between">
                  <span className="capitalize">{col.replace("_", " ")}</span>
                  <span className="rounded-full bg-muted px-2.5 py-0.5 text-sm font-medium">{colTickets.length}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 p-2">
                {colTickets.length === 0 && <p className="p-2 text-xs text-muted-foreground">No tickets.</p>}
                {colTickets.map((t, i) => {
                  const ageMin = Math.max(0, Math.round((Date.now() - Date.parse(t.sentAt)) / 60000))
                  const over = Date.now() - Date.parse(t.sentAt) > slaMinutes * 60 * 1000
                  return (
                    <Card key={t.orderId} className={over ? "border-destructive" : undefined}>
                      <CardHeader className="p-3 pb-1">
                        <CardTitle className="flex items-center justify-between text-sm">
                          <span>#{t.orderId.slice(0, 8)} · {t.tableLabel}{t.dinerName ? ` · ${t.dinerName}` : ""}</span>
                          <Badge variant={over ? "destructive" : "secondary"}>{ageMin}m</Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-1 p-3 pt-0">
                        {t.lines.map((l) => {
                          const ag = allergensIn([l.name, ...l.modifiers].join(" "))
                          return (
                            <div key={l.lineId} className="flex items-center justify-between gap-2 text-sm">
                              <span>
                                <span className="font-medium">{l.quantity}×</span> {l.name}
                                {l.modifiers.length > 0 && <span className="text-xs text-muted-foreground"> ({l.modifiers.join(", ")})</span>}
                                {ag.length > 0 && (
                                  <span className="ml-1 rounded bg-red-600 px-1 text-[10px] font-bold uppercase text-white" title={`Allergen: ${ag.join(", ")}`}>
                                    {ag.join("/")}
                                  </span>
                                )}
                              </span>
                              <Badge variant="outline">{l.status}{l.course ? ` · c${l.course}` : ""}</Badge>
                            </div>
                          )
                        })}
                        <div className="flex flex-wrap gap-2 pt-1">
                          <Button size="lg" className="min-h-[48px]" onClick={() => void bump(t)} title={`Bump (key ${i + 1})`}>
                            Bump [{i + 1}]
                          </Button>
                          <Button size="lg" className="min-h-[48px]" variant="outline" onClick={() => void fireCourse(t.orderId, "fire")}>Fire c{course}</Button>
                          <Button size="lg" className="min-h-[48px]" variant="outline" onClick={() => void fireCourse(t.orderId, "hold")}>Hold</Button>
                          <Button size="lg" className="min-h-[48px]" variant="outline" onClick={() => void fireCourse(t.orderId, "release")}>Release</Button>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Tabs defaultValue="staff">
        <TabsList>
          <TabsTrigger value="staff">Staff Assignment</TabsTrigger>
          <TabsTrigger value="completed">Completed Orders</TabsTrigger>
          <TabsTrigger value="metrics">Performance Metrics</TabsTrigger>
        </TabsList>

        <TabsContent value="staff" className="mt-4">
          <KitchenStaffAssignment />
        </TabsContent>

        <TabsContent value="completed" className="mt-4">
          <KitchenCompletedOrders orders={completedOrders} />
        </TabsContent>

        <TabsContent value="metrics" className="mt-4">
          <KitchenPerformanceMetrics />
        </TabsContent>
      </Tabs>
    </div>
  )
}
