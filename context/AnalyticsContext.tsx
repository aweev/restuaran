"use client"

import type React from "react"
import { createContext, useContext, useMemo, useCallback } from "react"
import { format } from "date-fns"
import { jsPDF } from "jspdf"
import autoTable from "jspdf-autotable"
import { toast } from "@/components/ui/use-toast"
import type {
  SalesAnalytics,
  ItemAnalytics,
  StaffAnalytics,
  CustomerAnalytics,
  InventoryAnalytics,
} from "@/types/analytics"
import { useProjection } from "@/kernel/react/kernel-provider"
import type { SalesBoardState } from "@/kernel/projections/sales-board"
import type { OrderBoardState } from "@/kernel/projections/orders-board"
import type { StaffBoardState } from "@/kernel/projections/staff-board"
import type { InventoryBoardState } from "@/kernel/projections/builtins"
import type { CustomersBoardState } from "@/kernel/modules/customers.module"

interface AnalyticsContextType {
  salesData: SalesAnalytics | null
  itemData: ItemAnalytics | null
  staffData: StaffAnalytics | null
  customerData: CustomerAnalytics | null
  inventoryData: InventoryAnalytics | null
  isLoading: boolean
  error: string | null
  fetchAnalyticsData: (startDate?: Date, endDate?: Date) => Promise<void>
  exportReportToCsv: (reportType: string, startDate: Date, endDate: Date, fileName: string) => void
  exportReportToPdf: (reportType: string, startDate: Date, endDate: Date, fileName: string) => void
}

const AnalyticsContext = createContext<AnalyticsContextType | undefined>(undefined)

const round2 = (n: number): number => Math.round(n * 100) / 100

