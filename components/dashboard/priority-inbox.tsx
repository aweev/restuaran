"use client"

import Link from "next/link"
import { AlertTriangle, Clock, Flame, Package } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { useProjection } from "@/kernel/react/kernel-provider"

interface TablesBoard { tables?: Array<{ id: string; label?: string; status?: string; occupiedSince?: string | null }> }
interface KitchenQueue { tickets?: Array<{ id: string; tableLabel?: string; status?: string; createdAt?: string; lines?: unknown[] }> }
interface InventoryBoard { items?: Array<{ id: string; name?: string; onHand?: number; reorderPoint?: number }> }

function minutesSince(iso?: string | null): number | null {
  if (!iso) return null
  const ms = Date.now() - Date.parse(iso)
  if (!Number.isFinite(ms) || ms < 0) return null
  return Math.floor(ms / 60000)
}

/** Signal-first manager inbox: one row = one decision, escalated by dwell time. */
export function PriorityInbox() {
  const { state: tables } = useProjection<TablesBoard>("tables.board", 5000)
  const { state: kitchen } = useProjection<KitchenQueue>("kitchen.queue", 5000)
  const { state: inventory } = useProjection<InventoryBoard>("inventory.board", 10000)

  const signals: Array<{ tone: "red" | "amber" | "info"; title: string; desc: string; href: string }> = []

  for (const t of tables?.tables ?? []) {
    const dwell = minutesSince(t.occupiedSince)
    if (t.status === "occupied" && dwell != null && dwell >= 45) {
      signals.push({
        tone: dwell >= 70 ? "red" : "amber",
        title: `Table ${t.label ?? t.id} waiting ${dwell} min`,
        desc: "Check course firing, offer dessert or comp.",
        href: "/dashboard/tables",
      })
    }
  }
  for (const ticket of kitchen?.tickets ?? []) {
    const age = minutesSince(ticket.createdAt)
    if (age != null && age >= 20 && ticket.status !== "ready") {
      signals.push({
        tone: age >= 30 ? "red" : "amber",
        title: `Ticket ${ticket.id.slice(0, 8)} over target (${age} min)`,
        desc: `Table ${ticket.tableLabel ?? "?"} — expedite or fire next course.`,
        href: "/dashboard/kitchen/display",
      })
    }
  }
  for (const item of inventory?.items ?? []) {
    const onHand = Number(item.onHand ?? 0)
    const reorder = Number(item.reorderPoint ?? 0)
    if (Number.isFinite(onHand) && onHand <= 0) {
      signals.push({ tone: "red", title: `${item.name ?? item.id} out of stock`, desc: "Auto-86 engaged — confirm menu.", href: "/dashboard/inventory" })
    } else if (Number.isFinite(onHand) && reorder > 0 && onHand <= reorder) {
      signals.push({ tone: "amber", title: `${item.name ?? item.id} low (${onHand})`, desc: "Reorder before next service.", href: "/dashboard/inventory" })
    }
  }

  if (signals.length === 0) return null
  const reds = signals.filter((s) => s.tone === "red").length

  return (
    <div aria-live="polite" className="space-y-2">
      <Alert variant={reds > 0 ? "destructive" : "default"}>
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>{reds > 0 ? `${reds} urgent — act now` : `${signals.length} needs attention`}</AlertTitle>
        <AlertDescription>Prioritized by dwell time and stock. Newest signals first.</AlertDescription>
      </Alert>
      {signals.slice(0, 6).map((s, i) => (
        <Link key={`${s.title}-${i}`} href={s.href} className="flex items-start gap-3 rounded-md border px-3 py-2 hover:bg-accent">
          {s.tone === "red" ? <Flame className="mt-0.5 h-4 w-4 text-destructive" /> : s.tone === "amber" ? <Clock className="mt-0.5 h-4 w-4 text-amber-600" /> : <Package className="mt-0.5 h-4 w-4" />}
          <span>
            <span className="block text-sm font-medium">{s.title}</span>
            <span className="block text-xs text-muted-foreground">{s.desc}</span>
          </span>
        </Link>
      ))}
    </div>
  )
}
