"use client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, Inbox, Loader2, RotateCcw, WifiOff } from "lucide-react";
import type { ReactNode } from "react";
import { useFeedback } from "@/lib/feedback";
import { cn } from "@/lib/utils";
import {
  orderBadgeVariant,
  orderStatusLabel,
  tableBadgeVariant,
  tableStatusLabel,
} from "@/lib/status";

export function PageHeader({ title, subtitle, actions, live }: { title: string; subtitle?: string; actions?: ReactNode; live?: boolean }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <h2 className="text-2xl font-bold tracking-tight md:text-3xl">{title}</h2>
          {live === false && (
            <Badge variant="outline" className="gap-1 border-amber-300 bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300" title="Showing cached demo data — API unreachable">
              <WifiOff className="h-3 w-3" /> Offline demo
            </Badge>
          )}
          {live === true && (
            <Badge variant="outline" className="gap-1 border-emerald-300 bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Live
            </Badge>
          )}
        </div>
        {subtitle && <p className="max-w-xl text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function LoadingGrid({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4" role="status" aria-label="Loading" aria-busy="true">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="pos-fade-in"><CardContent className="space-y-3 p-4">
          <Skeleton className="h-4 w-1/2" /><Skeleton className="h-8 w-2/3" /><Skeleton className="h-3 w-full" />
        </CardContent></Card>
      ))}
      <span className="sr-only"><Loader2 className="h-4 w-4 animate-spin" /> Loading...</span>
    </div>
  );
}

export function EmptyState({ icon, title, hint, action }: { icon?: ReactNode; title: string; hint?: string; action?: ReactNode }) {
  return (
    <Card className="pos-rise border-dashed">
      <CardContent className="flex flex-col items-center gap-2 px-6 py-12 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          {icon ?? <Inbox className="h-6 w-6" />}
        </div>
        <p className="text-base font-semibold">{title}</p>
        {hint && <p className="max-w-sm text-sm text-muted-foreground">{hint}</p>}
        {action && <div className="mt-2">{action}</div>}
      </CardContent>
    </Card>
  );
}

export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  const { notify } = useFeedback();
  return (
    <Card className="border-destructive/40">
      <CardContent className="flex flex-col items-center gap-2 px-6 py-10 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <p className="font-semibold">Something went wrong</p>
        <p className="max-w-sm text-sm text-muted-foreground">{message ?? "We couldn't load this data. Check your connection and try again."}</p>
        {onRetry && (
          <Button variant="outline" size="sm" className="mt-2 gap-2 pos-press" onClick={() => { notify("info", "Retrying"); onRetry(); }}>
            <RotateCcw className="h-3.5 w-3.5" /> Try again
          </Button>
        )}
      </CardContent>
    </Card>
  );
}



/**
 * Persona quick actions. Tiles rather than a menu, because these are the
 * things a role does dozens of times a shift and should be one tap away.
 */
export function QuickActions({
  items,
}: {
  items: { label: string; href: string; icon?: ReactNode; hint?: string }[]
}) {
  const { tap } = useFeedback();
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="group" aria-label="Quick actions">
      {items.map((a) => (
        <Link
          key={a.href + a.label}
          href={a.href}
          onClick={tap}
          className="pos-card-hover pos-press group flex items-center gap-3 rounded-xl border bg-card p-3 text-left"
        >
          {a.icon && (
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-subtle text-brand transition-colors group-hover:bg-brand group-hover:text-brand-foreground">
              {a.icon}
            </span>
          )}
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold">{a.label}</span>
            {a.hint && <span className="block truncate text-xs text-muted-foreground">{a.hint}</span>}
          </span>
        </Link>
      ))}
    </div>
  );
}


/**
 * Status pill. Tone and label resolve from lib/status.ts so every surface
 * renders the same state identically.
 */
export function StatusBadge({
  value,
  kind = "table",
  className,
  size,
}: {
  value: string
  kind?: "table" | "order"
  className?: string
  size?: "default" | "sm" | "lg"
}) {
  const variant = kind === "order" ? orderBadgeVariant(value) : tableBadgeVariant(value)
  const label = kind === "order" ? orderStatusLabel(value) : tableStatusLabel(value)
  return (
    <Badge variant={variant} size={size} className={className} data-status={value}>
      {label}
    </Badge>
  )
}

/**
 * Connection state. A POS that silently shows stale data is worse than one
 * that admits it, so this is deliberately prominent.
 */
export function ConnectionPill({
  state,
  className,
}: {
  state: "live" | "connecting" | "offline"
  className?: string
}) {
  if (state === "live") {
    return (
      <Badge variant="live" aria-live="polite" role="status" className={cn("gap-1.5", className)} title="Connected to the venue in real time">
        <span className="h-1.5 w-1.5 rounded-full bg-status-available" aria-hidden />
        Live
      </Badge>
    )
  }
  if (state === "connecting") {
    return (
      <Badge variant="outline" aria-live="polite" role="status" className={cn("gap-1.5", className)} title="Reconnecting">
        <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
        Reconnecting
      </Badge>
    )
  }
  return (
    <Badge
      variant="offline"
      aria-live="polite"
      role="status"
      className={cn("gap-1.5", className)}
      title="No connection to the venue. Changes are queued locally."
    >
      <WifiOff className="h-3 w-3" aria-hidden />
      Offline
    </Badge>
  )
}

/** Live indicator for projection-backed screens. Announced politely. */
export function LiveBadge({ live, className }: { live?: boolean; className?: string }) {
  if (live == null) return null
  return (
    <Badge
      variant="outline"
      role="status"
      aria-live="polite"
      className={cn(
        "gap-1",
        live
          ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
          : "border-amber-300 bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
        className,
      )}
    >
      {live ? <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden /> : <WifiOff className="h-3 w-3" aria-hidden />}
      {live ? "Live" : "Offline demo"}
    </Badge>
  )
}

/**
 * Shown when a fetch fell back to cached data. Distinct from ErrorState: the
 * screen works, it is simply not current.
 */
export function StaleDataNotice({
  className,
  onRetry,
}: {
  className?: string
  onRetry?: () => void
}) {
  return (
    <div
      role="status"
      className={cn(
        "flex items-center gap-2 rounded-lg border border-status-dirty/40 bg-status-dirty/10 px-3 py-2 text-sm text-status-dirty",
        className,
      )}
    >
      <WifiOff className="h-4 w-4 shrink-0" aria-hidden />
      <span>Showing the last data received. This screen may be out of date.</span>
      {onRetry && (
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto gap-1.5 text-status-dirty hover:bg-status-dirty/15"
          onClick={onRetry}
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden />
          Refresh
        </Button>
      )}
    </div>
  )
}
