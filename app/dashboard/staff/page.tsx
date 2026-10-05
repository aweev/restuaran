"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { RequireCapability } from "@/lib/auth-guard";
import { PageHeader, EmptyState, StatusBadge } from "@/components/pos/ui-states";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, Plus, Clock, Search } from "lucide-react";
import { useFeedback } from "@/lib/feedback";
import { useAuth } from "@/context/AuthContext";
import type { UserRole } from "@/types/auth";

const SEED = [
  { id: "u1", name: "Amara Diallo", email: "amara@resto.local", role: "manager" as UserRole, status: "on-shift", tables: 6 },
  { id: "u2", name: "Jonas Park", email: "jonas@resto.local", role: "waiter" as UserRole, status: "on-shift", tables: 5 },
  { id: "u3", name: "Lena Ruiz", email: "lena@resto.local", role: "kitchen" as UserRole, status: "off", tables: 0 },
  { id: "u4", name: "Theo Mensah", email: "theo@resto.local", role: "staff" as UserRole, status: "on-shift", tables: 0 },
];

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
  const [open, setOpen] = useState(false);
  const [staff, setStaff] = useState(SEED);
  const [form, setForm] = useState({ name: "", email: "", role: "waiter" as UserRole });
  const canManage = state.user?.role === "admin" || state.user?.role === "manager" || !state.user;

  const filtered = useMemo(() => staff.filter((s) => (s.name + s.email + s.role).toLowerCase().includes(q.toLowerCase())), [staff, q]);

  const invite = () => {
    if (!form.name || !form.email) { notify("error", "Name and email are required"); return; }
    setStaff((p) => [...p, { id: `u${Date.now()}`, name: form.name, email: form.email, role: form.role, status: "off", tables: 0 }]);
    setOpen(false);     setForm({ name: "", email: "", role: "waiter" as UserRole });
    notify("success", "Teammate invited", `${form.name} was added to the roster.`);
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Staff" subtitle="Roster, shifts and sections — who is on the floor right now." live
        actions={canManage ? <div className="flex gap-2"><Button size="sm" variant="outline" asChild className="pos-press"><Link href="/dashboard/staff/roles">Custom roles</Link></Button><Button size="sm" className="gap-2 pos-press" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Invite staff</Button></div> : <Button size="sm" variant="outline" asChild className="pos-press"><Link href="/dashboard/staff/roles">Custom roles</Link></Button>} />
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, role…" className="pl-9" aria-label="Search staff" />
      </div>
      {filtered.length === 0 ? (
        <EmptyState icon={<Users className="h-6 w-6" />} title="No teammates found" hint="Try a different search, or invite someone new."
          action={canManage ? <Button size="sm" onClick={() => setOpen(true)}>Invite staff</Button> : undefined} />
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
                <StatusBadge value={s.status === "on-shift" ? "ready" : "cleaning"} />
              </CardHeader>
              <CardContent className="flex items-center justify-between text-xs text-muted-foreground">
                <Badge variant="secondary" className="capitalize">{s.role}</Badge>
                <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{s.status === "on-shift" ? `${s.tables} tables` : "Off shift"}</span>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Invite teammate</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div><Label htmlFor="s-name">Name</Label><Input id="s-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Awa Koné" /></div>
            <div><Label htmlFor="s-email">Email</Label><Input id="s-email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="awa@resto.local" /></div>
            <div><Label>Role</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as UserRole })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="manager">Manager — full floor control</SelectItem>
                  <SelectItem value="waiter">Server — my section</SelectItem>
                  <SelectItem value="kitchen">Kitchen — KDS only</SelectItem>
                  <SelectItem value="staff">Cashier — fast checkout</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={invite}>Send invite</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
