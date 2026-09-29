"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useAnalytics } from "@/context/AnalyticsContext"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { ArrowDownIcon, ArrowUpIcon } from "lucide-react"

interface ItemAnalyticsDashboardProps {
  dateRange: {
    from: Date
    to: Date
  }
}

export function ItemAnalyticsDashboard(_props: ItemAnalyticsDashboardProps) {
  const { itemData } = useAnalytics()

  if (!itemData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Menu Item Analytics</CardTitle>
          <CardDescription>No item data available for the selected period</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Top Selling Items</CardTitle>
            <CardDescription>Items with highest sales volume</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {itemData.topItems.slice(0, 5).map((item, _index) => (
                <div key={item.id} className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium leading-none">{item.name}</p>
                    <p className="text-sm text-muted-foreground">{item.category}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{item.quantitySold} sold</span>
                    {item.trend === "up" ? (
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                        <ArrowUpIcon className="mr-1 h-3 w-3" />
                        {item.percentageChange}%
                      </Badge>
                    ) : item.trend === "down" ? (
                      <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                        <ArrowDownIcon className="mr-1 h-3 w-3" />
                        {item.percentageChange}%
                      </Badge>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Worst Performing Items</CardTitle>
            <CardDescription>Items with lowest sales volume</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {itemData.worstPerformingItems.slice(0, 5).map((item, _index) => (
                <div key={item.id} className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium leading-none">{item.name}</p>
                    <p className="text-sm text-muted-foreground">{item.category}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{item.quantitySold} sold</span>
                    {item.trend === "up" ? (
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                        <ArrowUpIcon className="mr-1 h-3 w-3" />
                        {item.percentageChange}%
                      </Badge>
                    ) : item.trend === "down" ? (
                      <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                        <ArrowDownIcon className="mr-1 h-3 w-3" />
                        {item.percentageChange}%
                      </Badge>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Total Items Sold</CardTitle>
            <CardDescription>Quantity of items sold in period</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{itemData.totalItemsSold}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Across {itemData.topItems.length + itemData.worstPerformingItems.length} unique menu items
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Category Performance</CardTitle>
            <CardDescription>Sales distribution by menu category</CardDescription>
          </CardHeader>
          <CardContent className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={itemData.categoryPerformance} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="category" />
                <YAxis yAxisId="left" orientation="left" stroke="#4ade80" />
                <YAxis yAxisId="right" orientation="right" stroke="#f97316" />
                <Tooltip />
                <Legend />
                <Bar yAxisId="left" dataKey="revenue" name="Revenue ($)" fill="#4ade80" />
                <Bar yAxisId="right" dataKey="itemsSold" name="Items Sold" fill="#f97316" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Item Performance by Time</CardTitle>
            <CardDescription>Top selling items by hour of day</CardDescription>
          </CardHeader>
          <CardContent className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={itemData.itemPerformanceByTime} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="hour" label={{ value: "Hour of Day", position: "insideBottomRight", offset: -10 }} />
                <YAxis />
                <Tooltip
                  formatter={(value) => [value, "Quantity Sold"]}
                  labelFormatter={(label) => `Hour: ${label}:00`}
                />
                <Legend />
                <Line type="monotone" dataKey="quantitySold" stroke="#4ade80" activeDot={{ r: 8 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Detailed Item Performance</CardTitle>
          <CardDescription>Comprehensive view of all menu items</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Quantity Sold</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead className="text-right">% of Sales</TableHead>
                <TableHead className="text-right">Trend</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...itemData.topItems, ...itemData.worstPerformingItems]
                .sort((a, b) => b.quantitySold - a.quantitySold)
                .map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell>{item.category}</TableCell>
                    <TableCell className="text-right">{item.quantitySold}</TableCell>
                    <TableCell className="text-right">${item.revenue.toFixed(2)}</TableCell>
                    <TableCell className="text-right">{item.percentageOfSales.toFixed(2)}%</TableCell>
                    <TableCell className="text-right">
                      {item.trend === "up" ? (
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                          <ArrowUpIcon className="mr-1 h-3 w-3" />
                          {item.percentageChange}%
                        </Badge>
                      ) : item.trend === "down" ? (
                        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                          <ArrowDownIcon className="mr-1 h-3 w-3" />
                          {item.percentageChange}%
                        </Badge>
                      ) : (
                        <Badge variant="outline">Stable</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
