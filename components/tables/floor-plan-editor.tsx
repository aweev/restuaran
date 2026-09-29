"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { useTable } from "@/context/TableContext"
import { Button } from "@/components/ui/button"
import { TableCard } from "@/components/tables/table-card"
import { TableDetailsDialog } from "@/components/tables/table-details-dialog"
import { TableTransferDialog } from "@/components/tables/table-transfer-dialog"
import { TableMergeDialog } from "@/components/tables/table-merge-dialog"
import type { Table } from "@/types"
import { Save, Undo, Redo, Move } from "lucide-react"
import { toast } from "@/components/ui/use-toast"

interface FloorPlanEditorProps {
  tables: Table[]
}

export function FloorPlanEditor({ tables }: FloorPlanEditorProps) {
  const { updateTablePosition, selectTable } = useTable()
  const [selectedTable, setSelectedTable] = useState<Table | null>(null)
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false)
  const [isTransferDialogOpen, setIsTransferDialogOpen] = useState(false)
  const [isMergeDialogOpen, setIsMergeDialogOpen] = useState(false)
  const [isEditMode, setIsEditMode] = useState(false)
  const [tablePositions, setTablePositions] = useState<Record<string, { x: number; y: number }>>({})
  const [history, setHistory] = useState<Array<Record<string, { x: number; y: number }>>>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const floorPlanRef = useRef<HTMLDivElement>(null)
  const draggedTableRef = useRef<string | null>(null)
  const startPositionRef = useRef<{ x: number; y: number } | null>(null)

  // Initialize table positions
  useEffect(() => {
    const positions: Record<string, { x: number; y: number }> = {}
    tables.forEach((table) => {
      positions[table.id] = { x: table.position.x, y: table.position.y }
    })
    setTablePositions(positions)
    // Initialize history with current positions
    setHistory([positions])
    setHistoryIndex(0)
  }, [tables])

  const handleTableClick = (table: Table) => {
    if (isEditMode) return

    setSelectedTable(table)
    selectTable(table)
    setIsDetailsDialogOpen(true)
  }

  const handleCloseDetailsDialog = () => {
    setIsDetailsDialogOpen(false)
    setTimeout(() => {
      setSelectedTable(null)
      selectTable(null)
    }, 300)
  }

  const handleDragStart = (e: React.MouseEvent, tableId: string) => {
    if (!isEditMode) return

    e.preventDefault()
    draggedTableRef.current = tableId
    const table = document.getElementById(`table-${tableId}`)
    if (table) {
      const rect = table.getBoundingClientRect()
      startPositionRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      }
    }
  }

  const handleDragMove = (e: React.MouseEvent) => {
    if (!isEditMode || !draggedTableRef.current || !startPositionRef.current || !floorPlanRef.current) return

    const floorPlanRect = floorPlanRef.current.getBoundingClientRect()
    const newX = e.clientX - floorPlanRect.left - startPositionRef.current.x
    const newY = e.clientY - floorPlanRect.top - startPositionRef.current.y

    // Ensure table stays within floor plan boundaries
    const boundedX = Math.max(0, Math.min(newX, floorPlanRect.width - 80))
    const boundedY = Math.max(0, Math.min(newY, floorPlanRect.height - 80))

    setTablePositions((prev) => ({
      ...prev,
      [draggedTableRef.current!]: { x: boundedX, y: boundedY },
    }))
  }

  const handleDragEnd = () => {
    if (!isEditMode || !draggedTableRef.current) return

    // Add current positions to history
    const newHistory = history.slice(0, historyIndex + 1)
    newHistory.push({ ...tablePositions })
    setHistory(newHistory)
    setHistoryIndex(newHistory.length - 1)

    draggedTableRef.current = null
    startPositionRef.current = null
  }

  const handleUndo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1)
      setTablePositions({ ...history[historyIndex - 1] })
    }
  }

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1)
      setTablePositions({ ...history[historyIndex + 1] })
    }
  }

  const handleSavePositions = async () => {
    try {
      // Save all table positions to the database
      const savePromises = Object.entries(tablePositions).map(([tableId, position]) =>
        updateTablePosition(tableId, position),
      )

      await Promise.all(savePromises)
      toast({
        title: "Floor plan saved",
        description: "Table positions have been updated successfully.",
      })

      setIsEditMode(false)
    } catch (error) {
      console.error("Error saving table positions:", error)
      toast({
        title: "Error saving floor plan",
        description: "There was a problem updating table positions.",
        variant: "destructive",
      })
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Button variant={isEditMode ? "default" : "outline"} onClick={() => setIsEditMode(!isEditMode)}>
            <Move className="mr-2 h-4 w-4" />
            {isEditMode ? "Exit Edit Mode" : "Edit Floor Plan"}
          </Button>

          {isEditMode && (
            <>
              <Button variant="outline" onClick={handleUndo} disabled={historyIndex <= 0}>
                <Undo className="h-4 w-4" />
              </Button>
              <Button variant="outline" onClick={handleRedo} disabled={historyIndex >= history.length - 1}>
                <Redo className="h-4 w-4" />
              </Button>
              <Button onClick={handleSavePositions}>
                <Save className="mr-2 h-4 w-4" />
                Save Layout
              </Button>
            </>
          )}
        </div>

        {selectedTable && !isEditMode && (
          <div className="flex space-x-2">
            <Button variant="outline" onClick={() => setIsTransferDialogOpen(true)}>
              Transfer Table
            </Button>
            <Button variant="outline" onClick={() => setIsMergeDialogOpen(true)}>
              Merge Tables
            </Button>
          </div>
        )}
      </div>

      <div
        ref={floorPlanRef}
        className="relative h-[600px] w-full rounded-lg border bg-gray-50 p-4"
        onMouseMove={handleDragMove}
        onMouseUp={handleDragEnd}
        onMouseLeave={handleDragEnd}
      >
        {/* Background grid for visual reference */}
        <div className="absolute inset-0 grid grid-cols-12 grid-rows-6 gap-4 opacity-10">
          {Array.from({ length: 72 }).map((_, i) => (
            <div key={i} className="border border-dashed border-gray-400"></div>
          ))}
        </div>

        {/* Tables */}
        {tables.map((table) => (
          <div
            id={`table-${table.id}`}
            key={table.id}
            className={`absolute cursor-${isEditMode ? "move" : "pointer"} transition-all duration-200 ${
              draggedTableRef.current === table.id ? "z-10 scale-105" : ""
            }`}
            style={{
              left: `${tablePositions[table.id]?.x || table.position.x}px`,
              top: `${tablePositions[table.id]?.y || table.position.y}px`,
            }}
            onClick={() => handleTableClick(table)}
            onMouseDown={(e) => handleDragStart(e, table.id)}
          >
            <TableCard table={table} />
          </div>
        ))}
      </div>

      {/* Dialogs */}
      <TableDetailsDialog
        table={selectedTable}
        open={isDetailsDialogOpen}
        onOpenChange={setIsDetailsDialogOpen}
        onClose={handleCloseDetailsDialog}
      />

      <TableTransferDialog
        table={selectedTable}
        open={isTransferDialogOpen}
        onOpenChange={setIsTransferDialogOpen}
        tables={tables.filter((t) => t.id !== selectedTable?.id)}
      />

      <TableMergeDialog
        table={selectedTable}
        open={isMergeDialogOpen}
        onOpenChange={setIsMergeDialogOpen}
        tables={tables.filter((t) => t.id !== selectedTable?.id)}
      />
    </div>
  )
}
