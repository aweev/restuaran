"use client";

import { useState } from "react";
import { PageHeader } from "@/components/pos/ui-states";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCommand, useProjection } from "@/kernel/react/kernel-provider";
import { newRequestId } from "@/kernel/react/kernel-provider";
import type { CashBoardState } from "@/kernel/projections/cash-board";
import { useFeedback } from "@/lib/feedback";
import { RequireCapability } from "@/lib/auth-guard";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

function money(n: number) {
  return `$${n.toFixed(2)}`;
}

function CashInner() {
  const { state } = useProjection<CashBoardState>("cash.board", 2000);
  const { run, pending } = useCommand();
  const { notify } = useFeedback();
  const [float, setFloat] = useState("100");
  const [txnAmount, setTxnAmount] = useState("");
  const [txnNote, setTxnNote] = useState("");
  const [counted, setCounted] = useState("");
  const [varianceReason, setVarianceReason] = useState("");

  const sessions = state?.sessions ?? [];
  const current = sessions.find((s) => s.status === "open") ?? null;
  const history = sessions.filter((s) => s.status === "closed");
  const expected = current?.expected ?? 0;
  const variance = counted ? (Number(counted) || 0) - expected : null;

  const open = async () => {
    const result = await run("cash.open", { startingFloat: Number(float) || 0 }, { requestId: newRequestId() });
    if (result.success) notify("success", "Drawer opened");
    else notify("error", "Could not open drawer", result.error?.message);
  };

  const payout = async () => {
    if (!current) return;
    const result = await run(
      "cash.payout",
      { sessionId: current.sessionId, amount: Number(txnAmount) || 0, reason: txnNote },
      { requestId: newRequestId() },
    );
    if (result.success) {
      setTxnAmount("");
      setTxnNote("");
    } else notify("error", "Payout rejected", result.error?.message);
  };

  const close = async () => {
    if (!current) return;
    const result = await run(
      "cash.close",
      {
        sessionId: current.sessionId,
        countedCash: Number(counted) || 0,
        ...(varianceReason ? { varianceReason } : {}),
      },
      { requestId: `cash-close:${current.sessionId}` },
    );
    if (result.success) {
      notify("success", "Drawer closed", `Variance ${money((Number(counted) || 0) - expected)}`);
      setCounted("");
      setVarianceReason("");
    } else notify("error", "Close rejected", result.error?.message);
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Cash drawer" subtitle={current ? `Open since ${new Date(current.openedAt).toLocaleString()} · expected ${money(expected)} (server)` : "Drawer is closed"} />
      {!current ? (
        <Card className="max-w-md">
          <CardHeader><CardTitle className="text-sm">Open drawer</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div><Label htmlFor="cash-float">Starting float</Label><Input id="cash-float" type="number" min={0} step={1} value={float} onChange={(e) => setFloat(e.target.value)} /></div>
            <Button size="lg" className="min-h-[48px]" disabled={pending} onClick={() => void open()}>
              Open drawer
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle className="text-sm">Session (server truth)</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between"><span>Starting float</span><span className="tabular-nums">{money(current.startingFloat)}</span></div>
              <div className="flex justify-between"><span>Cash sales (from order ledger)</span><span className="tabular-nums">{money(current.cashSales)}</span></div>
              <div className="flex justify-between"><span>Payouts / drops</span><span className="tabular-nums">{money(current.payouts)}</span></div>
              <div className="flex justify-between font-semibold"><span>Expected in drawer</span><span className="tabular-nums">{money(expected)}</span></div>
              <div className="flex gap-2 pt-2">
                <Input placeholder="Amount" type="number" min={0} step={0.01} value={txnAmount} onChange={(e) => setTxnAmount(e.target.value)} aria-label="Payout amount" />
                <Input placeholder="Reason (required)" value={txnNote} onChange={(e) => setTxnNote(e.target.value)} aria-label="Payout reason" />
                <Button size="lg" className="min-h-[48px]" variant="outline" disabled={!txnAmount || !txnNote.trim() || pending} onClick={() => void payout()}>
                  Payout
                </Button>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-sm">Close drawer</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div><Label htmlFor="cash-counted">Counted cash</Label><Input id="cash-counted" type="number" min={0} step={0.01} value={counted} onChange={(e) => setCounted(e.target.value)} /></div>
              {variance !== null && (
                <p className="text-sm">
                  Variance:{" "}
                  <span className={variance === 0 ? "text-emerald-700" : "font-semibold text-destructive"}>
                    {variance === 0 ? "✓ Balanced · " : variance > 0 ? "▲ Over · " : "▼ Short · "}{money(variance)}
                  </span>
                </p>
              )}
              {variance !== null && variance !== 0 && (
                <div><Label htmlFor="cash-var-reason">Variance reason (required)</Label><Input id="cash-var-reason" value={varianceReason} onChange={(e) => setVarianceReason(e.target.value)} placeholder="Why is the drawer short/over?" /></div>
              )}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    size="lg"
                    className="min-h-[48px]"
                    disabled={!counted || pending || (variance !== null && variance !== 0 && !varianceReason.trim())}
                  >
                    Close drawer
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Close drawer? Expected {money(expected)}</AlertDialogTitle>
                    <AlertDialogDescription>
                      Counted {counted ? money(Number(counted) || 0) : "—"} · variance {variance !== null ? money(variance) : "—"}. This ends the shift session and cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Keep counting</AlertDialogCancel>
                    <AlertDialogAction onClick={() => void close()}>Close drawer</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardContent>
          </Card>
        </div>
      )}
      {history.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Past sessions ({history.length})</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {history.slice(-10).reverse().map((s) => (
              <div key={s.sessionId} className="flex flex-wrap justify-between gap-2 rounded-md border px-3 py-2">
                <span>{new Date(s.openedAt).toLocaleDateString()} · cash sales {money(s.cashSales)}</span>
                <span className="tabular-nums">expected {money(s.expected)} · counted {money(s.countedCash ?? 0)} · var {money(s.variance ?? 0)}{s.varianceReason ? ` · ${s.varianceReason}` : ""}</span>
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
