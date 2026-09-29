"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { useAnalytics } from "@/context/AnalyticsContext"
import { format } from "date-fns"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"
import { AlertTriangle, DollarSign, Package, Trash2 } from "lucide-react"

interface InventoryAnalyticsDashboardProps {
  dateRange: {
    from: Date
    to: Date
  }
}

export function InventoryAnalyticsDashboard({ dateRange }: InventoryAnalyticsDashboardProps) {
  const { inventoryData } = useAnalytics()

  const formattedDateRange = `${format(dateRange.from, "MMM d, yyyy")} - ${format(dateRange.to, "MMM d, yyyy")}`

  if (!inventoryData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Inventory Analytics</CardTitle>
          <CardDescription>No inventory data available for {formattedDateRange}</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const { inventoryItems, totalInventoryValue, totalUsage, totalWastage, wastagePercentage, usageByDay, itemsNeedingReorder } =
    inventoryData

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inventory Value</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalInventoryValue.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Across {inventoryItems.length} tracked items</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Usage</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalUsage.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Units consumed in period</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Wastage</CardTitle>
            <Trash2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalWastage.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">{wastagePercentage.toFixed(1)}% of usage</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Needs Reorder</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{itemsNeedingReorder.length}</div>
            <p className="text-xs text-muted-foreground">Items below reorder point</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Daily Usage vs Wastage</CardTitle>
          <CardDescription>Consumption trend for {formattedDateRange}</CardDescription>
        </CardHeader>
        <CardContent className="h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={usageByDay} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tickFormatter={(value: string) => format(new Date(value), "MMM d")} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="used" name="Used" fill="#22c55e" />
              <Bar dataKey="wastage" name="Wastage" fill="#ef4444" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Item Breakdown</CardTitle>
          <CardDescription>Stock levels and consumption per item</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {inventoryItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">No inventory items to display.</p>
          ) : (
            inventoryItems.map((item) => {
              const stockPercent =
                item.startingStock > 0 ? Math.min(100, Math.max(0, (item.currentStock / item.startingStock) * 100)) : 0

              return (
                <div key={item.id} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{item.name}</span>
                    <span className="text-muted-foreground">
                      {item.currentStock} / {item.startingStock} units
                    </span>
                  </div>
                  <Progress value={stockPercent} className="h-2" />
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>Used: {item.used.toFixed(2)}</span>
                    <span>Wastage: {item.wastage.toFixed(2)}</span>
                    <span>Cost: ${item.cost.toFixed(2)}</span>
                    {item.needsReorder && <Badge variant="destructive">Reorder</Badge>}
                  </div>
                </div>
              )
            })
          )}
        </CardContent>
      </Card>
    </div>
  )
}