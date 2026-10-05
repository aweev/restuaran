"use client";

import { useState } from "react";
import { useAttention } from "@/context/AttentionContext";
import { useKernel } from "@/kernel/react/kernel-provider";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, X, RotateCcw, WifiOff } from "lucide-react";

export function NeedsAttentionBadge() {
  const { items } = useAttention();
  if (items.length === 0) return null;
  return (
    <Badge variant="destructive" className="tabular-nums" aria-label={`${items.length} items need attention`}>
      {items.length}
    </Badge>
  );
}

export function NeedsAttentionDrawer() {
  const { items, dismiss, clear } = useAttention();
  const { queue, connection, discardQueued, retryQueued } = useKernel();
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"attention" | "offline">("attention");

  const retry = (href?: string) => {
    if (href) window.location.href = href;
    else window.location.reload();
  };

  const hasAttention = items.length > 0;
  const hasOfflineQueue = queue.length > 0;

  if (!hasAttention && !hasOfflineQueue) return null;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="relative gap-2" aria-label="Needs attention">
          <Bell className="h-4 w-4" />
          Attention
          {(hasAttention || hasOfflineQueue) && (
            <Badge variant="destructive" className="tabular-nums">
              {(hasAttention ? items.length : 0) + (hasOfflineQueue ? queue.length : 0)}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="right">
        <div className="flex gap-2 border-b pb-2 mb-4">
          <button
            onClick={() => setActiveTab("attention")}
            className={`flex-1 px-2 py-1 text-sm font-medium rounded transition-colors ${
              activeTab === "attention" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"
            }`}
            disabled={!hasAttention}
          >
            Failed actions
            {hasAttention && <span className="ml-1 text-xs opacity-70">({items.length})</span>}
          </button>
          <button
            onClick={() => setActiveTab("offline")}
            className={`flex-1 px-2 py-1 text-sm font-medium rounded transition-colors ${
              activeTab === "offline" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"
            }`}
            disabled={!hasOfflineQueue}
          >
            Offline queue
            {hasOfflineQueue && <span className="ml-1 text-xs opacity-70">({queue.length})</span>}
          </button>
        </div>

        <SheetHeader>
          <SheetTitle>
            {activeTab === "attention" ? `Failed actions (${items.length})` : `Offline queue (${queue.length})`}
          </SheetTitle>
          <SheetDescription>
            {activeTab === "attention"
              ? "Failed actions persist here after the toast fades."
              : "Changes queued locally — will sync when reconnected."}
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-2 overflow-y-auto p-4 max-h-[60vh]">
          {activeTab === "attention" ? (
            items.length === 0 ? (
              <p className="text-sm text-muted-foreground">All clear — no unresolved errors.</p>
            ) : (
              items.map((item) => (
                <div key={item.id} className="rounded-lg border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold">{item.title}</p>
                    <Button variant="ghost" size="sm" onClick={() => dismiss(item.id)} aria-label="Dismiss">
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  {item.message && <p className="mt-1 text-xs text-muted-foreground">{item.message}</p>}
                  {item.code && (
                    <p className="mt-1 text-[10px] font-mono text-muted-foreground">{item.code}</p>
                  )}
                  <div className="mt-2 flex gap-2">
                    <Button variant="outline" size="sm" className="gap-1" onClick={() => retry(item.href)}>
                      <RotateCcw className="h-3 w-3" /> Retry
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => dismiss(item.id)}>
                      Dismiss
                    </Button>
                  </div>
                </div>
              ))
            )
          ) : (
            queue.length === 0 ? (
              <p className="text-sm text-muted-foreground">No pending offline changes.</p>
            ) : (
              queue.map((cmd) => (
                <div key={cmd.requestId} className="rounded-lg border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold">{cmd.commandType}</p>
                      <p className="text-xs text-muted-foreground">Enqueued: {new Date(cmd.enqueuedAt).toLocaleTimeString()}</p>
                      <p className="text-xs text-muted-foreground">Attempts: {cmd.attempts} / {25}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      {connection === "offline" && <WifiOff className="h-4 w-4 text-amber-500" />}
                    </div>
                  </div>
                  <div className="mt-2 flex gap-2">
                    <Button variant="outline" size="sm" className="gap-1" onClick={() => retryQueued(cmd.requestId)} disabled={connection === "offline"}>
                      <RotateCcw className="h-3 w-3" /> Retry now
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => discardQueued(cmd.requestId)}>
                      Discard
                    </Button>
                  </div>
                </div>
              ))
            )
          )}
        </div>
        {(items.length > 0 || queue.length > 0) && (
          <div className="mt-auto p-4 border-t">
            {activeTab === "attention" && items.length > 0 && (
              <Button variant="ghost" size="sm" onClick={clear} className="w-full">
                Clear all failed actions
              </Button>
            )}
            {activeTab === "offline" && queue.length > 0 && (
              <Button variant="ghost" size="sm" onClick={() => queue.forEach(c => discardQueued(c.requestId))} className="w-full">
                Discard all queued
              </Button>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
