"use client"

import { useState } from "react"
import { useTable } from "@/context/TableContext"
import { useOrder } from "@/context/OrderContext"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { toast } from "@/components/ui/use-toast"
import { Loader2 } from "lucide-react"
import type { Table } from "@/types"

interface TableTransferDialogProps {
  table: Table | null
  tables: Table[]
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function TableTransferDialog({ table, tables, open, onOpenChange }: TableTransferDialogProps) {
  const { clearTable, occupyTable } = useTable()
  const { transferOrderTable } = useOrder()
  const [selectedTableId, setSelectedTableId] = useState<string>("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Filter tables to only show available tables
  const availableTables = tables.filter((t) => t.status === "available")

  const handleTransfer = async () => {
    if (!table || !selectedTableId) return

    setIsSubmitting(true)

    try {
      // Get the target table
      const targetTable = tables.find((t) => t.id === selectedTableId)
      if (!targetTable) throw new Error("Target table not found")

      // Get active orders for the current table
      const activeOrders = await transferOrderTable(table.id, targetTable)

      // Update the target table status
      await occupyTable(
        selectedTableId,
        table.customerName || "Customer",
        table.customerCount || 1,
        table.serverName || "Server",
      )

      // Clear the original table
      await clearTable(table.id)

      onOpenChange(false)

      toast({
        title: "Table transferred",
        description: `Table ${table.number} has been transferred to Table ${targetTable.number} with ${activeOrders} orders.`,
      })
    } catch (error) {
      console.error("Error transferring table:", error)
      toast({
        title: "Error",
        description: "Failed to transfer table.",
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
          <DialogTitle>Transfer Table {table.number}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <p>
            Transfer {table.customerName || "Customer"}&apos;s party of {table.customerCount || "?"}
            from Table {table.number} to another table:
          </p>

          {availableTables.length === 0 ? (
            <div className="rounded-md bg-yellow-50 p-4 text-yellow-800">
              No available tables to transfer to. Please clear a table first.
            </div>
          ) : (
            <RadioGroup value={selectedTableId} onValueChange={setSelectedTableId}>
              <div className="space-y-2">
                {availableTables.map((t) => (
                  <div key={t.id} className="flex items-center space-x-2">
                    <RadioGroupItem value={t.id} id={`table-${t.id}`} />
                    <Label htmlFor={`table-${t.id}`} className="flex-1">
                      Table {t.number} (Capacity: {t.capacity})
                    </Label>
                  </div>
                ))}
              </div>
            </RadioGroup>
          )}

          <div className="pt-4 text-sm text-muted-foreground">
            <p>
              This will transfer all active orders and customer information to the new table. The current table will be
              marked as needing cleaning.
            </p>
          </div>
        </div>

        <div className="flex justify-end space-x-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleTransfer} disabled={isSubmitting || !selectedTableId || availableTables.length === 0}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Transferring...
              </>
            ) : (
              "Transfer Table"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
