"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useAnalytics } from "@/context/AnalyticsContext"

interface CustomerAnalyticsDashboardProps {
  dateRange: {
    from: Date
    to: Date
  }
}

export function CustomerAnalyticsDashboard(_props: CustomerAnalyticsDashboardProps) {
  const { customerData } = useAnalytics()

  if (!customerData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Customer Analytics</CardTitle>
          <CardDescription>No customer data available for the selected period</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{customerData.totalCustomers}</div>
            <p className="text-xs text-muted-foreground">
              ${customerData.averageSpendPerCustomer.toFixed(2)} avg. spend
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">New Customers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{customerData.newCustomers}</div>
            <p className="text-xs text-muted-foreground">
              {((customerData.newCustomers / customerData.totalCustomers) * 100).toFixed(1)}% of total
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
