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
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"

interface StaffPerformanceDashboardProps {
  dateRange: {
    from: Date
    to: Date
  }
}

export function StaffPerformanceDashboard(_props: StaffPerformanceDashboardProps) {
  const { staffData } = useAnalytics()

  if (!staffData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Staff Performance</CardTitle>
          <CardDescription>No staff data available for the selected period</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Top Performer</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <Avatar className="h-10 w-10">
                <AvatarFallback>{staffData.topPerformers[0]?.name.charAt(0) || "?"}</AvatarFallback>
              </Avatar>
              <div>
                <div className="text-xl font-bold">{staffData.topPerformers[0]?.name || "N/A"}</div>
                <p className="text-xs text-muted-foreground">
                  ${staffData.topPerformers[0]?.totalSales.toFixed(2) || "0"} in sales
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Order Time</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{staffData.averageOrderProcessingTime.toFixed(1)} min</div>
            <p className="text-xs text-muted-foreground">Average time to complete an order</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tips</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${staffData.totalTips.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Avg. ${staffData.averageTipsPerStaff.toFixed(2)} per staff</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Staff Count</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{staffData.staffPerformance.length}</div>
            <p className="text-xs text-muted-foreground">Active staff in period</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Staff Sales Performance</CardTitle>
            <CardDescription>Total sales by staff member</CardDescription>
          </CardHeader>
          <CardContent className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={staffData.staffPerformance}
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                layout="vertical"
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis type="category" dataKey="name" width={100} />
                <Tooltip formatter={(value) => `$${Number(value).toFixed(2)}`} />
                <Legend />
                <Bar dataKey="totalSales" name="Total Sales" fill="#4ade80" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Staff Performance by Day</CardTitle>
            <CardDescription>Sales trends over time by staff</CardDescription>
          </CardHeader>
          <CardContent className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={staffData.staffPerformanceByDay} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" />
                <YAxis />
                <Tooltip formatter={(value) => `$${Number(value).toFixed(2)}`} />
                <Legend />
                <Line type="monotone" dataKey="sales" name="Sales" stroke="#4ade80" activeDot={{ r: 8 }} />
                <Line type="monotone" dataKey="orders" name="Orders" stroke="#f97316" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Detailed Staff Performance</CardTitle>
          <CardDescription>Comprehensive view of all staff metrics</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Staff</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="text-right">Orders</TableHead>
                <TableHead className="text-right">Sales</TableHead>
                <TableHead className="text-right">Avg. Order</TableHead>
                <TableHead className="text-right">Tips</TableHead>
                <TableHead className="text-right">Avg. Time</TableHead>
                <TableHead className="text-right">Tables</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {staffData.staffPerformance.map((staff) => (
                <TableRow key={staff.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center space-x-2">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback>{staff.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <span>{staff.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{staff.role}</Badge>
                  </TableCell>
                  <TableCell className="text-right">{staff.ordersProcessed}</TableCell>
                  <TableCell className="text-right">${staff.totalSales.toFixed(2)}</TableCell>
                  <TableCell className="text-right">${staff.averageOrderValue.toFixed(2)}</TableCell>
                  <TableCell className="text-right">${staff.tips.toFixed(2)}</TableCell>
                  <TableCell className="text-right">{staff.averageOrderTime.toFixed(1)} min</TableCell>
                  <TableCell className="text-right">{staff.tablesServed}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
