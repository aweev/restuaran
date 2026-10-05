"use client";

export interface VenueSettings {
  name: string;
  currency: string;
  /** Tax rate as a decimal fraction, e.g. 0.085 for 8.5%. */
  taxRate: number;
  tables: number;
  serviceModel: "table" | "counter" | "both";
  slaMinutes: number;
  /** Default gratuity/service-charge rate as a fraction (0–1). */
  gratuityRate: number;
  /** Opening hours free text, e.g. "Mon–Sun 11:00–23:00". */
  hours: string;
}

const VENUE_KEY = "pos.venue.settings";
const MODULES_KEY = "pos.modules.enabled";
const SOLO_KEY = "pos.soloMode";

export const ALL_MODULES = [
  "pos",
  "tables",
  "kitchen",
  "inventory",
  "reservations",
  "giftCards",
  "promotions",
  "platform",
] as const;

export type ModuleKey = (typeof ALL_MODULES)[number];

const DEFAULTS: VenueSettings = {
  name: "",
  currency: "USD",
  taxRate: 0.05,
  tables: 14,
  serviceModel: "table",
  slaMinutes: 20,
  gratuityRate: 0,
  hours: "",
};

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return { ...(fallback as object), ...(JSON.parse(raw) as object) } as T;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode / quota: settings simply don't persist */
  }
}

export function getVenueSettings(): VenueSettings {
  const raw = read<Partial<VenueSettings>>(VENUE_KEY, {});
  const taxRate =
    typeof raw.taxRate === "number" && raw.taxRate >= 0 && raw.taxRate <= 1
      ? raw.taxRate
      : DEFAULTS.taxRate;
  const tables =
    typeof raw.tables === "number" && Number.isFinite(raw.tables) && raw.tables >= 0
      ? Math.floor(raw.tables)
      : DEFAULTS.tables;
  const slaMinutes =
    typeof raw.slaMinutes === "number" && raw.slaMinutes > 0 && raw.slaMinutes <= 180
      ? Math.floor(raw.slaMinutes)
      : DEFAULTS.slaMinutes;
  const gratuityRate =
    typeof raw.gratuityRate === "number" && raw.gratuityRate >= 0 && raw.gratuityRate <= 1
      ? raw.gratuityRate
      : DEFAULTS.gratuityRate;
  return {
    name: typeof raw.name === "string" ? raw.name : DEFAULTS.name,
    currency: typeof raw.currency === "string" && raw.currency ? raw.currency : DEFAULTS.currency,
    taxRate,
    tables,
    serviceModel:
      raw.serviceModel === "counter" || raw.serviceModel === "both" ? raw.serviceModel : "table",
    slaMinutes,
    gratuityRate,
    hours: typeof raw.hours === "string" ? raw.hours : DEFAULTS.hours,
  };
}

export function saveVenueSettings(patch: Partial<VenueSettings>) {
  const next = { ...getVenueSettings(), ...patch };
  write(VENUE_KEY, next);
  return next;
}

/** Canonical venue id used when the deployment is single-venue. */
export const KERNEL_VENUE_ID = "venue-1";

export type KernelRun = (
  commandType: string,
  payload: Record<string, unknown>,
) => Promise<unknown>;

/**
 * Sync local venue settings into kernel events (canonical store).
 * localStorage remains as the offline cache; the kernel is the source of
 * truth the server reads for tax/currency on receipts and reports.
 * Solo mode + module toggles ride in the same venue.update so every device
 * shares one progressive-disclosure state.
 */
export async function syncVenueSettingsToKernel(
  run: KernelRun,
  s: VenueSettings,
  venueId: string = KERNEL_VENUE_ID,
): Promise<void> {
  await run("venue.configureTax", { venueId, taxRate: s.taxRate, currency: s.currency });
  const enabled = getEnabledModules();
  const allOn = ALL_MODULES.every((m) => enabled[m]);
  await run("venue.update", {
    venueId,
    name: s.name || undefined,
    currency: s.currency,
    serviceModel: s.serviceModel,
    tableCount: s.tables,
    slaMinutes: s.slaMinutes,
    gratuityRate: s.gratuityRate,
    soloMode: getSoloMode(),
    enabledModules: allOn ? null : ALL_MODULES.filter((m) => enabled[m]),
  });
}

