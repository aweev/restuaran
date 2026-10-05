"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useMenu } from "@/context/MenuContext";
import { useOrder } from "@/context/OrderContext";
import { useTable } from "@/context/TableContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { RecentOrders } from "@/components/dashboard/recent-orders";
import { TableStatus } from "@/components/dashboard/table-status";
import { PopularItems } from "@/components/dashboard/popular-items";
import { SalesChart } from "@/components/dashboard/sales-chart";
import { PageHeader, LoadingGrid, EmptyState, ErrorState, QuickActions } from "@/components/pos/ui-states";
import { personaFor } from "@/lib/personas";
import { PriorityInbox } from "@/components/dashboard/priority-inbox";
import { SetupChecklist } from "@/components/dashboard/setup-checklist";
import { getVenueSettings } from "@/lib/settings";
import { useTour } from "@/components/guided-tour/tour-provider";
import { useFeedback } from "@/lib/feedback";
import { useRouter } from "next/navigation";
import {
  ShoppingCart, ConciergeBell, CookingPot, CalendarCheck, Package,
  TrendingUp, Receipt, Clock,
} from "lucide-react";

const QUICK_ICONS: Record<string, React.ReactNode> = {
  cart: <ShoppingCart className="h-4 w-4" />,
  tables: <ConciergeBell className="h-4 w-4" />,
  kitchen: <CookingPot className="h-4 w-4" />,
  calendar: <CalendarCheck className="h-4 w-4" />,
  inventory: <Package className="h-4 w-4" />,
  orders: <Receipt className="h-4 w-4" />,
  reports: <TrendingUp className="h-4 w-4" />,
  staff: <Clock className="h-4 w-4" />,
  menu: <ShoppingCart className="h-4 w-4" />,
};

