"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { NAV_META, canSeeNav } from "@/lib/personas";
import { getUserPermissions } from "@/lib/auth";
import { getEnabledModules, getSoloMode, type ModuleKey } from "@/lib/settings";
import { ChevronDown } from "lucide-react";

const ORDER: { key: string; match: string[] }[] = [
  { key: "dashboard", match: ["/dashboard"] },
  { key: "orders", match: ["/dashboard/orders"] },
  { key: "newOrder", match: ["/dashboard/orders/new"] },
  { key: "menu", match: ["/dashboard/menu"] },
  { key: "tables", match: ["/dashboard/tables"] },
  { key: "kitchen", match: ["/dashboard/kitchen"] },
  { key: "kds", match: ["/dashboard/kitchen/display"] },
  { key: "inventory", match: ["/dashboard/inventory"] },
  { key: "cash", match: ["/dashboard/cash"] },
  { key: "reports", match: ["/dashboard/reports"] },
  { key: "zReport", match: ["/dashboard/reports/z-report"] },
  { key: "audit", match: ["/dashboard/audit"] },
  { key: "staff", match: ["/dashboard/staff"] },
  { key: "diagnostics", match: ["/dashboard/diagnostics"] },
  { key: "settings", match: ["/dashboard/settings"] },
];

/** Client module toggles → nav keys. RBAC still applies first. */
const MODULE_NAV: Record<ModuleKey, string[]> = {
  pos: ["orders", "newOrder"],
  tables: ["tables"],
  kitchen: ["kitchen", "kds"],
  inventory: ["inventory"],
  reservations: [],
  giftCards: [],
  promotions: [],
  platform: [],
};

/** Solo-operator essentials: ring, fire, seat, cash. Settings stays so solo can exit. */
const SOLO_KEYS = new Set(["dashboard", "orders", "newOrder", "tables", "kitchen", "kds", "settings"]);

const GROUPS: { title: string; keys: string[] }[] = [
  { title: "Service", keys: ["dashboard", "orders", "newOrder", "tables", "kitchen", "kds"] },
  { title: "Back-of-house", keys: ["menu", "inventory", "staff"] },
  { title: "Money", keys: ["cash", "reports", "zReport", "audit"] },
  { title: "Admin", keys: ["settings", "diagnostics"] },
];

export function DashboardNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { state } = useAuth();
  const permissions = state.user ? getUserPermissions(state.user) : [];
  const [prefsTick, setPrefsTick] = useState(0);
  // Settings writes localStorage; re-read on navigation + cross-tab updates so
  // toggles take effect without a reload. Same-tab toggles dispatch pos:prefs
  // (storage events only fire cross-tab).
  useEffect(() => {
    const bump = () => setPrefsTick((t) => t + 1);
    window.addEventListener("storage", bump);
    window.addEventListener("pos:prefs", bump);
    return () => {
      window.removeEventListener("storage", bump);
      window.removeEventListener("pos:prefs", bump);
    };
  }, []);
  const solo = getSoloMode();
  const enabled = getEnabledModules();
  void prefsTick;
  // RBAC-driven navigation: show items the user has permission for.
  const visible = new Set(
    ORDER.filter((o) => {
      if (!canSeeNav(permissions, o.key)) return false;
      if (solo && !SOLO_KEYS.has(o.key)) return false;
      const off = (Object.keys(MODULE_NAV) as ModuleKey[]).find(
        (m) => !enabled[m] && MODULE_NAV[m].includes(o.key),
      );
      if (off) return false;
      return true;
    }).map((o) => o.key),
  );
  const hiddenCount = ORDER.filter((o) => canSeeNav(permissions, o.key) && !visible.has(o.key)).length;
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  return (
    <nav className="grid items-start gap-1 px-3 py-3" aria-label="Primary">
      {GROUPS.map((group) => {
        const items = group.keys.filter((k) => visible.has(k));
        if (items.length === 0) return null;
        const isCollapsed = collapsed[group.title] === true;
        return (
          <section key={group.title} aria-label={group.title}>
            <button
              type="button"
              aria-expanded={!isCollapsed}
              onClick={() => setCollapsed((c) => ({ ...c, [group.title]: !isCollapsed }))}
              className="flex w-full items-center justify-between rounded-md px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
            >
              <span>{group.title}</span>
              <ChevronDown
                className={cn("h-3.5 w-3.5 transition-transform", isCollapsed && "-rotate-90")}
                aria-hidden
              />
            </button>
            {!isCollapsed && (
              <div className="grid items-start gap-1">
                {items.map((key) => {
                  const meta = NAV_META[key];
                  if (!meta) return null;
                  const Icon = meta.icon;
                  const active = pathname === meta.href || (key !== "dashboard" && pathname?.startsWith(meta.href));
                  return (
                    <Link
                      key={key}
                      href={meta.href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "group flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors pos-press",
                        active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" aria-hidden />
                      <span className="flex-1">{meta.title}</span>
                      {meta.kbd && (
                        <kbd className="hidden rounded border px-1 text-[10px] text-muted-foreground group-hover:border-current lg:inline">{meta.kbd}</kbd>
                      )}
                    </Link>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}
      <p className="px-3 pt-3 text-[11px] text-muted-foreground">Press Ctrl+K to search</p>
      {solo && (
        <p className="px-3 text-[11px] font-medium text-muted-foreground" role="status">
          Solo mode — essentials only. Turn off in Settings → Modules.
        </p>
      )}
      {!solo && hiddenCount > 0 && (
        <p className="px-3 text-[11px] text-muted-foreground" role="status">
          {hiddenCount} section{hiddenCount === 1 ? "" : "s"} hidden by module toggles (Settings → Modules).
        </p>
      )}
    </nav>
  );
}
