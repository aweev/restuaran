"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/pos/ui-states";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useFeedback } from "@/lib/feedback";
import { GRANULAR_TO_CAPABILITY } from "@/kernel/tenant/permission-map";
import { RequireCapability } from "@/lib/auth-guard";

const CUSTOM_KEY = "pos.customRoles";

interface CustomRole {
  name: string;
  granular: string[];
}

function loadCustom(): CustomRole[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CUSTOM_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function RolesInner() {
  const { notify } = useFeedback();
  const granularKeys = useMemo(() => Object.keys(GRANULAR_TO_CAPABILITY).sort(), []);
  const baseRoles = ["admin", "manager", "server", "waiter", "host", "cashier", "kitchen", "staff"];
  const [roles, setRoles] = useState<CustomRole[]>([]);
  const [name, setName] = useState("");
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setRoles(loadCustom());
  }, []);

  const derivedCaps = useMemo(() => {
    const caps = new Set<string>();
    for (const [g, on] of Object.entries(checked)) {
      if (on) for (const c of GRANULAR_TO_CAPABILITY[g] ?? []) caps.add(c);
    }
    return [...caps].sort();
  }, [checked]);

  const save = () => {
    const roleName = name.trim();
    if (!roleName) {
      notify("error", "Role needs a name");
      return;
    }
    const granular = Object.entries(checked).filter(([, on]) => on).map(([g]) => g);
    const next = [...roles.filter((r) => r.name !== roleName), { name: roleName, granular }];
    try {
      window.localStorage.setItem(CUSTOM_KEY, JSON.stringify(next));
    } catch {
      notify("error", "Could not persist role");
      return;
    }
    setRoles(next);
    setName("");
    setChecked({});
    notify("success", `Custom role “${roleName}” saved`, `${granular.length} granular permissions → ${derivedCaps.length} capabilities.`);
  };

  const remove = (roleName: string) => {
    const next = roles.filter((r) => r.name !== roleName);
    try {
      window.localStorage.setItem(CUSTOM_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
    setRoles(next);
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Roles"
        subtitle="Compose custom roles from granular permissions. Capabilities derive via GRANULAR_TO_CAPABILITY."
      />
      <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm" role="note">
        Drafts only — custom roles are saved on this device and do not grant permissions yet.
        Enforcement is server-issued (JWT capabilities); wiring drafts to staff assignment is roadmap.
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Built-in roles</CardTitle>
          <CardDescription>Defaults live in kernel/tenant/permission-map.ts</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {baseRoles.map((r) => (
            <span key={r} className="rounded-full bg-muted px-2 py-0.5 text-xs capitalize">{r}</span>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Compose custom role</CardTitle>
          <CardDescription>{derivedCaps.length} capabilities: {derivedCaps.join(", ") || "none yet"}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div><Label htmlFor="role-name">Role name</Label><Input id="role-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="supervisor" /></div>
          <div className="grid max-h-72 gap-2 overflow-y-auto sm:grid-cols-2" role="group" aria-label="Granular permissions">
            {granularKeys.map((g) => (
              <label key={g} className="flex items-start gap-2 rounded-md border px-2 py-1.5 text-xs">
                <Checkbox
                  checked={!!checked[g]}
                  onCheckedChange={(v) => setChecked((p) => ({ ...p, [g]: v === true }))}
                  aria-label={g}
                />
                <span>
                  <span className="font-mono font-medium">{g}</span>
                  <span className="block text-muted-foreground">{(GRANULAR_TO_CAPABILITY[g] ?? []).join(", ")}</span>
                </span>
              </label>
            ))}
          </div>
          <Button size="sm" onClick={save}>Save custom role</Button>
        </CardContent>
      </Card>
      {roles.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Saved custom roles ({roles.length})</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {roles.map((r) => (
              <div key={r.name} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
                <div>
                  <p className="font-medium capitalize">{r.name}</p>
                  <p className="font-mono text-[11px] text-muted-foreground">{r.granular.join(", ") || "no permissions"}</p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => remove(r.name)}>Delete</Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function RolesPage() {
  return (
    <RequireCapability capability="staff:view">
      <RolesInner />
    </RequireCapability>
  );
}
