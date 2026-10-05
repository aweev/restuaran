"use client"

import { useState, useEffect } from "react"
import { useOrder } from "@/context/OrderContext"
import { useMenu } from "@/context/MenuContext"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DateRangePicker } from "@/components/date-range-picker"
import { SalesReportChart } from "@/components/reports/sales-report-chart"
import { ItemSalesChart } from "@/components/reports/item-sales-chart"
import { OrderTypeChart } from "@/components/reports/order-type-chart"
import { HourlyRevenueChart } from "@/components/reports/hourly-revenue-chart"
import { ReportTable } from "@/components/reports/report-table"
import { ExportButtons } from "@/components/reports/export-buttons"
import { exportOrdersToCSV } from "@/lib/export-utils"
import { format, subDays } from "date-fns"
import { Loader2 } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/pos/ui-states"

export default function ReportsPage() {
  const { state: orderState, fetchOrders } = useOrder()
  const { state: menuState, fetchMenu } = useMenu()
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState({
    from: subDays(new Date(), 30),
    to: new Date(),
  })

  useEffect(() => {
    const loadData = async () => {
      try {
        await Promise.all([fetchOrders(), fetchMenu()])
      } catch (error) {
        console.error("Error loading report data:", error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [fetchOrders, fetchMenu])

  // Filter orders by date range
  const filteredOrders = orderState.orders.filter((order) => {
    const orderDate = new Date(order.createdAt)
    return orderDate >= dateRange.from && orderDate <= dateRange.to
  })

  // Calculate total revenue
  const totalRevenue = filteredOrders.reduce((sum, order) => sum + order.total, 0)

  // Calculate average order value
  const avgOrderValue = filteredOrders.length > 0 ? totalRevenue / filteredOrders.length : 0

  // Calculate order count by type
  const dineInOrders = filteredOrders.filter((order) => order.diningMode === "Dine in").length
  const takeAwayOrders = filteredOrders.filter((order) => order.diningMode === "Take Away").length
  const deliveryOrders = filteredOrders.filter((order) => order.diningMode === "Delivery").length

  const handleExportCSV = () => {
    return exportOrdersToCSV(filteredOrders)
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-4" id="reports-container">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h2 className="text-3xl font-bold tracking-tight">Reports & Analytics</h2>
        <div className="flex flex-col sm:flex-row gap-2">
          <DateRangePicker
            date={dateRange}
            onDateChange={(range) => {
              if (!range?.from || !range.to) return
              setDateRange({ from: range.from, to: range.to })
            }}
          />
          <ExportButtons
            onExportCSV={handleExportCSV}
            fileName={`sales-report-${format(dateRange.from, "yyyy-MM-dd")}-to-${format(dateRange.to, "yyyy-MM-dd")}`}
            pdfElementId="reports-container"
          />
        </div>
      </div>

      {orderState.orders.length === 0 ? (
        <EmptyState
          title="No sales to report yet"
          hint="Reports build themselves from closed orders — ring your first order and come back."
          action={<Button size="sm" asChild><Link href="/dashboard/orders/new">Create first order</Link></Button>}
        />
      ) : filteredOrders.length === 0 ? (
        <EmptyState
          title="No orders in this period"
          hint="Widen the date range to see sales."
        />
      ) : (
      <>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalRevenue.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              For period {format(dateRange.from, "MMM d, yyyy")} - {format(dateRange.to, "MMM d, yyyy")}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredOrders.length}</div>
            <p className="text-xs text-muted-foreground">Avg. ${avgOrderValue.toFixed(2)} per order</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Dine-in vs Takeaway</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {dineInOrders} / {takeAwayOrders}
            </div>
            <p className="text-xs text-muted-foreground">{deliveryOrders} delivery orders</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Top Category</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Main Dishes</div>
            <p className="text-xs text-muted-foreground">42% of total sales</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="sales" className="space-y-4">
        <TabsList>
          <TabsTrigger value="sales">Sales</TabsTrigger>
          <TabsTrigger value="items">Menu Items</TabsTrigger>
          <TabsTrigger value="hourly">Hourly Analysis</TabsTrigger>
          <TabsTrigger value="tables">Table Data</TabsTrigger>
        </TabsList>
        <TabsContent value="sales" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Sales Overview</CardTitle>
              <CardDescription>Daily revenue for the selected period</CardDescription>
            </CardHeader>
            <CardContent className="pl-2">
              <SalesReportChart orders={filteredOrders} dateRange={dateRange} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Order Types</CardTitle>
              <CardDescription>Distribution of order types</CardDescription>
            </CardHeader>
            <CardContent>
              <OrderTypeChart orders={filteredOrders} />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="items" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Top Selling Items</CardTitle>
              <CardDescription>Most popular menu items by quantity sold</CardDescription>
            </CardHeader>
            <CardContent>
              <ItemSalesChart orders={filteredOrders} menuItems={menuState.items} />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="hourly" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Hourly Revenue</CardTitle>
              <CardDescription>Revenue distribution by hour of day</CardDescription>
            </CardHeader>
            <CardContent>
              <HourlyRevenueChart orders={filteredOrders} />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="tables" className="space-y-4" id="table-report">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Detailed Sales Report</CardTitle>
                <CardDescription>Comprehensive sales data for the selected period</CardDescription>
              </div>
              <ExportButtons
                onExportCSV={handleExportCSV}
                fileName={`detailed-sales-${format(new Date(), "yyyy-MM-dd")}`}
                pdfElementId="table-report"
              />
            </CardHeader>
            <CardContent>
              <ReportTable orders={filteredOrders} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      </>
      )}
    </div>
  )
}
