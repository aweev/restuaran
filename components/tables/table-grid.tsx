"use client"

import { useState } from "react"
import type { Table } from "@/types"
import { useTable } from "@/context/TableContext"
import { Button } from "@/components/ui/button"
import { TableCard } from "@/components/tables/table-card"
import { TableDetailsDialog } from "@/components/tables/table-details-dialog"

interface TableGridProps {
  tables: Table[]
}

export function TableGrid({ tables }: TableGridProps) {
  const { selectTable } = useTable()
  const [selectedTable, setSelectedTable] = useState<Table | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  const handleTableClick = (table: Table) => {
    setSelectedTable(table)
    selectTable(table)
    setIsDialogOpen(true)
  }

  const handleCloseDialog = () => {
    setIsDialogOpen(false)
    setTimeout(() => {
      setSelectedTable(null)
      selectTable(null)
    }, 300)
  }

  return (
    <div className="relative min-h-[500px] w-full bg-gray-50 rounded-lg p-4">
      {tables.map((table) => (
        <div
          key={table.id}
          style={{
            position: "absolute",
            left: `${table.position.x}px`,
            top: `${table.position.y}px`,
          }}
        >
          <Button variant="outline" className="h-auto p-0" onClick={() => handleTableClick(table)}>
            <TableCard table={table} />
          </Button>
        </div>
      ))}

      <TableDetailsDialog
        table={selectedTable}
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onClose={handleCloseDialog}
      />
    </div>
  )
}
