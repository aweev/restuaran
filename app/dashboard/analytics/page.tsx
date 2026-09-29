"use client"

import { useState, useEffect } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DateRangePicker } from "@/components/date-range-picker"
import { subDays, startOfMonth, endOfMonth, startOfWeek, endOfWeek, format } from "date-fns"
import { Loader2 } from "lucide-react"
import { SalesOverviewDashboard } from "@/components/analytics/sales-overview-dashboard"
import { ItemAnalyticsDashboard } from "@/components/analytics/item-analytics-dashboard"
import { StaffPerformanceDashboard } from "@/components/analytics/staff-performance-dashboard"
import { CustomerAnalyticsDashboard } from "@/components/analytics/customer-analytics-dashboard"
import { InventoryAnalyticsDashboard } from "@/components/analytics/inventory-analytics-dashboard"
import { AnalyticsHeader } from "@/components/analytics/analytics-header"
import { useAnalytics } from "@/context/AnalyticsContext"
import { Button } from "@/components/ui/button"
import { Calendar, ChevronDown, Download, BarChart3, ShoppingBag, Users, UserCircle, Package } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

export default function AnalyticsDashboard() {
  const [activeTab, setActiveTab] = useState("sales")
  const [dateRange, setDateRange] = useState({
    from: subDays(new Date(), 30),
    to: new Date(),
  })
  const [dateRangePreset, setDateRangePreset] = useState("last30")
  const { fetchAnalyticsData, isLoading, exportReportToCsv, exportReportToPdf } = useAnalytics()

  useEffect(() => {
    fetchAnalyticsData(dateRange.from, dateRange.to)
  }, [dateRange, fetchAnalyticsData])

  const handleDateRangePreset = (preset: string) => {
    setDateRangePreset(preset)
    const now = new Date()

    switch (preset) {
      case "today":
        setDateRange({ from: now, to: now })
        break
      case "yesterday":
        const yesterday = subDays(now, 1)
        setDateRange({ from: yesterday, to: yesterday })
        break
      case "last7":
        setDateRange({ from: subDays(now, 7), to: now })
        break
      case "last30":
        setDateRange({ from: subDays(now, 30), to: now })
        break
      case "thisWeek":
        setDateRange({ from: startOfWeek(now), to: endOfWeek(now) })
        break
      case "thisMonth":
        setDateRange({ from: startOfMonth(now), to: endOfMonth(now) })
        break
      default:
        break
    }
  }

  const handleExport = (exportFormat: "csv" | "pdf") => {
    const reportType = activeTab
    const fileName = `${reportType}-report-${format(dateRange.from, "yyyy-MM-dd")}-to-${format(dateRange.to, "yyyy-MM-dd")}`

    if (exportFormat === "csv") {
      exportReportToCsv(reportType, dateRange.from, dateRange.to, fileName)
    } else {
      exportReportToPdf(reportType, dateRange.from, dateRange.to, fileName)
    }
  }

  const tabIcons = {
    sales: <BarChart3 className="h-4 w-4 mr-2" />,
    items: <ShoppingBag className="h-4 w-4 mr-2" />,
    staff: <Users className="h-4 w-4 mr-2" />,
    customers: <UserCircle className="h-4 w-4 mr-2" />,
    inventory: <Package className="h-4 w-4 mr-2" />,
  }

  return (
    <div className="space-y-4">
      <AnalyticsHeader
        title="Analytics & Reporting"
        description="Comprehensive insights into your restaurant's performance"
      />

      <div className="flex flex-col md:flex-row justify-between gap-4 items-start md:items-center">
        <div className="flex flex-wrap gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                {dateRangePreset === "custom"
                  ? "Custom Range"
                  : dateRangePreset === "today"
                    ? "Today"
                    : dateRangePreset === "yesterday"
                      ? "Yesterday"
                      : dateRangePreset === "last7"
                        ? "Last 7 Days"
                        : dateRangePreset === "last30"
                          ? "Last 30 Days"
                          : dateRangePreset === "thisWeek"
                            ? "This Week"
                            : "This Month"}
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={() => handleDateRangePreset("today")}>Today</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleDateRangePreset("yesterday")}>Yesterday</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleDateRangePreset("last7")}>Last 7 Days</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleDateRangePreset("last30")}>Last 30 Days</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleDateRangePreset("thisWeek")}>This Week</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleDateRangePreset("thisMonth")}>This Month</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DateRangePicker
            date={dateRange}
            onDateChange={(newRange) => {
              if (!newRange?.from || !newRange.to) return
              setDateRange({ from: newRange.from, to: newRange.to })
              setDateRangePreset("custom")
            }}
          />
        </div>

        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="flex items-center gap-2">
                <Download className="h-4 w-4" />
                Export
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleExport("csv")}>Export as CSV</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport("pdf")}>Export as PDF</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid grid-cols-2 md:grid-cols-5 gap-2">
          <TabsTrigger value="sales" className="flex items-center">
            {tabIcons.sales} Sales
          </TabsTrigger>
          <TabsTrigger value="items" className="flex items-center">
            {tabIcons.items} Menu Items
          </TabsTrigger>
          <TabsTrigger value="staff" className="flex items-center">
            {tabIcons.staff} Staff
          </TabsTrigger>
          <TabsTrigger value="customers" className="flex items-center">
            {tabIcons.customers} Customers
          </TabsTrigger>
          <TabsTrigger value="inventory" className="flex items-center">
            {tabIcons.inventory} Inventory
          </TabsTrigger>
        </TabsList>

        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <TabsContent value="sales" className="space-y-4">
              <SalesOverviewDashboard dateRange={dateRange} />
            </TabsContent>

            <TabsContent value="items" className="space-y-4">
              <ItemAnalyticsDashboard dateRange={dateRange} />
            </TabsContent>

            <TabsContent value="staff" className="space-y-4">
              <StaffPerformanceDashboard dateRange={dateRange} />
            </TabsContent>

            <TabsContent value="customers" className="space-y-4">
              <CustomerAnalyticsDashboard dateRange={dateRange} />
            </TabsContent>

            <TabsContent value="inventory" className="space-y-4">
              <InventoryAnalyticsDashboard dateRange={dateRange} />
            </TabsContent>
          </>
        )}
      </Tabs>
    </div>
  )
}
