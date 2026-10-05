"use client";

import { useMemo } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/pos/ui-states";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useOrder } from "@/context/OrderContext";
import { useCashDrawer } from "@/context/CashDrawerContext";
import { getVenueSettings } from "@/lib/settings";
import { RequireCapability } from "@/lib/auth-guard";

function money(n: number) {
  return `$${n.toFixed(2)}`;
}

function ZReportInner() {
  const { orders } = useOrder();
  const { history, current } = useCashDrawer();
  const venue = getVenueSettings();

  const today = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return orders.filter((o) => new Date(o.createdAt).getTime() >= start.getTime());
  }, [orders]);

  const gross = today.reduce((s, o) => s + (Number(o.total) || 0), 0);
  const tax = today.reduce((s, o) => s + (Number(o.tax) || 0), 0);
  const discounts = today.reduce((s, o) => s + (Number(o.discount) || 0), 0);

  const byMethod = useMemo(() => {
    const m: Record<string, number> = {};
    for (const o of today) {
      for (const p of o.payments ?? []) {
        m[p.method] = (m[p.method] ?? 0) + (Number(p.amount) || 0);
      }
    }
    return m;
  }, [today]);

  const todaySessions = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const all = [...history, ...(current ? [current] : [])];
    return all.filter((s) => new Date(s.openedAt).getTime() >= start.getTime());
  }, [history, current]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Z-report"
        subtitle={`${venue.name || "Venue"} · ${new Date().toLocaleDateString()} · ${today.length} orders`}
        actions={
          <Button size="sm" variant="outline" onClick={() => window.print()}>
            Print
          </Button>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Gross sales", value: money(gross) },
          { label: "Tax collected", value: money(tax) },
          { label: "Discounts / comps", value: money(discounts) },
          { label: "Net (gross − discounts)", value: money(gross - discounts) },
        ].map((s) => (
          <Card key={s.label}>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">{s.label}</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold tabular-nums">{s.value}</p></CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-sm">Payments by method</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {Object.keys(byMethod).length === 0 ? (
              <p className="text-muted-foreground">No payments recorded today.</p>
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
            {todaySessions.length === 0 ? (
              <p className="text-muted-foreground">
                No drawer sessions today. <Link className="underline" href="/dashboard/cash">Open the drawer</Link>.
              </p>
            ) : (
              todaySessions.map((s) => (
                <div key={s.id} className="flex flex-wrap justify-between gap-2 rounded-md border px-3 py-2">
                  <span>Opened {new Date(s.openedAt).toLocaleTimeString()}</span>
                  <span className="tabular-nums">
                    {s.closedAt ? `variance ${money(s.variance ?? 0)}` : `open · expected ${money(s.startingFloat + s.txns.reduce((a, t) => a + (t.kind === "sale" ? t.amount : -t.amount), 0))}`}
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
