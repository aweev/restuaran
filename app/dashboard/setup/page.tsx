"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/pos/ui-states";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { useCommand, useKernel } from "@/kernel/react/kernel-provider";
import { useFeedback, recoveryActionsFor, notifyWithActions as notifyWithActionsFn } from "@/lib/feedback";
import {
  getVenueSettings,
  saveVenueSettings,
  markMenuStarterDone,
  parseMenuCsv,
  parseRateInput,
  formatRatePercent,
  getEnabledModules,
  getSoloMode,
  setModuleEnabled,
  setSoloMode,
  type ModuleKey,
  type VenueSettings,
} from "@/lib/settings";
import { Textarea } from "@/components/ui/textarea";

const STEPS = ["Venue profile", "Service model", "Tax & currency", "Tables", "Menu starter"];

export default function SetupWizardPage() {
  const router = useRouter();
  const { run } = useCommand();
  const { notify } = useFeedback();
  const { connection, pendingCount } = useKernel();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [stageError, setStageError] = useState<string | null>(null);
  const [stageSummary, setStageSummary] = useState<string | null>(null);
  const [store, setStore] = useState<VenueSettings>({
    name: "",
    currency: "USD",
    taxRate: 0.05,
    tables: 14,
    serviceModel: "table",
    slaMinutes: 20,
    gratuityRate: 0,
    hours: "",
  });
  const [capacity, setCapacity] = useState("4");
  const [menuName, setMenuName] = useState("");
  const [menuPrice, setMenuPrice] = useState("9.5");
  const [menuCsv, setMenuCsv] = useState("");
  const [teamSize, setTeamSize] = useState<"solo" | "small" | "full">("small");
  const [taxInput, setTaxInput] = useState<string | null>(null);
  const [gratInput, setGratInput] = useState<string | null>(null);

  useEffect(() => {
    setStore(getVenueSettings());
  }, []);

  const parsedTax = taxInput == null ? store.taxRate : parseRateInput(taxInput);
  const parsedGrat = gratInput == null ? store.gratuityRate : parseRateInput(gratInput);
  const fiscalError =
    step === 2 && (parsedTax == null || parsedGrat == null)
      ? "Enter rates as 0–100 (e.g. 8.5 for 8.5%)."
      : null;

  const runCommand = async (type: string, payload: Record<string, unknown>) => {
    try {
      const res = await run(type, payload);
      // Offline-queued counts as staged: the durable queue will replay it.
      // Only a hard server rejection is a real failure.
      if (res.success) return { ok: true as const, queued: Boolean((res as { queued?: boolean }).queued), res };
      return { ok: false as const, queued: false as const, res };
    } catch (e) {
      return { ok: false as const, queued: false as const, error: e instanceof Error ? e.message : "Network error" };
    }
  };

  /** Run many commands with bounded concurrency, collecting failures. */
  const runBatch = async (jobs: Array<{ type: string; payload: Record<string, unknown> }>, concurrency = 5) => {
    let ok = 0;
    let queued = 0;
    const failed: Array<{ job: (typeof jobs)[number]; message: string }> = [];
    for (let i = 0; i < jobs.length; i += concurrency) {
      const chunk = jobs.slice(i, i + concurrency);
      const results = await Promise.all(chunk.map((j) => runCommand(j.type, j.payload)));
      results.forEach((r, k) => {
        if (r.ok) {
          ok += 1;
          if (r.queued) queued += 1;
        } else {
          const msg =
            "res" in r && r.res && !r.res.success
              ? (r.res.error?.message ?? r.res.error?.code ?? "Rejected")
              : ("error" in r && typeof (r as { error?: unknown }).error === "string" ? String((r as { error?: unknown }).error) : "Failed");
          failed.push({ job: chunk[k], message: msg });
        }
      });
    }
    return { ok, queued, failed };
  };

  const persist = (patch: Partial<VenueSettings>) => {
    const next = saveVenueSettings({ ...store, ...patch });
    setStore(next);
    return next;
  };

  /** Step 0 gate: venue.create (+fiscal sync) must succeed or queue before advancing. */
  const finishVenue = async (): Promise<boolean> => {
    const next = persist({});
    setStageError(null);
    setStageSummary(null);
    const enabled = getEnabledModules();
    const allOn = (Object.keys(enabled) as ModuleKey[]).every((m) => enabled[m]);
    const profile = {
      venueId: "venue-1",
      name: next.name,
      currency: next.currency,
      taxRate: next.taxRate,
      serviceModel: next.serviceModel,
      tableCount: next.tables,
      slaMinutes: next.slaMinutes,
      gratuityRate: next.gratuityRate,
      soloMode: getSoloMode(),
      enabledModules: allOn ? null : (Object.keys(enabled) as ModuleKey[]).filter((m) => enabled[m]),
    };
    const created = await runCommand("venue.create", profile);
    if (!created.ok) {
      const msg =
        "res" in created && created.res && !created.res.success
          ? (created.res.error?.message ?? created.res.error?.code ?? "Venue was rejected")
          : ("error" in created && typeof (created as { error?: unknown }).error === "string" ? String((created as { error?: unknown }).error) : "Could not reach the server");
      setStageError(msg);
      const code = "res" in created ? created.res?.error?.code : undefined;
      const actions = code ? recoveryActionsFor(code) : [];
      if (actions.length > 0) notifyWithActionsFn("Venue not saved", msg, actions);
      else notify("error", "Venue not saved", `${msg} — local settings kept, retry to continue.`);
      return false;
    }
    // create is idempotent-ish by venueId; configureTax makes the fiscal
    // event explicit even when the venue already exists.
    const synced = await runCommand("venue.configureTax", {
      venueId: "venue-1",
      taxRate: next.taxRate,
      currency: next.currency,
    });
    await runCommand("venue.update", {
      venueId: "venue-1",
      name: next.name || undefined,
      currency: next.currency,
      serviceModel: next.serviceModel,
      tableCount: next.tables,
      slaMinutes: next.slaMinutes,
      gratuityRate: next.gratuityRate,
      soloMode: profile.soloMode,
      enabledModules: profile.enabledModules,
    });
    if (created.queued || synced.queued) {
      setStageSummary(`Venue staged offline — ${pendingCount + 1} change(s) will sync when reconnected.`);
    }
    if (!synced.ok) {
      // Fiscal sync failed but venue exists: allow advance with warning.
      setStageSummary("Venue saved, but tax sync needs retry from Settings.");
    }
    return true;
  };

  const next = async () => {
    setStageError(null);
    setBusy(true);
    try {
      if (step === 0) {
        if (!store.name.trim()) return;
        const okVenue = await finishVenue();
        if (!okVenue) return;
      }
      if (step === 1) {
        // Team-size fork: presets for solo / small / full-restaurant.
        if (teamSize === "solo") {
          setSoloMode(true);
          const keep: ModuleKey[] = ["pos", "tables", "kitchen", "inventory"];
          (Object.keys(getEnabledModules()) as ModuleKey[]).forEach((m) =>
            setModuleEnabled(m, keep.includes(m)),
          );
          setStageSummary("Solo setup — essentials only. You can enable more modules later in Settings.");
        } else {
          setSoloMode(false);
          (Object.keys(getEnabledModules()) as ModuleKey[]).forEach((m) => setModuleEnabled(m, true));
          if (teamSize === "full") {
            persist({ tables: Math.max(store.tables, 20) });
            setStageSummary("Full-restaurant setup — all modules on.");
          }
        }
      }
      if (step === 2) {
        if (parsedTax == null || parsedGrat == null) {
          notify("error", "Check tax rates", fiscalError ?? "Rates must be 0–100%.");
          return;
        }
        persist({ taxRate: parsedTax, gratuityRate: parsedGrat });
        setTaxInput(null);
        setGratInput(null);
      }
      if (step === 3) {
        const n = Math.max(0, Math.floor(store.tables));
        const cap = Math.max(1, Math.floor(Number(capacity) || 4));
        if (n === 0) {
          setStageSummary("Skipped — no tables to create.");
        } else {
          const jobs = Array.from({ length: Math.min(n, 60) }, (_, k) => ({
            type: "table.create",
            payload: { tableId: `t-${k + 1}`, label: `T${k + 1}`, capacity: cap },
          }));
          const r = await runBatch(jobs, 5);
          if (r.failed.length > 0) {
            setStageError(`${r.failed.length} of ${jobs.length} tables failed: ${r.failed[0].message}. Retry to continue — successes are kept (idempotent by tableId).`);
            setStageSummary(`${r.ok} staged${r.queued > 0 ? ` (${r.queued} queued offline)` : ""}.`);
            notify("error", "Tables partially staged", `${r.ok}/${jobs.length} ok. ${r.failed.length} failed — retry.`);
            return;
          }
          setStageSummary(`${r.ok} tables staged${r.queued > 0 ? ` (${r.queued} queued offline)` : ""}.`);
          notify("success", `${r.ok} tables staged`);
        }
      }
    if (step === 4) {
      const rows = parseMenuCsv(menuCsv);
      const jobs =
        rows.length > 0
          ? rows.map((row) => ({ type: "menu.createItem", payload: { name: row.name, basePrice: row.price, categoryId: "mains" } }))
          : menuName.trim()
            ? [{ type: "menu.createItem", payload: { name: menuName.trim(), basePrice: Number(menuPrice) || 0, categoryId: "mains" } }]
            : [];
      if (jobs.length === 0) {
        markMenuStarterDone();
        router.push("/dashboard");
        return;
      }
      const r = await runBatch(jobs, 5);
      if (r.failed.length > 0) {
        setStageError(`${r.failed.length} of ${jobs.length} items failed: ${r.failed[0].message}. Retry — successes are kept.`);
        setStageSummary(`${r.ok} staged${r.queued > 0 ? ` (${r.queued} queued offline)` : ""}.`);
        notify("error", "Menu partially imported", `${r.ok}/${jobs.length} ok. ${r.failed.length} failed — retry.`);
        return;
      }
      markMenuStarterDone();
      notify("success", `${r.ok} menu item${r.ok === 1 ? "" : "s"} imported${r.queued > 0 ? " (queued offline)" : ""}`);
      router.push("/dashboard");
      return;
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <PageHeader title="Venue setup" subtitle={`Step ${step + 1} of ${STEPS.length}: ${STEPS[step]}`} />
      <Progress value={((step + 1) / STEPS.length) * 100} aria-label={`Step ${step + 1} of ${STEPS.length}`} />
      <Card>
        <CardHeader>
          <CardTitle>{STEPS[step]}</CardTitle>
          <CardDescription>Stored on this device and synced to the kernel when online.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {step === 0 && (
            <div className="grid gap-3">
              <div><Label htmlFor="su-name">Venue name</Label><Input id="su-name" value={store.name} onChange={(e) => setStore({ ...store, name: e.target.value })} placeholder="Maison Chili" /></div>
              <div><Label htmlFor="su-cur">Currency</Label><Input id="su-cur" value={store.currency} onChange={(e) => setStore({ ...store, currency: e.target.value.toUpperCase().slice(0, 3) })} placeholder="USD" /></div>
            </div>
          )}
          {step === 1 && (
            <div className="grid gap-3">
              <div>
                <Label htmlFor="su-model">How do you serve guests?</Label>
                <Select value={store.serviceModel} onValueChange={(v) => setStore({ ...store, serviceModel: v as VenueSettings["serviceModel"] })}>
                  <SelectTrigger id="su-model"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="table">Table service</SelectItem>
                    <SelectItem value="counter">Counter / quick-serve</SelectItem>
                    <SelectItem value="both">Both</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="su-team">Who runs the venue?</Label>
                <Select value={teamSize} onValueChange={(v) => setTeamSize(v as typeof teamSize)}>
                  <SelectTrigger id="su-team"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="solo">Just me (solo operator)</SelectItem>
                    <SelectItem value="small">Small team</SelectItem>
                    <SelectItem value="full">Full restaurant</SelectItem>
                  </SelectContent>
                </Select>
                <p className="mt-1 text-xs text-muted-foreground">
                  {teamSize === "solo"
                    ? "Collapses navigation to order + kitchen + cash essentials; extra modules stay off until you need them."
                    : teamSize === "full"
                      ? "All modules on with room for 20+ tables."
                      : "The standard setup — everything on, nothing hidden."}
                </p>
              </div>
            </div>
          )}
          {step === 2 && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div><Label htmlFor="su-tax">Tax rate % (e.g. 8.5)</Label><Input id="su-tax" type="number" min={0} max={100} step={0.1} value={taxInput ?? formatRatePercent(store.taxRate)} onChange={(e) => { setTaxInput(e.target.value); const v = parseRateInput(e.target.value); if (v != null) setStore({ ...store, taxRate: v }); }} aria-invalid={parsedTax == null} />
                {parsedTax == null ? <p className="mt-1 text-xs text-destructive" role="alert">Enter 0–100.</p> : <p className="mt-1 text-xs text-muted-foreground">Stored as {(store.taxRate * 100).toFixed(2)}% — applied server-side.</p>}</div>
              <div><Label htmlFor="su-cur2">Currency</Label><Input id="su-cur2" value={store.currency} onChange={(e) => setStore({ ...store, currency: e.target.value.toUpperCase().slice(0, 3) })} /></div>
              <div><Label htmlFor="su-grat">Gratuity / service charge %</Label><Input id="su-grat" type="number" min={0} max={100} step={0.5} value={gratInput ?? formatRatePercent(store.gratuityRate)} onChange={(e) => { setGratInput(e.target.value); const v = parseRateInput(e.target.value); if (v != null) setStore({ ...store, gratuityRate: v }); }} aria-invalid={parsedGrat == null} />
                {parsedGrat == null ? <p className="mt-1 text-xs text-destructive" role="alert">Enter 0–100.</p> : <p className="mt-1 text-xs text-muted-foreground">Separate from tax — tip at checkout.</p>}</div>
              <div><Label htmlFor="su-hours">Opening hours</Label><Input id="su-hours" value={store.hours} onChange={(e) => setStore({ ...store, hours: e.target.value })} placeholder="Mon–Sun 11:00–23:00" /></div>
            </div>
          )}
          {step === 3 && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div><Label htmlFor="su-tables">Number of tables</Label><Input id="su-tables" type="number" min={0} value={store.tables} onChange={(e) => setStore({ ...store, tables: Number(e.target.value) })} /></div>
              <div><Label htmlFor="su-cap">Seats per table</Label><Input id="su-cap" type="number" min={1} max={20} value={capacity} onChange={(e) => setCapacity(e.target.value)} /></div>
            </div>
          )}
          {step === 4 && (
            <div className="grid gap-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div><Label htmlFor="su-item">First menu item</Label><Input id="su-item" value={menuName} onChange={(e) => setMenuName(e.target.value)} placeholder="Margherita Pizza" /></div>
                <div><Label htmlFor="su-price">Price</Label><Input id="su-price" type="number" min={0} step={0.5} value={menuPrice} onChange={(e) => setMenuPrice(e.target.value)} /></div>
              </div>
              <div>
                <Label htmlFor="su-csv">…or paste a menu (one per line: name, price)</Label>
                <Textarea id="su-csv" value={menuCsv} onChange={(e) => setMenuCsv(e.target.value)} placeholder={"Margherita Pizza, 12.5\nCarbonara, 14\nTiramisu, 7"} rows={4} />
                {menuCsv.trim() && (
                  <p className="mt-1 text-xs text-muted-foreground">{parseMenuCsv(menuCsv).length} valid lines ready to import.</p>
                )}
              </div>
            </div>
          )}
          {stageError && (
            <p className="text-sm text-destructive" role="alert">{stageError}</p>
          )}
          {stageSummary && !stageError && (
            <p className="text-sm text-muted-foreground" role="status">{stageSummary}</p>
          )}
          {connection === "offline" && (
            <p className="text-sm text-amber-700" role="status">Offline — changes stage locally and sync ({pendingCount} queued).</p>
          )}
          <div className="flex justify-between pt-2">
            <Button variant="outline" disabled={step === 0 || busy} onClick={() => { setStageError(null); setStageSummary(null); setStep((s) => s - 1); }}>Back</Button>
            <Button
              onClick={() => void next()}
              disabled={busy || (step === 0 && !store.name.trim())}
            >
              {busy ? "Working…" : step === STEPS.length - 1 ? "Finish" : "Continue"}
            </Button>
          </div>
          {step === 0 && !store.name.trim() && (
            <p className="text-xs text-muted-foreground">Give your venue a name to continue.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