export default function DashboardPage() {
  const { state: authState } = useAuth();
  const { state: menuState, fetchMenu } = useMenu();
  const { state: orderState, fetchOrders } = useOrder();
  const { state: tableState, fetchTables } = useTable();
  const { notify } = useFeedback();
  const { startTour } = useTour();
  const router = useRouter();
  const [booted, setBooted] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [venueName, setVenueName] = useState<string | null>(null);

  const persona = personaFor(authState.user?.role);
  const greeting = useMemo(() => {
    const h = new Date().getHours();
    const part = h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
    const name = authState.user?.name?.split(" ")[0];
    return name ? `${part}, ${name}` : `${part}`;
  }, [authState.user?.name]);

  // Check if venue is configured - if not, redirect to setup (unless already there)
  const setupProgress = getVenueSettings();
  const isVenueConfigured = setupProgress.name?.trim() && setupProgress.taxRate > 0 && setupProgress.tables > 0;

  const load = async () => {
    setLoadError(null);
    try {
      await Promise.all([fetchMenu(), fetchOrders(), fetchTables()]);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Could not load dashboard data.");
    } finally {
      setBooted(true);
    }
  };

  useEffect(() => {
    if (authState.isAuthenticated) {
      if (!isVenueConfigured && !window.location.pathname.includes("/setup")) {
        router.push("/dashboard/setup");
        return;
      }
      load();
    } else if (!authState.loading) {
      setBooted(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authState.isAuthenticated, authState.loading]);

  useEffect(() => {
    setVenueName(getVenueSettings().name || null);
    // First visit per role: auto-start the dashboard tour once.
    try {
      const role = authState.user?.role ?? "unknown";
      const key = `pos.tour.seen.dashboard.${role}`;
      if (booted && !window.localStorage.getItem(key)) {
        window.localStorage.setItem(key, "1");
        // Defer so tour targets are mounted.
        const t = setTimeout(() => startTour("dashboard"), 600);
        return () => clearTimeout(t);
      }
    } catch {
      /* ignore */
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booted, authState.user?.role]);

  const loading = !booted || menuState.loading || orderState.loading || tableState.loading;
  const live = booted && !loadError && !orderState.error && (orderState.orders.length > 0 || tableState.tables.length > 0);

  const stats = useMemo(() => {
    const orders = orderState.orders ?? [];
    const tables = tableState.tables ?? [];
    const todayStr = new Date().toDateString();
    const todayOrders = orders.filter((o) => {
      const raw = (o as { openedAt?: string }).openedAt ?? o.createdAt;
      const d = raw ? new Date(raw) : null;
      return d && !Number.isNaN(d.getTime()) && d.toDateString() === todayStr;
    });
    const todaySales = todayOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
    const totalSales = orders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
    const completed = orders.filter((o) => o.status === "completed").length;
    const pending = orders.filter((o) => ["pending", "preparing", "ready"].includes(o.status)).length;
    const available = tables.filter((t) => t.status === "available").length;
    return { todaySales, todayCount: todayOrders.length, totalSales, completed, pending, available, tableCount: tables.length, orderCount: orders.length };
  }, [orderState.orders, tableState.tables]);

  if (loading) {
    return (
      <div className="space-y-4">
        <PageHeader title={persona.title} subtitle={persona.tagline} />
        <LoadingGrid count={4} />
      </div>
    );
  }

  if (loadError || orderState.error) {
    return (
      <div className="space-y-4">
        <PageHeader title={persona.title} subtitle={persona.tagline} />
        <ErrorState message={loadError ?? orderState.error ?? undefined} onRetry={load} />
      </div>
    );
  }

  const quickItems = persona.quickActions.map((a) => ({
    label: a.label, href: a.href, hint: a.hint, icon: QUICK_ICONS[a.icon] ?? <ShoppingCart className="h-4 w-4" />,
  }));

  return (
    <div className="space-y-5">
      <div id="dashboard-overview">
      <PageHeader
        title={greeting}
        subtitle={`${persona.title} — ${persona.tagline}`}
        live={live}
        actions={
          <>
            <Button size="sm" variant="outline" asChild className="pos-press">
              <Link href="/dashboard/kitchen">Kitchen board</Link>
            </Button>
            <Button
              size="sm"
              asChild
              className="pos-press"
              onClick={() => notify("info", "Opening new order…")}
            >
              <Link href="/dashboard/orders/new">New order</Link>
            </Button>
          </>
        }
      />
      </div>

      {venueName === "" && (
        <div role="alert" className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm">
          No venue configured yet. <Link className="font-medium underline" href="/dashboard/setup">Complete setup</Link> to name your venue, set tax and add tables.
        </div>
      )}

      <SetupChecklist />

      <PriorityInbox />

      <section aria-label="Quick actions">
        <QuickActions items={quickItems} />
      </section>

      {stats.orderCount === 0 && stats.tableCount === 0 ? (
        <EmptyState
          title="Nothing on the books yet"
          hint="Create your first order to see sales, tables and popular items come alive here."
          action={<Button asChild size="sm"><Link href="/dashboard/orders/new">Create first order</Link></Button>}
        />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Today's sales", value: `$${stats.todaySales.toFixed(2)}`, sub: `${stats.todayCount} orders today` },
              { label: "Completed", value: String(stats.completed), sub: "Served & closed" },
              { label: "Active now", value: String(stats.pending), sub: "Pending · preparing · ready" },
              { label: "Tables free", value: `${stats.available} / ${stats.tableCount}`, sub: stats.tableCount ? `${Math.round((stats.available / Math.max(stats.tableCount, 1)) * 100)}% availability` : "No tables configured" },
            ].map((s) => (
              <Card key={s.label} className="pos-card-hover">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{s.label}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold tabular-nums">{s.value}</div>
                  <p className="text-xs text-muted-foreground">{s.sub}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Tabs defaultValue="overview" className="space-y-4">
            <TabsList aria-label="Dashboard views">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="service">Service</TabsTrigger>
            </TabsList>
            <TabsContent value="overview" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                <Card className="col-span-4">
                  <CardHeader>
                    <CardTitle>Sales overview</CardTitle>
                    <CardDescription>Revenue across recent orders</CardDescription>
                  </CardHeader>
                  <CardContent className="pl-2">
                    {orderState.orders.length === 0
                      ? <p className="px-4 py-8 text-sm text-muted-foreground">No sales yet — charts appear after the first order.</p>
                      : <SalesChart orders={orderState.orders} />}
                  </CardContent>
                </Card>
                <Card className="col-span-3" id="recent-orders">
                  <CardHeader>
                    <CardTitle>Recent orders</CardTitle>
                    <CardDescription>{stats.pending} orders pending</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <RecentOrders orders={orderState.activeOrders.slice(0, 5)} />
                  </CardContent>
                </Card>
              </div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                <Card className="col-span-3">
                  <CardHeader>
                    <CardTitle>Popular items</CardTitle>
                    <CardDescription>Top selling menu items</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <PopularItems menuItems={menuState.items.filter((item) => item.popular)} />
                  </CardContent>
                </Card>
                <Card className="col-span-4" id="table-status">
                  <CardHeader>
                    <CardTitle>Table status</CardTitle>
                    <CardDescription>Current table occupancy</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <TableStatus tables={tableState.tables} />
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
            <TabsContent value="service">
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader><CardTitle>Floor now</CardTitle><CardDescription>Every table at a glance</CardDescription></CardHeader>
                  <CardContent><TableStatus tables={tableState.tables} /></CardContent>
                </Card>
                <Card>
                  <CardHeader><CardTitle>What is firing</CardTitle><CardDescription>Oldest active tickets first</CardDescription></CardHeader>
                  <CardContent><RecentOrders orders={orderState.activeOrders.slice(0, 8)} /></CardContent>
                </Card>
              </div>
            </TabsContent>
            </Tabs>
        </>
      )}
    </div>
  );
}
