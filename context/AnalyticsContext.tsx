"use client"

import type React from "react"
import { createContext, useContext, useState, useCallback } from "react"
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

interface AnalyticsContextType {
  salesData: SalesAnalytics | null
  itemData: ItemAnalytics | null
  staffData: StaffAnalytics | null
  customerData: CustomerAnalytics | null
  inventoryData: InventoryAnalytics | null
  isLoading: boolean
  error: string | null
  fetchAnalyticsData: (startDate: Date, endDate: Date) => Promise<void>
  exportReportToCsv: (reportType: string, startDate: Date, endDate: Date, fileName: string) => void
  exportReportToPdf: (reportType: string, startDate: Date, endDate: Date, fileName: string) => void
}

const AnalyticsContext = createContext<AnalyticsContextType | undefined>(undefined)

export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  const [salesData, setSalesData] = useState<SalesAnalytics | null>(null)
  const [itemData, setItemData] = useState<ItemAnalytics | null>(null)
  const [staffData, setStaffData] = useState<StaffAnalytics | null>(null)
  const [customerData, setCustomerData] = useState<CustomerAnalytics | null>(null)
  const [inventoryData, setInventoryData] = useState<InventoryAnalytics | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchAnalyticsData = useCallback(async (startDate: Date, endDate: Date) => {
    setIsLoading(true)
    setError(null)

    try {
      const formattedStartDate = format(startDate, "yyyy-MM-dd")
      const formattedEndDate = format(endDate, "yyyy-MM-dd")

      // Fetch sales analytics
      const salesResponse = await fetch(
        `/api/analytics/sales?startDate=${formattedStartDate}&endDate=${formattedEndDate}`,
      )
      if (!salesResponse.ok) throw new Error("Failed to fetch sales data")
      const salesResult = await salesResponse.json()
      setSalesData(salesResult)

      // Fetch item analytics
      const itemsResponse = await fetch(
        `/api/analytics/items?startDate=${formattedStartDate}&endDate=${formattedEndDate}`,
      )
      if (!itemsResponse.ok) throw new Error("Failed to fetch item data")
      const itemsResult = await itemsResponse.json()
      setItemData(itemsResult)

      // Fetch staff analytics
      const staffResponse = await fetch(
        `/api/analytics/staff?startDate=${formattedStartDate}&endDate=${formattedEndDate}`,
      )
      if (!staffResponse.ok) throw new Error("Failed to fetch staff data")
      const staffResult = await staffResponse.json()
      setStaffData(staffResult)

      // Fetch customer analytics
      const customerResponse = await fetch(
        `/api/analytics/customers?startDate=${formattedStartDate}&endDate=${formattedEndDate}`,
      )
      if (!customerResponse.ok) throw new Error("Failed to fetch customer data")
      const customerResult = await customerResponse.json()
      setCustomerData(customerResult)

      // Fetch inventory analytics
      const inventoryResponse = await fetch(
        `/api/analytics/inventory?startDate=${formattedStartDate}&endDate=${formattedEndDate}`,
      )
      if (!inventoryResponse.ok) throw new Error("Failed to fetch inventory data")
      const inventoryResult = await inventoryResponse.json()
      setInventoryData(inventoryResult)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unknown error occurred")
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to load analytics data",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }, [])

  const exportReportToCsv = useCallback(
    (reportType: string, startDate: Date, endDate: Date, fileName: string) => {
      try {
        let csvContent = "data:text/csv;charset=utf-8,"
        // Report rows: a flat, printable tuple per line.
        let data: (string | number)[][] = []
        let headers: string[] = []

        // Prepare data based on report type
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

        // Add headers
        csvContent += headers.join(",") + "\n"

        // Add data rows
        data.forEach((row) => {
          csvContent += row.join(",") + "\n"
        })

        // Create download link
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
        // Report rows: a flat, printable tuple per line.
        let data: (string | number)[][] = []
        let headers: string[] = []

        // Prepare data based on report type
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

        // Add title and date range
        doc.setFontSize(18)
        doc.text(title, 14, 22)
        doc.setFontSize(12)
        doc.text(`Period: ${format(startDate, "MMM d, yyyy")} - ${format(endDate, "MMM d, yyyy")}`, 14, 32)

        // Add table
        autoTable(doc, {
          head: [headers],
          body: data,
          startY: 40,
          styles: { fontSize: 10 },
          headStyles: { fillColor: [76, 175, 80] },
        })

        // Save PDF
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

  const value = {
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
  }

  return <AnalyticsContext.Provider value={value}>{children}</AnalyticsContext.Provider>
}

export const useAnalytics = () => {
  const context = useContext(AnalyticsContext)
  if (context === undefined) {
    throw new Error("useAnalytics must be used within an AnalyticsProvider")
  }
  return context
}
