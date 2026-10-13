"use client";

import Link from "next/link";
import { PageHeader } from "@/components/pos/ui-states";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useProjection } from "@/kernel/react/kernel-provider";
import type { SalesBoardState } from "@/kernel/projections/sales-board";
import type { CashBoardState } from "@/kernel/projections/cash-board";
import { getVenueSettings } from "@/lib/settings";
import { printHtml } from "@/lib/print";
import { RequireCapability } from "@/lib/auth-guard";

function money(n: number) {
  return `$${n.toFixed(2)}`;
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function ZReportInner() {
  const { state: sales } = useProjection<SalesBoardState>("sales.board", 5000);
  const { state: cash } = useProjection<CashBoardState>("cash.board", 5000);
  const venue = getVenueSettings();

  // Server truth: today's settled bucket from the event log. Unpaid checks
  // are NOT revenue and never appear here (unlike the old client-side sum
  // over OrderContext, which counted everything rung up).
  const bucket = sales?.buckets.find((b) => b.date === todayKey());
  const gross = bucket?.grossSales ?? 0;
  const tax = bucket?.tax ?? 0;
  const discounts = bucket?.discounts ?? 0;
  const tips = bucket?.tips ?? 0;
  const paid = bucket?.paid ?? 0;
  const comps = bucket?.comps ?? 0;
  const orderCount = bucket?.orderCount ?? 0;
  const byMethod = bucket?.byMethod ?? {};

  const sessions = cash?.sessions ?? [];
  const daySessions = sessions.filter((s) => s.openedAt.slice(0, 10) === todayKey());

  const print = () => {
    const methods = Object.entries(byMethod).map(([m, a]) => `<div>${m}: ${money(a)}</div>`).join("");
    void printHtml(`Day close ${todayKey()}`, `<div class="text-center font-bold">Day close · ${todayKey()}</div><div>Orders: ${orderCount}</div><div>Gross: ${money(gross)}</div><div>Tax: ${money(tax)}</div><div>Discounts: ${money(discounts)}</div><div>Net: ${money(gross - discounts)}</div><div>Paid: ${money(paid)}</div><div>Tips: ${money(tips)}</div><div>Comps: ${comps}</div>${methods}`);
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Day close"
        subtitle={`${venue.name || "Venue"} · ${new Date().toLocaleDateString()} · ${orderCount} closed orders (server)`}
        actions={
          <Button size="sm" variant="outline" onClick={print}>
            Print
          </Button>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Gross sales (closed)", value: money(gross) },
          { label: "Tax collected", value: money(tax) },
          { label: "Discounts", value: money(discounts) },
          { label: "Net (gross − discounts)", value: money(gross - discounts) },
        ].map((s) => (
          <Card key={s.label}>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">{s.label}</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold tabular-nums">{s.value}</p></CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Paid", value: money(paid) },
          { label: "Tips", value: money(tips) },
          { label: "Comps", value: String(comps) },
        ].map((s) => (
          <Card key={s.label}>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">{s.label}</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold tabular-nums">{s.value}</p></CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-sm">Payments by method (settled)</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {Object.keys(byMethod).length === 0 ? (
              <p className="text-muted-foreground">No settled payments today.</p>
            ) : (
              Object.entries(byMethod).map(([method, amount]) => (
                <div key={method} className="flex justify-between">
                  <span className="capitalize">{method}</span>
                  <span className="tabular-nums">{money(amount)}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Drawer variance today</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {daySessions.length === 0 ? (
              <p className="text-muted-foreground">
                No drawer sessions today. <Link className="underline" href="/dashboard/cash">Open the drawer</Link>.
              </p>
            ) : (
              daySessions.map((s) => (
                <div key={s.sessionId} className="flex flex-wrap justify-between gap-2 rounded-md border px-3 py-2">
                  <span>Opened {new Date(s.openedAt).toLocaleTimeString()}</span>
                  <span className="tabular-nums">
                    {s.status === "closed" ? `variance ${money(s.variance ?? 0)}${s.varianceReason ? ` · ${s.varianceReason}` : ""}` : `open · expected ${money(s.expected)}`}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function ZReportPage() {
  return (
    <RequireCapability capability="report:view">
      <ZReportInner />
    </RequireCapability>
  );
}
