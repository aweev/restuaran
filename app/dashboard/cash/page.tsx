"use client";

import { useState } from "react";
import { PageHeader } from "@/components/pos/ui-states";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCashDrawer } from "@/context/CashDrawerContext";
import { useAuth } from "@/context/AuthContext";
import { useFeedback } from "@/lib/feedback";
import { RequireCapability } from "@/lib/auth-guard";

function money(n: number) {
  return `$${n.toFixed(2)}`;
}

function CashInner() {
  const { current, history, openDrawer, recordTxn, closeDrawer } = useCashDrawer();
  const { state: auth } = useAuth();
  const { notify } = useFeedback();
  const [float, setFloat] = useState("100");
  const [txnAmount, setTxnAmount] = useState("");
  const [txnNote, setTxnNote] = useState("");
  const [counted, setCounted] = useState("");

  const expected = current
    ? current.startingFloat +
      current.txns.filter((t) => t.kind === "sale" && t.method.toLowerCase() === "cash").reduce((s, t) => s + t.amount, 0) -
      current.txns.filter((t) => t.kind !== "sale").reduce((s, t) => s + t.amount, 0)
    : 0;

  return (
    <div className="space-y-4">
      <PageHeader title="Cash drawer" subtitle={current ? `Open since ${new Date(current.openedAt).toLocaleString()}` : "Drawer is closed"} />
      {!current ? (
        <Card className="max-w-md">
          <CardHeader><CardTitle className="text-sm">Open drawer</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div><Label htmlFor="cash-float">Starting float</Label><Input id="cash-float" type="number" min={0} step={1} value={float} onChange={(e) => setFloat(e.target.value)} /></div>
            <Button
              size="sm"
              onClick={() => {
                openDrawer(Number(float) || 0, auth.user?.name);
                notify("success", "Drawer opened");
              }}
            >
              Open drawer
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle className="text-sm">Session</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between"><span>Starting float</span><span className="tabular-nums">{money(current.startingFloat)}</span></div>
              <div className="flex justify-between"><span>Cash sales</span><span className="tabular-nums">{money(current.txns.filter((t) => t.kind === "sale" && t.method.toLowerCase() === "cash").reduce((s, t) => s + t.amount, 0))}</span></div>
              <div className="flex justify-between"><span>Payouts / drops</span><span className="tabular-nums">{money(current.txns.filter((t) => t.kind !== "sale").reduce((s, t) => s + t.amount, 0))}</span></div>
              <div className="flex justify-between font-semibold"><span>Expected in drawer</span><span className="tabular-nums">{money(expected)}</span></div>
              <div className="flex gap-2 pt-2">
                <Input placeholder="Amount" type="number" min={0} step={0.01} value={txnAmount} onChange={(e) => setTxnAmount(e.target.value)} aria-label="Payout amount" />
                <Input placeholder="Note" value={txnNote} onChange={(e) => setTxnNote(e.target.value)} aria-label="Payout note" />
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!txnAmount}
                  onClick={() => {
                    recordTxn({ kind: "payout", amount: Number(txnAmount) || 0, method: "cash", note: txnNote || undefined });
                    setTxnAmount("");
                    setTxnNote("");
                  }}
                >
                  Payout
                </Button>
              </div>
              {current.txns.length > 0 && (
                <ul className="space-y-1 pt-2 text-xs text-muted-foreground">
                  {current.txns.slice(-8).map((t) => (
                    <li key={t.id} className="flex justify-between"><span>{t.kind} · {t.note ?? t.method}</span><span className="tabular-nums">{money(t.amount)}</span></li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-sm">Close drawer</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div><Label htmlFor="cash-counted">Counted cash</Label><Input id="cash-counted" type="number" min={0} step={0.01} value={counted} onChange={(e) => setCounted(e.target.value)} /></div>
              {counted && (
                <p className="text-sm">
                  Variance:{" "}
                  <span className={(Number(counted) || 0) - expected === 0 ? "text-emerald-600" : "font-semibold text-destructive"}>
                    {money((Number(counted) || 0) - expected)}
                  </span>
                </p>
              )}
              <Button
                size="sm"
                disabled={!counted}
                onClick={() => {
                  const closed = closeDrawer(Number(counted) || 0);
                  if (closed) notify("success", "Drawer closed", `Variance ${money(closed.variance ?? 0)}`);
                  setCounted("");
                }}
              >
                Close drawer
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
      {history.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Past sessions ({history.length})</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {history.slice(-10).reverse().map((s) => (
              <div key={s.id} className="flex flex-wrap justify-between gap-2 rounded-md border px-3 py-2">
                <span>{new Date(s.openedAt).toLocaleDateString()} · {s.txns.length} txns</span>
                <span className="tabular-nums">expected {money(s.expected ?? 0)} · counted {money(s.countedCash ?? 0)} · var {money(s.variance ?? 0)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function CashPage() {
  return (
    <RequireCapability capability="order:pay">
      <CashInner />
    </RequireCapability>
  );
}
