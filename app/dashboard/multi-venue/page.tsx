"use client"

import { useState, useEffect, useCallback } from "react"
import { useVenue } from "@/context/VenueContext"
import { useOrder } from "@/context/OrderContext"
import { useTable } from "@/context/TableContext"
import { useMenu } from "@/context/MenuContext"
import { SignalDashboard } from "@/components/dashboard/signal-dashboard"
import { VenueSelector } from "@/components/venue/venue-selector"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Building2, ShoppingCart, Users, UtensilsCrossed, DollarSign, ArrowUpRight } from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"

interface VenueStats {
  venueId: string
  venueName: string
  totalSales: number
  orderCount: number
  activeOrders: number
  availableTables: number
  totalTables: number
  popularItems: Array<{ name: string; count: number }>
}

export default function MultiVenueDashboard() {
  const { currentVenue, loading: venueLoading, refreshVenues } = useVenue()
  const { state: orderState, fetchOrders } = useOrder()
  const { state: tableState, fetchTables } = useTable()
  const { state: menuState, fetchMenu } = useMenu()
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: new Date(new Date().setHours(0, 0, 0, 0)),
    to: new Date(new Date().setHours(23, 59, 59, 999)),
  })
  const [venueStats, setVenueStats] = useState<Record<string, VenueStats>>({})
  const [comparisonMode, setComparisonMode] = useState(false)

  const calculateVenueStats = useCallback((venueId: string, orderState: { orders: Array<{ venueId?: string; status: string; total: number | string; items?: Array<{ title: string; quantity: number }> }> }, tableState: { tables: Array<{ venueId?: string; status: string }> }): VenueStats => {
    const orders = orderState.orders?.filter((o) => o.venueId === venueId) || []
    const tables = tableState.tables?.filter((t) => t.venueId === venueId) || []
    
    const completedOrders = orders.filter((o) => o.status === "completed")
    const activeOrders = orders.filter((o) => ["pending", "preparing", "ready"].includes(o.status))
    const availableTables = tables.filter((t) => t.status === "available").length
    
    const totalSales = completedOrders.reduce((sum: number, o) => sum + (Number(o.total) || 0), 0)
    
    // Popular items
    const itemCounts: Record<string, number> = {}
    completedOrders.forEach((order) => {
      order.items?.forEach((item) => {
        itemCounts[item.title] = (itemCounts[item.title] || 0) + item.quantity
      })
    })
    const popularItems = Object.entries(itemCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }))

    return {
      venueId,
      venueName: currentVenue?.name || "Unknown",
      totalSales,
      orderCount: completedOrders.length,
      activeOrders: activeOrders.length,
      availableTables,
      totalTables: tables.length,
      popularItems,
    }
  }, [currentVenue])

  // Load data for all venues (in real app, this would be per-venue API calls)
  useEffect(() => {
    const loadData = async () => {
      try {
        await Promise.all([fetchOrders(), fetchTables(), fetchMenu()])
        // Calculate stats for current venue
        const stats = calculateVenueStats(currentVenue?.id || "", orderState, tableState)
        setVenueStats(prev => ({ ...prev, [currentVenue?.id || ""]: stats }))
      } catch (error) {
        console.error("Error loading dashboard data:", error)
      }
    }

    if (currentVenue) loadData()
  }, [currentVenue, orderState, tableState, menuState, fetchOrders, fetchTables, fetchMenu, calculateVenueStats])

  const currentStats = venueStats[currentVenue?.id || ""]
  const allVenueStats = Object.values(venueStats)

  if (venueLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Multi-Venue Dashboard</h1>
          <VenueSelector />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}><CardContent className="h-20 animate-pulse bg-muted" /></Card>
          ))}
        </div>
      </div>
    )
  }

  if (!currentVenue) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Multi-Venue Dashboard</h1>
          <VenueSelector />
        </div>
        <Card>
          <CardContent className="py-8 text-center">
            <Building2 className="h-12 w-12 mx-auto text-muted-foreground" />
            <h3 className="mt-2 text-lg font-medium">No venue selected</h3>
            <p className="text-sm text-muted-foreground mt-1">Select a venue to view dashboard</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const formatCurrency = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold">Multi-Venue Dashboard</h1>
          <Badge variant="outline" className="gap-1">
            <Building2 className="h-3 w-3" />
            {currentVenue.name}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <VenueSelector />
          <button
            onClick={() => refreshVenues()}
            className="p-2 rounded-lg hover:bg-accent transition-colors"
            title="Refresh venues"
          >
            <ArrowUpRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Date range picker */}
      <div className="flex items-center gap-4">
        <label className="text-sm font-medium">Period:</label>
        <input
          type="date"
          value={format(dateRange.from, "yyyy-MM-dd")}
          onChange={(e) => setDateRange(prev => ({ ...prev, from: new Date(e.target.value) }))}
          className="border rounded-lg px-3 py-1.5 text-sm"
        />
        <span className="text-muted-foreground">to</span>
        <input
          type="date"
          value={format(dateRange.to, "yyyy-MM-dd")}
          onChange={(e) => setDateRange(prev => ({ ...prev, to: new Date(e.target.value) }))}
          className="border rounded-lg px-3 py-1.5 text-sm"
        />
        <button
          onClick={() => setComparisonMode(!comparisonMode)}
          className={cn("px-3 py-1.5 rounded-lg text-sm font-medium transition-colors", comparisonMode ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80")}
        >
          {comparisonMode ? "Exit Compare" : "Compare Venues"}
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sales</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">{formatCurrency(currentStats?.totalSales || 0)}</div>
            <p className="text-xs text-muted-foreground">{currentStats?.orderCount || 0} completed orders</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Orders</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">{currentStats?.activeOrders || 0}</div>
            <p className="text-xs text-muted-foreground">Pending · Preparing · Ready</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Table Utilization</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">
              {currentStats?.totalTables > 0 
                ? `${Math.round(((currentStats.totalTables - currentStats.availableTables) / currentStats.totalTables) * 100)}%`
                : "N/A"}
            </div>
            <p className="text-xs text-muted-foreground">
              {currentStats?.availableTables || 0} / {currentStats?.totalTables || 0} tables free
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Top Item</CardTitle>
            <UtensilsCrossed className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold truncate">{currentStats?.popularItems[0]?.name || "—"}</div>
            <p className="text-xs text-muted-foreground">
              {currentStats?.popularItems[0]?.count || 0} sold this period
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Comparison Mode */}
      {comparisonMode && allVenueStats.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Venue Comparison</CardTitle>
            <CardDescription>Performance across all venues for the selected period</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 text-left">Venue</th>
                    <th className="pb-2 text-right">Sales</th>
                    <th className="pb-2 text-right">Orders</th>
                    <th className="pb-2 text-right">Active</th>
                    <th className="pb-2 text-right">Utilization</th>
                    <th className="pb-2 text-left">Top Item</th>
                  </tr>
                </thead>
                <tbody>
                  {allVenueStats.map((stats) => (
                    <tr key={stats.venueId} className="border-b last:border-0">
                      <td className="py-2 font-medium">{stats.venueName}</td>
                      <td className="py-2 text-right tabular-nums">{formatCurrency(stats.totalSales)}</td>
                      <td className="py-2 text-right tabular-nums">{stats.orderCount}</td>
                      <td className="py-2 text-right tabular-nums">{stats.activeOrders}</td>
                      <td className="py-2 text-right tabular-nums">
                        {stats.totalTables > 0 
                          ? `${Math.round(((stats.totalTables - stats.availableTables) / stats.totalTables) * 100)}%`
                          : "N/A"}
                      </td>
                      <td className="py-2 truncate max-w-[200px]">{stats.popularItems[0]?.name || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="signals" className="space-y-4">
        <TabsList>
          <TabsTrigger value="signals">Signals</TabsTrigger>
          <TabsTrigger value="orders">Orders</TabsTrigger>
          <TabsTrigger value="tables">Tables</TabsTrigger>
        </TabsList>

        <TabsContent value="signals" className="mt-4">
          <SignalDashboard maxSignals={15} />
        </TabsContent>

        <TabsContent value="orders" className="mt-4">
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Recent Orders</h3>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {orderState.activeOrders?.slice(0, 6).map((order) => (
                <Card key={order.id} className="pos-card-hover">
                  <CardHeader>
                    <CardTitle className="text-base">
                      {order.tableId ? `Table ${order.tableId}` : order.customerName || "Takeaway"}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{order.items?.length || 0} items</p>
                    <p className="text-lg font-bold">${Number(order.total || 0).toFixed(2)}</p>
                    <p className="text-xs text-muted-foreground">{order.status}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="tables" className="mt-4">
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Table Status</h3>
            <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {tableState.tables?.map((table) => (
                <Card key={table.id} className={cn("pos-card-hover", table.status === "occupied" && "ring-2 ring-yellow-500", table.status === "dirty" && "ring-2 ring-orange-500")}>
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium">Table {table.number}</h4>
                      <Badge variant={table.status === "available" ? "default" : table.status === "occupied" ? "secondary" : table.status === "dirty" ? "destructive" : "outline"}>
                        {table.status}
                      </Badge>
                    </div>
                    {table.orderId && (
                      <p className="text-sm text-muted-foreground mt-1">Order: {table.orderId.slice(0, 8)}</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}