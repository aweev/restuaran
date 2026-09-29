"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/context/AuthContext"
import { useMenu } from "@/context/MenuContext"
import { useOrder } from "@/context/OrderContext"
import { useTable } from "@/context/TableContext"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { RecentOrders } from "@/components/dashboard/recent-orders"
import { TableStatus } from "@/components/dashboard/table-status"
import { PopularItems } from "@/components/dashboard/popular-items"
import { SalesChart } from "@/components/dashboard/sales-chart"
import { Loader2 } from "lucide-react"

export default function DashboardPage() {
  const { state: authState } = useAuth()
  const { state: menuState, fetchMenu } = useMenu()
  const { state: orderState, fetchOrders } = useOrder()
  const { state: tableState, fetchTables } = useTable()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadData = async () => {
      try {
        await Promise.all([fetchMenu(), fetchOrders(), fetchTables()])
      } catch (error) {
        console.error("Error loading dashboard data:", error)
      } finally {
        setLoading(false)
      }
    }

    if (authState.isAuthenticated) {
      loadData()
    }
  }, [authState.isAuthenticated, fetchMenu, fetchOrders, fetchTables])

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  // Calculate statistics
  const totalSales = orderState.orders.reduce((sum, order) => sum + order.total, 0)
  const completedOrders = orderState.orders.filter((order) => order.status === "completed").length
  const pendingOrders = orderState.orders.filter((order) =>
    ["pending", "preparing", "ready"].includes(order.status),
  ).length
  const availableTables = tableState.tables.filter((table) => table.status === "available").length

  return (
    <div className="space-y-4">
      <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sales</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalSales.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">+20.1% from last month</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completedOrders}</div>
            <p className="text-xs text-muted-foreground">+15% from last month</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingOrders}</div>
            <p className="text-xs text-muted-foreground">Current active orders</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Available Tables</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {availableTables} / {tableState.tables.length}
            </div>
            <p className="text-xs text-muted-foreground">
              {Math.round((availableTables / tableState.tables.length) * 100)}% availability
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
            <Card className="col-span-4">
              <CardHeader>
                <CardTitle>Sales Overview</CardTitle>
              </CardHeader>
              <CardContent className="pl-2">
                <SalesChart orders={orderState.orders} />
              </CardContent>
            </Card>
            <Card className="col-span-3">
              <CardHeader>
                <CardTitle>Recent Orders</CardTitle>
                <CardDescription>{pendingOrders} orders pending</CardDescription>
              </CardHeader>
              <CardContent>
                <RecentOrders orders={orderState.activeOrders.slice(0, 5)} />
              </CardContent>
            </Card>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
            <Card className="col-span-3">
              <CardHeader>
                <CardTitle>Popular Items</CardTitle>
                <CardDescription>Top selling menu items</CardDescription>
              </CardHeader>
              <CardContent>
                <PopularItems menuItems={menuState.items.filter((item) => item.popular)} />
              </CardContent>
            </Card>
            <Card className="col-span-4">
              <CardHeader>
                <CardTitle>Table Status</CardTitle>
                <CardDescription>Current table occupancy</CardDescription>
              </CardHeader>
              <CardContent>
                <TableStatus tables={tableState.tables} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        <TabsContent value="analytics">
          <Card>
            <CardHeader>
              <CardTitle>Advanced Analytics</CardTitle>
              <CardDescription>Detailed sales and performance metrics</CardDescription>
            </CardHeader>
            <CardContent className="pl-2">
              <p>Advanced analytics will be implemented in a future update.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