export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  // Subscribe to all five boards via the kernel. Each projection derives from
  // the same event log that the rest of the system trusts, so reports can
  // never disagree with the till or the floor.
  const { state: salesBoard, error: salesErr } = useProjection<SalesBoardState>("sales.board")
  const { state: ordersBoard, error: ordersErr } = useProjection<OrderBoardState>("orders.board")
  const { state: staffBoard, error: staffErr } = useProjection<StaffBoardState>("staff.board")
  const { state: customersBoard, error: customersErr } = useProjection<CustomersBoardState>("customers.board")
  const { state: inventoryBoard, error: inventoryErr } = useProjection<InventoryBoardState>("inventory.board")

  const error = salesErr ?? ordersErr ?? staffErr ?? customersErr ?? inventoryErr
  const isLoading = [salesBoard, ordersBoard, staffBoard, customersBoard, inventoryBoard].some(
    (s) => s === null,
  )

  // --- Sales ---
  const salesData = useMemo<SalesAnalytics | null>(() => {
    if (!salesBoard) return null
    const buckets = salesBoard.buckets ?? []
    const totalSales = buckets.reduce((s, b) => s + b.grossSales, 0)
    const totalOrders = buckets.reduce((s, b) => s + b.orderCount, 0)
    const dailySales = buckets.map((b) => ({
      date: b.date,
      totalSales: round2(b.grossSales),
      orderCount: b.orderCount,
      averageOrderValue: b.orderCount > 0 ? round2(b.grossSales / b.orderCount) : 0,
      taxCollected: round2(b.tax),
    }))
    return {
      totalSales: round2(totalSales),
      totalOrders,
      averageOrderValue: totalOrders > 0 ? round2(totalSales / totalOrders) : 0,
      dailySales,
      weeklySales: [],
      monthlySales: [],
      categorySales: [],
      paymentMethods: [],
      hourlySales: [],
      comparisonToPrevious: { percentage: 0, trend: "stable" },
    } as SalesAnalytics
  }, [salesBoard])

  // --- Items — derived from orders.board which carries line-level data ---
  const itemData = useMemo<ItemAnalytics | null>(() => {
    if (!ordersBoard) return null
    const rows = ordersBoard.rows ?? []
    const itemMap = new Map<string, { name: string; quantity: number; revenue: number }>()
    for (const row of rows) {
      for (const line of row.lines) {
        const existing = itemMap.get(line.menuItemId)
        if (existing) {
          existing.quantity += line.quantity
          existing.revenue = round2(existing.revenue + line.lineTotal)
        } else {
          itemMap.set(line.menuItemId, {
            name: line.name,
            quantity: line.quantity,
            revenue: line.lineTotal,
          })
        }
      }
    }
    const totalRevenue = Array.from(itemMap.values()).reduce((s, v) => s + v.revenue, 0)
    const topItems = Array.from(itemMap.entries()).map(([id, v]) => ({
      id,
      name: v.name,
      quantitySold: v.quantity,
      revenue: round2(v.revenue),
      percentageOfSales: totalRevenue > 0 ? round2((v.revenue / totalRevenue) * 100) : 0,
      category: "",
      trend: "stable" as const,
      percentageChange: 0,
    }))
    topItems.sort((a, b) => b.quantitySold - a.quantitySold)
    return {
      topItems,
      worstPerformingItems: topItems.slice(-5).reverse(),
      categoryPerformance: [],
      itemPerformanceByTime: [],
      totalItemsSold: topItems.reduce((s, i) => s + i.quantitySold, 0),
    } as ItemAnalytics
  }, [ordersBoard])

  // --- Staff ---
  const staffData = useMemo<StaffAnalytics | null>(() => {
    if (!staffBoard) return null
    const rows = staffBoard.rows ?? []
    return {
      staffPerformance: rows.map((r) => ({
        id: r.staffId,
        name: r.name,
        role: r.position,
        ordersProcessed: 0,
        totalSales: 0,
        averageOrderValue: 0,
        tips: 0,
        averageOrderTime: 0,
        tablesServed: 0,
      })),
      topPerformers: [],
      staffPerformanceByDay: [],
      averageOrderProcessingTime: 0,
      totalTips: 0,
      averageTipsPerStaff: 0,
    } as StaffAnalytics
  }, [staffBoard])

  // --- Customers ---
  const customerData = useMemo<CustomerAnalytics | null>(() => {
    if (!customersBoard) return null
    const rows = customersBoard.rows ?? []
    const totals = customersBoard.totals ?? { members: 0, lifetimeSpend: 0 }
    const topCustomers = rows.map((r) => ({
      id: r.customerId,
      name: r.displayName,
      visitCount: r.visitCount,
      totalSpent: round2(r.lifetimeSpend),
      averageSpend: r.visitCount > 0 ? round2(r.lifetimeSpend / r.visitCount) : 0,
      lastVisit: r.lastVisitAt ?? "",
      favoriteItems: [],
    }))
    topCustomers.sort((a, b) => b.totalSpent - a.totalSpent)
    const totalCustomers = totals.members ?? rows.length
    const totalSpend = rows.reduce((s, r) => s + r.lifetimeSpend, 0)
    return {
      totalCustomers,
      newCustomers: 0,
      returningCustomers: 0,
      averageSpendPerCustomer: totalCustomers > 0 ? round2(totalSpend / totalCustomers) : 0,
      topCustomers,
      visitPatterns: [],
      retentionData: [],
    } as CustomerAnalytics
  }, [customersBoard])

  // --- Inventory ---
  const inventoryData = useMemo<InventoryAnalytics | null>(() => {
    if (!inventoryBoard) return null
    const rows = inventoryBoard.rows ?? []
    const inventoryItems = rows.map((r) => ({
      id: r.itemId,
      name: r.name,
      startingStock: r.onHand,
      currentStock: r.available,
      used: 0,
      wastage: 0,
      cost: round2(r.unitCost),
      reorderPoint: r.reorderPoint,
      needsReorder: r.available <= r.reorderPoint,
    }))
    const totalInventoryValue = inventoryItems.reduce((s, i) => s + i.cost * i.currentStock, 0)
    return {
      inventoryItems,
      totalInventoryValue: round2(totalInventoryValue),
      totalUsage: 0,
      totalWastage: 0,
      wastagePercentage: 0,
      usageByDay: [],
      itemsNeedingReorder: inventoryItems.filter((i) => i.needsReorder),
    } as InventoryAnalytics
  }, [inventoryBoard])

  const fetchAnalyticsData = useCallback(async () => {
    // Projections are subscribed reactively; this no-op is kept for API
    // compatibility with consumers that call fetchAnalyticsData on demand.
  }, [])

  const exportReportToCsv = useCallback(
    (reportType: string, startDate: Date, endDate: Date, fileName: string) => {
      try {
        let csvContent = "data:text/csv;charset=utf-8,"
        let data: (string | number)[][] = []
        let headers: string[] = []

        switch (reportType) {
          case "sales":
            if (!salesData) throw new Error("No sales data available")
            headers = ["Date", "Total Sales", "Order Count", "Average Order Value"]
            data = salesData.dailySales.map((day) => [
              day.date,
              day.totalSales.toFixed(2),
              day.orderCount,
              day.averageOrderValue.toFixed(2),
            ])
            break

          case "items":
            if (!itemData) throw new Error("No item data available")
            headers = ["Item Name", "Quantity Sold", "Revenue", "Percentage of Sales"]
            data = itemData.topItems.map((item) => [
              item.name,
              item.quantitySold,
              item.revenue.toFixed(2),
              `${item.percentageOfSales.toFixed(2)}%`,
            ])
            break

          case "staff":
            if (!staffData) throw new Error("No staff data available")
            headers = ["Staff Name", "Orders Processed", "Total Sales", "Average Order Value", "Tips"]
            data = staffData.staffPerformance.map((staff) => [
              staff.name,
              staff.ordersProcessed,
              staff.totalSales.toFixed(2),
              staff.averageOrderValue.toFixed(2),
              staff.tips.toFixed(2),
            ])
            break

          case "customers":
            if (!customerData) throw new Error("No customer data available")
            headers = ["Customer", "Visit Count", "Total Spent", "Average Spend", "Last Visit"]
            data = customerData.topCustomers.map((customer) => [
              customer.name,
              customer.visitCount,
              customer.totalSpent.toFixed(2),
              customer.averageSpend.toFixed(2),
              customer.lastVisit,
            ])
            break

          case "inventory":
            if (!inventoryData) throw new Error("No inventory data available")
            headers = ["Item", "Starting Stock", "Current Stock", "Used", "Wastage", "Cost"]
            data = inventoryData.inventoryItems.map((item) => [
              item.name,
              item.startingStock,
              item.currentStock,
              item.used,
              item.wastage,
              item.cost.toFixed(2),
            ])
            break

          default:
            throw new Error("Invalid report type")
        }

        csvContent += headers.join(",") + "\n"
        data.forEach((row) => {
          csvContent += row.join(",") + "\n"
        })

        const encodedUri = encodeURI(csvContent)
        const link = document.createElement("a")
        link.setAttribute("href", encodedUri)
        link.setAttribute("download", `${fileName}.csv`)
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)

        toast({
          title: "Export Successful",
          description: `${reportType} report has been exported as CSV`,
        })
      } catch (err) {
        toast({
          title: "Export Failed",
          description: err instanceof Error ? err.message : "Failed to export report",
          variant: "destructive",
        })
      }
    },
    [salesData, itemData, staffData, customerData, inventoryData],
  )

  const exportReportToPdf = useCallback(
    (reportType: string, startDate: Date, endDate: Date, fileName: string) => {
      try {
        const doc = new jsPDF()
        let title = ""
        let data: (string | number)[][] = []
        let headers: string[] = []

        switch (reportType) {
          case "sales":
            if (!salesData) throw new Error("No sales data available")
            title = "Sales Report"
            headers = ["Date", "Total Sales", "Orders", "Avg Order"]
            data = salesData.dailySales.map((day) => [
              day.date,
              `$${day.totalSales.toFixed(2)}`,
              day.orderCount,
              `$${day.averageOrderValue.toFixed(2)}`,
            ])
            break

          case "items":
            if (!itemData) throw new Error("No item data available")
            title = "Menu Item Performance Report"
            headers = ["Item Name", "Qty Sold", "Revenue", "% of Sales"]
            data = itemData.topItems.map((item) => [
              item.name,
              item.quantitySold,
              `$${item.revenue.toFixed(2)}`,
              `${item.percentageOfSales.toFixed(2)}%`,
            ])
            break

          case "staff":
            if (!staffData) throw new Error("No staff data available")
            title = "Staff Performance Report"
            headers = ["Staff Name", "Orders", "Sales", "Avg Order", "Tips"]
            data = staffData.staffPerformance.map((staff) => [
              staff.name,
              staff.ordersProcessed,
              `$${staff.totalSales.toFixed(2)}`,
              `$${staff.averageOrderValue.toFixed(2)}`,
              `$${staff.tips.toFixed(2)}`,
            ])
            break

          case "customers":
            if (!customerData) throw new Error("No customer data available")
            title = "Customer Analytics Report"
            headers = ["Customer", "Visits", "Total Spent", "Avg Spend", "Last Visit"]
            data = customerData.topCustomers.map((customer) => [
              customer.name,
              customer.visitCount,
              `$${customer.totalSpent.toFixed(2)}`,
              `$${customer.averageSpend.toFixed(2)}`,
              customer.lastVisit,
            ])
            break

          case "inventory":
            if (!inventoryData) throw new Error("No inventory data available")
            title = "Inventory Usage Report"
            headers = ["Item", "Starting", "Current", "Used", "Wastage", "Cost"]
            data = inventoryData.inventoryItems.map((item) => [
              item.name,
              item.startingStock,
              item.currentStock,
              item.used,
              item.wastage,
              `$${item.cost.toFixed(2)}`,
            ])
            break

          default:
            throw new Error("Invalid report type")
        }

        doc.setFontSize(18)
        doc.text(title, 14, 22)
        doc.setFontSize(12)
        doc.text(`Period: ${format(startDate, "MMM d, yyyy")} - ${format(endDate, "MMM d, yyyy")}`, 14, 32)

        autoTable(doc, {
          head: [headers],
          body: data,
          startY: 40,
          styles: { fontSize: 10 },
          headStyles: { fillColor: [76, 175, 80] },
        })

        doc.save(`${fileName}.pdf`)

        toast({
          title: "Export Successful",
          description: `${reportType} report has been exported as PDF`,
        })
      } catch (err) {
        toast({
          title: "Export Failed",
          description: err instanceof Error ? err.message : "Failed to export report",
          variant: "destructive",
        })
      }
    },
    [salesData, itemData, staffData, customerData, inventoryData],
  )

  const value = useMemo<AnalyticsContextType>(
    () => ({
      salesData,
      itemData,
      staffData,
      customerData,
      inventoryData,
      isLoading,
      error,
      fetchAnalyticsData,
      exportReportToCsv,
      exportReportToPdf,
    }),
    [salesData, itemData, staffData, customerData, inventoryData, isLoading, error, fetchAnalyticsData, exportReportToCsv, exportReportToPdf],
  )

  return <AnalyticsContext.Provider value={value}>{children}</AnalyticsContext.Provider>
}

export const useAnalytics = () => {
  const context = useContext(AnalyticsContext)
  if (context === undefined) {
    throw new Error("useAnalytics must be used within an AnalyticsProvider")
  }
  return context
}
