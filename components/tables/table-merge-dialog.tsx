"use client"

import { useState } from "react"
import { useTable } from "@/context/TableContext"
import { useOrder } from "@/context/OrderContext"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { toast } from "@/components/ui/use-toast"
import { Loader2 } from "lucide-react"
import type { Table } from "@/types"

interface TableMergeDialogProps {
  table: Table | null
  tables: Table[]
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function TableMergeDialog({ table, tables, open, onOpenChange }: TableMergeDialogProps) {
  const { clearTable } = useTable()
  const { mergeOrders } = useOrder()
  const [selectedTableIds, setSelectedTableIds] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Filter tables to only show occupied tables
  const occupiedTables = tables.filter((t) => t.status === "occupied")

  const handleCheckboxChange = (tableId: string) => {
    setSelectedTableIds((prev) => (prev.includes(tableId) ? prev.filter((id) => id !== tableId) : [...prev, tableId]))
  }

  const handleMerge = async () => {
    if (!table || selectedTableIds.length === 0) return

    setIsSubmitting(true)

    try {
      // Merge orders from selected tables to the current table
      const mergedCount = await mergeOrders(table, selectedTableIds)

      // Clear the merged tables
      for (const tableId of selectedTableIds) {
        await clearTable(tableId)
      }

      onOpenChange(false)
      setSelectedTableIds([])

      toast({
        title: "Tables merged",
        description: `${selectedTableIds.length} tables have been merged with Table ${table.number}. ${mergedCount} orders combined.`,
      })
    } catch (error) {
      console.error("Error merging tables:", error)
      toast({
        title: "Error",
        description: "Failed to merge tables.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!table) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Merge Tables with Table {table.number}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <p>Select tables to merge with Table {table.number}:</p>

          {occupiedTables.length === 0 ? (
            <div className="rounded-md bg-yellow-50 p-4 text-yellow-800">
              No other occupied tables available to merge.
            </div>
          ) : (
            <div className="space-y-2">
              {occupiedTables.map((t) => (
                <div key={t.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`table-${t.id}`}
                    checked={selectedTableIds.includes(t.id)}
                    onCheckedChange={() => handleCheckboxChange(t.id)}
                  />
                  <Label htmlFor={`table-${t.id}`} className="flex-1">
                    Table {t.number} - {t.customerName || "Customer"} ({t.customerCount || "?"} guests)
                  </Label>
                </div>
              ))}
            </div>
          )}

          <div className="pt-4 text-sm text-muted-foreground">
            <p>
              This will combine all orders from the selected tables with Table {table.number}. The selected tables will
              be marked as needing cleaning.
            </p>
          </div>
        </div>

        <div className="flex justify-end space-x-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleMerge}
            disabled={isSubmitting || selectedTableIds.length === 0 || occupiedTables.length === 0}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Merging...
              </>
            ) : (
              "Merge Tables"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
