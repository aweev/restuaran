import type { Order } from "@/types"
import type { Ingredient } from "@/types/inventory"
import { format } from "date-fns"

// Helper function to convert data to CSV
export function convertToCSV<T extends object>(
  data: T[],
  headers: Record<keyof T, string>,
  dateFields: (keyof T)[] = [],
): string {
  // Create header row
  const headerRow = Object.values(headers).join(",")

  // Create data rows
  const rows = data.map((item) => {
    // `headers` keys are `keyof T`, but `Object.keys` widens them to `string`.
    const keys = Object.keys(headers) as (keyof T)[]
    return keys
      .map((key) => {
        const value = item[key]

        // Format date fields
        if (dateFields.includes(key) && value) {
          return `"${format(new Date(value as string | number | Date), "yyyy-MM-dd HH:mm:ss")}"`
        }

        // Handle arrays and objects
        if (typeof value === "object" && value !== null) {
          return `"${JSON.stringify(value).replace(/"/g, '""')}"`
        }

        // Handle strings with commas
        if (typeof value === "string" && value.includes(",")) {
          return `"${value.replace(/"/g, '""')}"`
        }

        return value === null || value === undefined ? "" : value
      })
      .join(",")
  })

  return [headerRow, ...rows].join("\n")
}

// Export orders to CSV
export function exportOrdersToCSV(orders: Order[]): string {
  const headers = {
    id: "Order ID",
    createdAt: "Date",
    customerName: "Customer",
    diningMode: "Dining Mode",
    tableId: "Table ID",
    subtotal: "Subtotal",
    tax: "Tax",
    discount: "Discount",
    total: "Total",
    status: "Status",
    isPaid: "Is Paid",
  }

  const dateFields: (keyof Order)[] = ["createdAt", "updatedAt"]

  return convertToCSV(orders, headers as unknown as Record<keyof Order, string>, dateFields as (keyof Order)[])
}

// Export inventory to CSV
export function exportInventoryToCSV(ingredients: Ingredient[]): string {
  const headers = {
    id: "ID",
    name: "Name",
    category: "Category",
    unit: "Unit",
    currentStock: "Current Stock",
    reorderLevel: "Reorder Level",
    unitCost: "Unit Cost",
    usageLastMonth: "Usage Last Month",
    isActive: "Active",
    lastUpdated: "Last Updated",
  }

  const dateFields: (keyof Ingredient)[] = ["lastUpdated"]

  return convertToCSV(ingredients, headers, dateFields)
}

// Download CSV file
export function downloadCSV(csvContent: string, fileName: string): void {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.setAttribute("href", url)
  link.setAttribute("download", fileName)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

// Export data to PDF (client-side)
export async function exportToPDF(
  elementId: string,
  fileName: string,
  options = {
    margin: { top: 20, right: 20, bottom: 20, left: 20 },
    format: "a4" as const,
  },
): Promise<void> {
  try {
    // Dynamically import jspdf and html2canvas
    const [jsPDF, html2canvas] = await Promise.all([import("jspdf"), import("html2canvas")])

    const element = document.getElementById(elementId)
    if (!element) throw new Error(`Element with ID ${elementId} not found`)

    const canvas = await html2canvas.default(element, {
      scale: 2,
      logging: false,
      useCORS: true,
    })

    const pdf = new jsPDF.default(options)

    const imgData = canvas.toDataURL("image/png")
    const imgProps = pdf.getImageProperties(imgData)
    const pdfWidth = pdf.internal.pageSize.getWidth()
    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width

    pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight)
    pdf.save(`${fileName}.pdf`)

    return Promise.resolve()
  } catch (error) {
    console.error("Error exporting to PDF:", error)
    return Promise.reject(error)
  }
}
