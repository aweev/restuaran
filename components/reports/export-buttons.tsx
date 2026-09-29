"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Download, FileSpreadsheet, FileIcon as FilePdf, Loader2 } from "lucide-react"
import { downloadCSV, exportToPDF } from "@/lib/export-utils"
import { useToast } from "@/hooks/use-toast"

interface ExportButtonsProps {
  onExportCSV: () => string
  fileName: string
  pdfElementId?: string
}

export function ExportButtons({ onExportCSV, fileName, pdfElementId }: ExportButtonsProps) {
  const [isExporting, setIsExporting] = useState(false)
  const { toast } = useToast()

  const handleExportCSV = () => {
    try {
      setIsExporting(true)
      const csvContent = onExportCSV()
      downloadCSV(csvContent, `${fileName}.csv`)

      toast({
        title: "Export Successful",
        description: `${fileName} has been exported as CSV`,
        duration: 3000,
      })
    } catch (error) {
      console.error("Error exporting CSV:", error)

      toast({
        title: "Export Failed",
        description: "There was an error exporting the data",
        variant: "destructive",
        duration: 5000,
      })
    } finally {
      setIsExporting(false)
    }
  }

  const handleExportPDF = async () => {
    if (!pdfElementId) return

    try {
      setIsExporting(true)
      await exportToPDF(pdfElementId, fileName)

      toast({
        title: "Export Successful",
        description: `${fileName} has been exported as PDF`,
        duration: 3000,
      })
    } catch (error) {
      console.error("Error exporting PDF:", error)

      toast({
        title: "Export Failed",
        description: "There was an error exporting the PDF",
        variant: "destructive",
        duration: 5000,
      })
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" disabled={isExporting}>
          {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={handleExportCSV}>
          <FileSpreadsheet className="mr-2 h-4 w-4" />
          Export as CSV
        </DropdownMenuItem>
        {pdfElementId && (
          <DropdownMenuItem onClick={handleExportPDF}>
            <FilePdf className="mr-2 h-4 w-4" />
            Export as PDF
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
