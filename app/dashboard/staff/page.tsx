"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { RequireCapability } from "@/lib/auth-guard";
import { PageHeader, EmptyState, StatusBadge } from "@/components/pos/ui-states";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Users, Search, KeyRound } from "lucide-react";
import { useFeedback } from "@/lib/feedback";
import { useAuth } from "@/context/AuthContext";

interface RosterRow {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  hasPin: boolean;
  pinLocked: boolean;
}

export default function StaffPage() {
  return (
    <RequireCapability capability="staff:view">
      <StaffInner />
    </RequireCapability>
  );
}

function StaffInner() {
  const { notify } = useFeedback();
  const { state } = useAuth();
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<RosterRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [pinFor, setPinFor] = useState<RosterRow | null>(null);
  const [pin, setPin] = useState("");
  const [savingPin, setSavingPin] = useState(false);
  const canManage = state.user?.role === "admin" || state.user?.role === "manager" || state.user?.role === "owner";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/staff", { credentials: "include" });
      if (!res.ok) throw new Error("Could not load roster");
      setRows(await res.json());
    } catch (e) {
      notify("error", "Roster failed to load", e instanceof Error ? e.message : undefined);
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(
    () => rows.filter((s) => (s.name + s.email + s.role).toLowerCase().includes(q.toLowerCase())),
    [rows, q],
  );

  const savePin = async (clear = false) => {
    if (!pinFor) return;
    if (!clear && !/^\d{4,6}$/.test(pin)) {
      notify("error", "PIN must be 4–6 digits");
      return;
    }
    setSavingPin(true);
    try {
      const res = await fetch("/api/auth/set-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ userId: pinFor.id, pin: clear ? "" : pin }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "PIN update failed");
      notify("success", clear ? `PIN cleared for ${pinFor.name}` : `PIN set for ${pinFor.name}`, "They can now sign in with email + PIN on shared devices.");
      setPinFor(null);
      setPin("");
      await load();
    } catch (e) {
      notify("error", "PIN update failed", e instanceof Error ? e.message : undefined);
    } finally {
      setSavingPin(false);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Staff" subtitle="Roster and fast-login PINs — who is on the floor right now." live />
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, role…" className="pl-9" aria-label="Search staff" />
      </div>
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading roster…</p>
      ) : filtered.length === 0 ? (
        <EmptyState icon={<Users className="h-6 w-6" />} title="No teammates found" hint="Try a different search." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((s) => (
            <Card key={s.id} className="pos-card-hover">
              <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-2">
                <Avatar><AvatarFallback>{s.name.split(" ").map((w) => w[0]).join("")}</AvatarFallback></Avatar>
                <div className="min-w-0 flex-1">
                  <CardTitle className="truncate text-sm">{s.name}</CardTitle>
                  <p className="truncate text-xs text-muted-foreground">{s.email}</p>
                </div>
                <StatusBadge value={s.isActive ? "ready" : "cleaning"} />
              </CardHeader>
              <CardContent className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-2">
                  <Badge variant="secondary" className="capitalize">{s.role}</Badge>
                  {s.pinLocked ? (
                    <Badge variant="destructive">PIN locked</Badge>
                  ) : s.hasPin ? (
                    <Badge variant="outline">PIN ✓</Badge>
                  ) : (
                    <Badge variant="outline">No PIN</Badge>
                  )}
                </span>
                {canManage && (
                  <Button size="sm" variant="outline" onClick={() => { setPinFor(s); setPin(""); }}>
                    <KeyRound className="mr-1 h-3 w-3" /> PIN
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <Dialog open={pinFor !== null} onOpenChange={(o) => { if (!o) { setPinFor(null); setPin(""); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Fast-login PIN{pinFor ? ` — ${pinFor.name}` : ""}</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label htmlFor="s-pin">New PIN (4–6 digits)</Label>
              <Input id="s-pin" type="password" inputMode="numeric" maxLength={6} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="••••" />
              <p className="mt-1 text-xs text-muted-foreground">Setting a PIN resets tries and lockout. 5 wrong tries lock it for 15 minutes (password still works).</p>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setPinFor(null); setPin(""); }}>Cancel</Button>
            {pinFor?.hasPin && (
              <Button variant="outline" disabled={savingPin} onClick={() => void savePin(true)}>Clear PIN</Button>
            )}
            <Button disabled={savingPin} onClick={() => void savePin(false)}>{savingPin ? "Saving…" : "Set PIN"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