/** Parse pasted menu CSV: one `name, price` per line. Returns valid rows. */
export function parseMenuCsv(text: string): Array<{ name: string; price: number }> {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const idx = line.lastIndexOf(",");
      if (idx < 0) return null;
      const name = line.slice(0, idx).trim();
      const price = Number(line.slice(idx + 1).trim());
      if (!name || !Number.isFinite(price) || price < 0) return null;
      return { name, price };
    })
    .filter((r): r is { name: string; price: number } => r !== null)
    .slice(0, 200);
}

export function getEnabledModules(): Record<ModuleKey, boolean> {
  if (typeof window === "undefined")
    return Object.fromEntries(ALL_MODULES.map((m) => [m, true])) as Record<ModuleKey, boolean>;
  try {
    const raw = window.localStorage.getItem(MODULES_KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<Record<ModuleKey, boolean>>) : {};
    return Object.fromEntries(ALL_MODULES.map((m) => [m, parsed[m] !== false])) as Record<
      ModuleKey,
      boolean
    >;
  } catch {
    return Object.fromEntries(ALL_MODULES.map((m) => [m, true])) as Record<ModuleKey, boolean>;
  }
}

export function setModuleEnabled(mod: ModuleKey, enabled: boolean) {
  write(MODULES_KEY, { ...getEnabledModules(), [mod]: enabled });
  notifyPrefs();
}

export function getSoloMode(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(SOLO_KEY) === "1";
  } catch {
    return false;
  }
}

export function setSoloMode(on: boolean) {
  try {
    window.localStorage.setItem(SOLO_KEY, on ? "1" : "0");
  } catch {
    /* ignore */
  }
  notifyPrefs();
}

/** Tell same-tab nav/header to re-read local prefs (storage events are cross-tab only). */
export function notifyPrefs() {
  try {
    window.dispatchEvent(new Event("pos:prefs"));
  } catch {
    /* non-browser */
  }
}

/** Venue-setup completion used by the setup checklist + dashboard gate. */
export function getSetupProgress(): { done: string[]; pct: number } {
  const s = getVenueSettings();
  const done: string[] = [];
  if (s.name.trim()) done.push("venue");
  if (s.serviceModel) done.push("service");
  if (s.taxRate > 0 && s.currency.trim()) done.push("tax");
  if (s.tables > 0) done.push("tables");
  try {
    if (window.localStorage.getItem("pos.setup.menuDone") === "1") done.push("menu");
  } catch {
    /* ignore */
  }
  const total = 5;
  return { done, pct: Math.round((done.length / total) * 100) };
}

export function markMenuStarterDone() {
  try {
    window.localStorage.setItem("pos.setup.menuDone", "1");
  } catch {
    /* ignore */
  }
}

/**
 * Parse a human-entered rate into a decimal fraction (0–1).
 * Accepts "8.5", "8.5%", 8.5 (=8.5%), 0.085 (=8.5%).
 * Rule: trailing % always means percent; bare numbers >1 and <=100 mean
 * percent; 0–1 mean fraction. Anything else is invalid (null).
 */
export function parseRateInput(raw: unknown): number | null {
  if (typeof raw === "number") {
    if (!Number.isFinite(raw) || raw < 0) return null;
    if (raw > 100) return null;
    if (raw > 1) return raw / 100;
    return raw;
  }
  if (typeof raw !== "string") return null;
  const s = raw.trim().replace(/,/g, ".");
  if (!s) return null;
  const isPct = s.endsWith("%");
  const num = Number(isPct ? s.slice(0, -1).trim() : s);
  if (!Number.isFinite(num) || num < 0) return null;
  if (isPct) {
    if (num > 100) return null;
    return num / 100;
  }
  if (num > 100) return null;
  if (num > 1) return num / 100;
  return num;
}

/** Format a fraction (0–1) for display as percent, e.g. 0.085 -> "8.5". */
export function formatRatePercent(rate: number): string {
  if (!Number.isFinite(rate)) return "";
  return String(Math.round(rate * 1000) / 10);
}
