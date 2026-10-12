"use client";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/pos/ui-states";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { useCommand, useKernel } from "@/kernel/react/kernel-provider";
import {
  ALL_MODULES,
  formatRatePercent,
  getEnabledModules,
  getSoloMode,
  getVenueSettings,
  parseRateInput,
  saveVenueSettings,
  setModuleEnabled,
  setSoloMode,
  syncVenueSettingsToKernel,
  type ModuleKey,
  type VenueSettings,
} from "@/lib/settings";
import { RequireCapability } from "@/lib/auth-guard";

const MODULE_LABELS: Record<ModuleKey, { title: string; hint: string }> = {
  pos: { title: "Point of sale", hint: "Orders, checkout and payments" },
  tables: { title: "Tables", hint: "Floor plan and seating" },
  kitchen: { title: "Kitchen", hint: "KDS and ticket queue" },
  inventory: { title: "Inventory", hint: "Stock, recipes and 86 list" },
  reservations: { title: "Reservations", hint: "Bookings and waitlist" },
  giftCards: { title: "Gift cards", hint: "Issue and redeem" },
  promotions: { title: "Promotions", hint: "Discounts and loyalty" },
  platform: { title: "Platform", hint: "Multi-venue and integrations" },
};

function SettingsForm() {
  const { toast } = useToast();
  const { run } = useCommand();
  const { connection, pendingCount } = useKernel();
  const [prefs, setPrefs] = useState({ sound: true, haptics: true, kdsAuto: true, offline: true, compact: false });
  const [store, setStore] = useState<VenueSettings>({
    name: "",
    currency: "USD",
    taxRate: 0.05,
    tables: 14,
    serviceModel: "table",
    slaMinutes: 20,
    gratuityRate: 0,
    hours: "",
    printerEndpoint: "",
    receiptFooter: "Thank you — come again!",
    supportContact: "",
    roundingIncrement: 0,
  });
  const [modules, setModules] = useState<Record<ModuleKey, boolean>>(() => getEnabledModules());
  const [solo, setSolo] = useState(false);
  const [saving, setSaving] = useState(false);
  const [taxInput, setTaxInput] = useState<string | null>(null);
  const [gratInput, setGratInput] = useState<string | null>(null);
  const [fleet, setFleet] = useState<Array<{ deviceId: string; label: string | null; appVersion: string; role: string | null; lastSeen: string }>>([]);
  const currentBuild = process.env.NEXT_PUBLIC_APP_VERSION || "dev";

  useEffect(() => {
    setStore(getVenueSettings());
    setModules(getEnabledModules());
    setSolo(getSoloMode());
    fetch("/api/fleet", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : []))
      .then((rows) => setFleet(Array.isArray(rows) ? rows : []))
      .catch(() => null);
  }, []);

  const toggle = (k: keyof typeof prefs) => setPrefs((p) => ({ ...p, [k]: !p[k] }));

  const parsedTax = taxInput == null ? store.taxRate : parseRateInput(taxInput);
  const parsedGrat = gratInput == null ? store.gratuityRate : parseRateInput(gratInput);
  const taxError =
    taxInput != null && parsedTax == null ? "Enter 0–100 (e.g. 8.5 for 8.5%)." : null;
  const gratError =
    gratInput != null && parsedGrat == null ? "Enter 0–100 (e.g. 10 for 10%)." : null;

  const save = async () => {
    if (taxError || gratError || parsedTax == null || parsedGrat == null) {
      toast({ title: "Check tax rates", description: taxError ?? gratError ?? "Rates must be 0–100%.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const next = saveVenueSettings({ ...store, taxRate: parsedTax, gratuityRate: parsedGrat });
      setStore(next);
      setTaxInput(null);
      setGratInput(null);

      // Persist to kernel (server-authoritative)
      await syncVenueSettingsToKernel(
        async (commandType, payload) => {
          const result = await run(commandType, payload);
          if (!result.success) {
            throw new Error(result.error?.message ?? `Command ${commandType} failed`);
          }
          return result;
        },
        next,
      );

      toast({ title: "Settings saved", description: "Tax and venue profile are stored server-side." });
    } catch (error) {
      toast({ title: "Failed to save", description: error instanceof Error ? error.message : "Could not persist settings", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const flipModule = (m: ModuleKey) => {
    const next = !modules[m];
    setModules((prev) => ({ ...prev, [m]: next }));
    setModuleEnabled(m, next);
  };

  const flipSolo = (on: boolean) => {
    setSolo(on);
    setSoloMode(on);
    toast({ title: on ? "Solo-operator mode on" : "Solo-operator mode off", description: on ? "Navigation is collapsed to essentials." : "Full navigation restored." });
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Settings"
        subtitle="Store profile, devices, accessibility and service preferences."
        actions={
          <Button size="sm" onClick={save} className="pos-press" disabled={saving || connection === "offline" || !!taxError || !!gratError}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        }
      />
      {connection === "offline" && pendingCount > 0 && (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm" role="status">
          Offline — {pendingCount} change{pendingCount > 1 ? "s" : ""} queued. Will sync when reconnected.
        </div>
      )}
      <Tabs defaultValue="general" className="space-y-4">
        <TabsList aria-label="Settings sections">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="modules">Modules</TabsTrigger>
          <TabsTrigger value="devices">Devices & alerts</TabsTrigger>
          <TabsTrigger value="access">Accessibility</TabsTrigger>
        </TabsList>
        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle>Store profile</CardTitle>
              <CardDescription>Shown on receipts and the customer menu. Tax and gratuity are entered as % and stored server-side as a 0–1 rate.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="st-name">Store name</Label>
                <Input id="st-name" value={store.name} onChange={(e) => setStore({ ...store, name: e.target.value })} placeholder="Maison Chili" />
              </div>
              <div>
                <Label htmlFor="st-cur">Currency</Label>
                <Input id="st-cur" value={store.currency} onChange={(e) => setStore({ ...store, currency: e.target.value.toUpperCase().slice(0, 3) })} placeholder="USD" />
              </div>
              <div>
                <Label htmlFor="st-tax">Tax rate % (e.g. 8.5)</Label>
                <Input id="st-tax" type="number" min={0} max={100} step={0.1} value={taxInput ?? formatRatePercent(store.taxRate)} onChange={(e) => { setTaxInput(e.target.value); const v = parseRateInput(e.target.value); if (v != null) setStore({ ...store, taxRate: v }); }} aria-invalid={!!taxError} />
                {taxError ? (
                  <p className="mt-1 text-xs text-destructive" role="alert">{taxError}</p>
                ) : (
                  <p className="mt-1 text-xs text-muted-foreground">Stored as {(store.taxRate * 100).toFixed(2)}% — applied server-side via order.applyTax.</p>
                )}
              </div>
              <div>
                <Label htmlFor="st-tab">Tables</Label>
                <Input id="st-tab" type="number" min={0} value={store.tables} onChange={(e) => setStore({ ...store, tables: Number(e.target.value) })} />
              </div>
              <div>
                <Label htmlFor="st-model">Service model</Label>
                <Select value={store.serviceModel} onValueChange={(v) => setStore({ ...store, serviceModel: v as VenueSettings["serviceModel"] })}>
                  <SelectTrigger id="st-model"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="table">Table service</SelectItem>
                    <SelectItem value="counter">Counter / quick-serve</SelectItem>
                    <SelectItem value="both">Both</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="st-sla">Kitchen SLA (minutes)</Label>
                <Input id="st-sla" type="number" min={1} max={180} value={store.slaMinutes} onChange={(e) => setStore({ ...store, slaMinutes: Number(e.target.value) })} />
              </div>
              <div>
                <Label htmlFor="st-grat">Gratuity / service charge %</Label>
                <Input id="st-grat" type="number" min={0} max={100} step={0.5} value={gratInput ?? formatRatePercent(store.gratuityRate)} onChange={(e) => { setGratInput(e.target.value); const v = parseRateInput(e.target.value); if (v != null) setStore({ ...store, gratuityRate: v }); }} aria-invalid={!!gratError} />
                {gratError ? (
                  <p className="mt-1 text-xs text-destructive" role="alert">{gratError}</p>
                ) : (
                  <p className="mt-1 text-xs text-muted-foreground">Separate from tax. Applied as tip/service-charge at checkout, never mixed into tax math.</p>
                )}
              </div>
              <div>
                <Label htmlFor="st-round">Cash rounding</Label>
                <Select value={String(store.roundingIncrement)} onValueChange={(v) => setStore({ ...store, roundingIncrement: Number(v) })}>
                  <SelectTrigger id="st-round"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Exact (no rounding)</SelectItem>
                    <SelectItem value="0.01">Penny (0.01)</SelectItem>
                    <SelectItem value="0.05">Nickel (0.05)</SelectItem>
                    <SelectItem value="0.1">Dime (0.10)</SelectItem>
                    <SelectItem value="0.25">Quarter (0.25)</SelectItem>
                    <SelectItem value="1">Whole unit (1.00)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="mt-1 text-xs text-muted-foreground">Cash tendered and change only. Cards stay exact; the ledger stays exact.</p>
              </div>
              <div>
                <Label htmlFor="st-hours">Opening hours</Label>
                <Input id="st-hours" value={store.hours} onChange={(e) => setStore({ ...store, hours: e.target.value })} placeholder="Mon–Sun 11:00–23:00" />
              </div>
              <div>
                <Label htmlFor="st-support">Support contact (shown on login)</Label>
                <Input id="st-support" value={store.supportContact} onChange={(e) => setStore({ ...store, supportContact: e.target.value })} placeholder="+230 5XXX XXXX — who to call mid-service" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="modules">
          <Card>
            <CardHeader>
              <CardTitle>Modules</CardTitle>
              <CardDescription>Toggle venue capabilities. Disabled modules are hidden from navigation on this device; server-side modules stay installed.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {ALL_MODULES.map((m) => (
                <div key={m} className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium">{MODULE_LABELS[m].title}</p>
                    <p className="text-xs text-muted-foreground">{MODULE_LABELS[m].hint}</p>
                  </div>
                  <Switch checked={modules[m]} onCheckedChange={() => flipModule(m)} aria-label={`${MODULE_LABELS[m].title} module`} />
                </div>
              ))}
              <Separator />
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">Solo-operator mode</p>
                  <p className="text-xs text-muted-foreground">Collapse navigation to order + kitchen + cash essentials</p>
                </div>
                <Switch checked={solo} onCheckedChange={flipSolo} aria-label="Solo-operator mode" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="devices">
          <Card>
            <CardHeader>
              <CardTitle>Devices & alerts</CardTitle>
              <CardDescription>Sound, vibration, kitchen display behaviour — and where receipts print.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="st-printer">LAN print-service endpoint (optional)</Label>
                <Input id="st-printer" value={store.printerEndpoint} onChange={(e) => setStore({ ...store, printerEndpoint: e.target.value.trim() })} placeholder="http://192.168.1.50:9100/print" inputMode="url" />
                <p className="mt-1 text-xs text-muted-foreground">POSTs {"{title, html}"} per receipt. Empty = browser print dialog (thermal driver on the tablet).</p>
              </div>
              <div>
                <Label htmlFor="st-footer">Receipt footer</Label>
                <Input id="st-footer" value={store.receiptFooter} onChange={(e) => setStore({ ...store, receiptFooter: e.target.value })} placeholder="Thank you — come again!" />
              </div>
              <Separator />
              <div>
                <p className="text-sm font-medium">Tablet fleet ({fleet.length})</p>
                <p className="text-xs text-muted-foreground">This build: <code>{currentBuild}</code>. Stale or silent &gt;24h devices need a relaunch before Friday service.</p>
                {fleet.length === 0 ? (
                  <p className="mt-2 text-xs text-muted-foreground">No heartbeats yet — devices report while signed in.</p>
                ) : (
                  <ul className="mt-2 space-y-1">
                    {fleet.slice(0, 20).map((d) => {
                      const seen = Date.parse(d.lastSeen);
                      const silentH = Number.isFinite(seen) ? (Date.now() - seen) / 3600000 : 99;
                      const stale = d.appVersion !== currentBuild || silentH > 24;
                      return (
                        <li key={d.deviceId} className="flex flex-wrap justify-between gap-2 rounded-md border px-3 py-1.5 text-xs">
                          <span className="font-mono">{d.deviceId.slice(0, 8)} · {d.label || "?"} · {d.role || "?"}</span>
                          <span className={stale ? "font-semibold text-destructive" : "text-emerald-600"}>
                            {d.appVersion}{stale ? " — update" : " ✓"}{silentH > 24 ? " · silent" : ""}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
              <Separator />
              {([["sound", "Success chime", "Short tone on payment & bump"], ["haptics", "Haptic feedback", "Vibrate on key actions (mobile)"], ["kdsAuto", "Auto-advance KDS", "Move bumped tickets to done"], ["offline", "Offline queue", "Keep selling when the network drops"]] as const).map(([k, t, d]) => (
                <div key={k} className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium">{t}</p>
                    <p className="text-xs text-muted-foreground">{d}</p>
                  </div>
                  <Switch checked={prefs[k]} onCheckedChange={() => toggle(k)} aria-label={t} />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="access">
          <Card>
            <CardHeader>
              <CardTitle>Accessibility</CardTitle>
              <CardDescription>Reduce motion, denser rows and focus visibility are built in.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">Compact tables</p>
                  <p className="text-xs text-muted-foreground">Denser rows for small screens</p>
                </div>
                <Switch checked={prefs.compact} onCheckedChange={() => toggle("compact")} aria-label="Compact tables" />
              </div>
              <Separator />
              <p className="text-xs text-muted-foreground">All interactive elements support keyboard navigation, visible focus rings and screen-reader labels. Motion respects <code>prefers-reduced-motion</code>.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <RequireCapability capability="settings:view">
      <SettingsForm />
    </RequireCapability>
  );
}
