"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader, EmptyState, ErrorState } from "@/components/pos/ui-states";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RequireCapability } from "@/lib/auth-guard";
import { Search } from "lucide-react";

interface AuditRow {
  id: string;
  userId: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  details: Record<string, unknown> | null;
  timestamp: string;
}

const ACTION_LABELS: Record<string, string> = {
  "order.paymentRecorded": "Payment recorded",
  "order.closed": "Check closed",
  "order.voided": "Order voided",
  "order.lineVoided": "Line voided",
  "order.lineComped": "Line comped",
  "order.comped": "Order comped",
  "order.discountApplied": "Discount applied",
  "order.taxApplied": "Tax applied",
  "order.tipAdded": "Gratuity / tip added",
  "order.splitCreated": "Check split",
  "cash.opened": "Drawer opened",
  "cash.saleNoted": "Cash sale noted",
  "cash.payout": "Drawer payout",
  "cash.closed": "Drawer closed",
  "payment.refunded": "Payment refunded",
};

function detailSummary(row: AuditRow): string {
  const d = row.details ?? {};
  const parts: string[] = [];
  const amount = d.amount ?? d.countedCash ?? d.startingFloat;
  if (typeof amount === "number") parts.push(`$${amount.toFixed(2)}`);
  for (const k of ["reason", "varianceReason", "method", "gateway"]) {
    if (typeof d[k] === "string" && (d[k] as string)) parts.push(String(d[k]));
  }
  if (typeof d.ways === "number") parts.push(`${d.ways} ways`);
  return parts.join(" · ");
}

function AuditInner() {
  const [rows, setRows] = useState<AuditRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [action, setAction] = useState("all");
  const [q, setQ] = useState("");
  const [appliedQ, setAppliedQ] = useState("");

  const load = useCallback(async () => {
    setError(null);
    try {
      const params = new URLSearchParams({ limit: "200" });
      if (action !== "all") params.set("action", action);
      if (appliedQ.trim()) params.set("q", appliedQ.trim());
      const res = await fetch(`/api/audit?${params.toString()}`, { credentials: "include" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setRows(Array.isArray(body.rows) ? body.rows : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load audit log");
      setRows([]);
    }
  }, [action, appliedQ]);

  useEffect(() => { void load(); }, [load]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Audit log"
        subtitle="Every void, comp, discount, payment, refund, split and cash move — with who did it. Newest first."
        actions={<Button size="lg" className="min-h-[44px]" variant="outline" onClick={() => void load()}>Refresh</Button>}
      />
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <Label htmlFor="audit-action">Event</Label>
          <Select value={action} onValueChange={setAction}>
            <SelectTrigger id="audit-action" className="h-11 w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All money events</SelectItem>
              {Object.entries(ACTION_LABELS).map(([v, label]) => (
                <SelectItem key={v} value={v}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="relative">
          <Label htmlFor="audit-q">Order, user, reason</Label>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              id="audit-q"
              type="search"
              placeholder="Search id, actor, reason…"
              className="h-11 pl-8"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") setAppliedQ(q); }}
            />
          </div>
        </div>
        <Button size="lg" className="min-h-[44px]" variant="outline" onClick={() => setAppliedQ(q)}>Search</Button>
      </div>
      {error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : rows === null ? (
        <Card><CardContent className="p-6 text-sm text-muted-foreground" role="status">Loading audit trail…</CardContent></Card>
      ) : rows.length === 0 ? (
        <EmptyState
          title="No matching entries"
          hint="Voids, comps, payments and cash moves land here automatically. If this is empty during service, the audit hook may be failing — check Diagnostics."
        />
      ) : (
        <Card>
          <CardContent className="space-y-1 p-2">
            {rows.map((r) => (
              <div key={r.id} className="flex flex-wrap items-baseline justify-between gap-2 rounded-md border px-3 py-2 text-sm">
                <div className="min-w-0">
                  <p className="font-medium">{ACTION_LABELS[r.action] ?? r.action}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {new Date(r.timestamp).toLocaleString()} · by {r.userId ? r.userId.slice(0, 8) : "system"}
                    {r.entityId ? (
                      <> · <Link className="underline" href={`/dashboard/orders/${r.entityId}`}>{r.entityId.slice(0, 8)}</Link></>
                    ) : null}
                  </p>
                  {detailSummary(r) && <p className="text-xs tabular-nums">{detailSummary(r)}</p>}
                </div>
                <span className="shrink-0 rounded bg-muted px-2 py-0.5 font-mono text-[11px]">{r.entity}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function AuditPage() {
  return (
    <RequireCapability capability="audit:view">
      <AuditInner />
    </RequireCapability>
  );
}
