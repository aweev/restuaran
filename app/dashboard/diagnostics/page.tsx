"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/pos/ui-states";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useKernel } from "@/kernel/react/kernel-provider";
import { printHtml, pendingPrintJobs, retryPrintJob } from "@/lib/print";
import { RequireCapability } from "@/lib/auth-guard";

interface Health {
  schemaVersion?: number;
  projections?: Array<{ name: string; position: number }>;
  commands?: number;
  queries?: number;
  error?: string;
}

interface StressItem {
  id: string;
  title: string;
  steps: string;
  expect: string;
}

const STRESS: StressItem[] = [
  {
    id: "offline",
    title: "Internet drop mid-order",
    steps: "Airplane mode on one tablet → take 3 orders → reconnect.",
    expect: "Queue badge counts up, auto-syncs, 0 dupes / 0 loss (stable requestIds).",
  },
  {
    id: "printer",
    title: "Printer failure",
    steps: "Unplug printer (or block popups) → fire a ticket → retry.",
    expect: "Sale completes; job queues as failed; retry button reprints.",
  },
  {
    id: "double",
    title: "Duplicate submit",
    steps: "Double-tap Fire to Kitchen / Split / Pay.",
    expect: "One order, one split, one payment (idempotency keys).",
  },
  {
    id: "conflict",
    title: "Two waiters, one table",
    steps: "Two devices add lines to the same order at once.",
    expect: "Second writer gets a merge dialog — never silent overwrite.",
  },
  {
    id: "rush",
    title: "Rush: 50 tickets",
    steps: "Fire 50 lines quickly across two tablets during prep.",
    expect: "KDS shows all 50 <2s p95, none lost (compare orders.board count).",
  },
];

const CHECK_KEY = "pos.diagnostics.checks";

function loadChecks(): Record<string, boolean> {
  try {
    return JSON.parse(window.localStorage.getItem(CHECK_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function DiagnosticsInner() {
  const { queue, pendingCount, connection } = useKernel();
  const [health, setHealth] = useState<Health | null>(null);
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [printMsg, setPrintMsg] = useState<string | null>(null);
  const failedPrints = pendingPrintJobs().filter((j) => j.status === "failed");

  useEffect(() => {
    setChecks(loadChecks());
    fetch("/api/kernel?health=1", { credentials: "include" })
      .then((r) => r.json())
      .then((h) => setHealth(h.error ? { error: h.error?.message ?? h.error } : h))
      .catch((e) => setHealth({ error: e instanceof Error ? e.message : "unreachable" }));
  }, []);

  const toggle = useCallback((id: string) => {
    setChecks((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      try {
        window.localStorage.setItem(CHECK_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const testPrint = useCallback(() => {
    void printHtml("Diagnostics test", "<div class='text-center'>Print OK — thermal path works.</div>").then(({ ok }) => {
      setPrintMsg(ok ? "Test page sent." : "Blocked — allow popups, then retry below.");
    });
  }, []);

  const passed = STRESS.filter((s) => checks[s.id]).length;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Diagnostics"
        subtitle={`${passed}/${STRESS.length} stress checks passed — run before Friday service`}
        live={connection === "live"}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle className="text-sm">Kernel health</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            {health == null ? (
              <p className="text-muted-foreground">Probing…</p>
            ) : health.error ? (
              <p className="text-destructive">Unreachable: {health.error}</p>
            ) : (
              <>
                <div className="flex justify-between"><span>Schema</span><span className="tabular-nums">v{health.schemaVersion}</span></div>
                <div className="flex justify-between"><span>Commands</span><span className="tabular-nums">{health.commands}</span></div>
                <div className="flex justify-between"><span>Queries</span><span className="tabular-nums">{health.queries}</span></div>
                <div className="flex justify-between"><span>Projections</span><span className="tabular-nums">{health.projections?.length}</span></div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Offline queue</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            <div className="flex justify-between"><span>Connection</span><Badge variant="outline">{connection}</Badge></div>
            <div className="flex justify-between"><span>Queued</span><span className="tabular-nums">{pendingCount}</span></div>
            {queue.slice(0, 5).map((c) => (
              <p key={c.requestId} className="truncate font-mono text-xs text-muted-foreground">
                {c.commandType} · tries {c.attempts}
              </p>
            ))}
            {pendingCount === 0 && <p className="text-muted-foreground">Empty — nothing waiting to sync.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Printer</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Button size="sm" variant="outline" onClick={testPrint}>Send test page</Button>
            {printMsg && <p className="text-muted-foreground">{printMsg}</p>}
            {failedPrints.slice(0, 3).map((j) => (
              <div key={j.id} className="flex items-center justify-between gap-2 rounded-md border px-2 py-1 text-xs">
                <span className="truncate">{j.title}</span>
                <Button size="sm" variant="destructive" onClick={() => { void retryPrintJob(j.id).then(() => setPrintMsg("Retried.")) }}>
                  Retry
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm">Service stress test — do it live, tick it off</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {STRESS.map((s) => (
            <label key={s.id} className="flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2 has-checked:border-emerald-500">
              <input
                type="checkbox"
                checked={!!checks[s.id]}
                onChange={() => toggle(s.id)}
                className="mt-1 h-4 w-4"
                aria-label={s.title}
              />
              <span>
                <span className="block text-sm font-medium">{s.title}</span>
                <span className="block text-xs text-muted-foreground">{s.steps}</span>
                <span className="block text-xs"><span className="font-medium">Expect:</span> {s.expect}</span>
              </span>
            </label>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

export default function DiagnosticsPage() {
  return (
    <RequireCapability capability="audit:view">
      <DiagnosticsInner />
    </RequireCapability>
  );
}
