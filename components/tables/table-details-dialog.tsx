"use client"

import { useState } from "react"
import type { Table } from "@/types"
import { useTable } from "@/context/TableContext"
import { useAuth } from "@/context/AuthContext"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { format } from "date-fns"

interface TableDetailsDialogProps {
  table: Table | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onClose: () => void
}

export function TableDetailsDialog({ table, open, onOpenChange, onClose }: TableDetailsDialogProps) {
  const { updateTableStatus, occupyTable, clearTable } = useTable()
  const { state: authState } = useAuth()
  const [customerName, setCustomerName] = useState("")
  const [customerCount, setCustomerCount] = useState(1)
  const [isUpdating, setIsUpdating] = useState(false)

  if (!table) return null

  const getStatusColor = (status: string) => {
    switch (status) {
      case "available":
        return "bg-green-100 text-green-800"
      case "occupied":
        return "bg-red-100 text-red-800"
      case "reserved":
        return "bg-blue-100 text-blue-800"
      case "dirty":
        return "bg-yellow-100 text-yellow-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const handleOccupyTable = async () => {
    if (!customerName || customerCount < 1 || !authState.user) return

    setIsUpdating(true)
    try {
      await occupyTable(table.id, customerName, customerCount, authState.user.name)
      onClose()
    } catch (error) {
      console.error("Error occupying table:", error)
    } finally {
      setIsUpdating(false)
    }
  }

  const handleClearTable = async () => {
    setIsUpdating(true)
    try {
      await clearTable(table.id)
      onClose()
    } catch (error) {
      console.error("Error clearing table:", error)
    } finally {
      setIsUpdating(false)
    }
  }

  const handleMarkAvailable = async () => {
    setIsUpdating(true)
    try {
      await updateTableStatus(table.id, "available")
      onClose()
    } catch (error) {
      console.error("Error updating table status:", error)
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            Table {table.number}
            <Badge variant="outline" className={getStatusColor(table.status)}>
              {table.status}
            </Badge>
          </DialogTitle>
          <DialogDescription>Capacity: {table.capacity} people</DialogDescription>
        </DialogHeader>

        {table.status === "occupied" && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Customer:</span>
              <span>{table.customerName}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Party Size:</span>
              <span>{table.customerCount}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Server:</span>
              <span>{table.serverName}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Start Time:</span>
              <span>{table.startTime ? format(new Date(table.startTime), "h:mm a") : "N/A"}</span>
            </div>
          </div>
        )}

        {table.status === "reserved" && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Reserved For:</span>
              <span>{table.customerName}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Party Size:</span>
              <span>{table.customerCount}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Reservation Time:</span>
              <span>{table.startTime ? format(new Date(table.startTime), "h:mm a") : "N/A"}</span>
            </div>
          </div>
        )}

        {table.status === "available" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="customerName">Customer Name</Label>
              <Input id="customerName" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customerCount">Number of Guests</Label>
              <Input
                id="customerCount"
                type="number"
                min={1}
                max={table.capacity}
                value={customerCount}
                onChange={(e) => setCustomerCount(Number.parseInt(e.target.value))}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          {table.status === "available" && (
            <Button onClick={handleOccupyTable} disabled={!customerName || customerCount < 1 || isUpdating}>
              {isUpdating ? "Updating..." : "Seat Customers"}
            </Button>
          )}

          {table.status === "occupied" && (
            <Button onClick={handleClearTable} disabled={isUpdating}>
              {isUpdating ? "Updating..." : "Clear Table"}
            </Button>
          )}

          {table.status === "dirty" && (
            <Button onClick={handleMarkAvailable} disabled={isUpdating}>
              {isUpdating ? "Updating..." : "Mark as Available"}
            </Button>
          )}

          {table.status === "reserved" && (
            <>
              <Button onClick={handleOccupyTable} disabled={isUpdating}>
                {isUpdating ? "Updating..." : "Seat Reservation"}
              </Button>
              <Button variant="outline" onClick={handleMarkAvailable} disabled={isUpdating}>
                {isUpdating ? "Updating..." : "Cancel Reservation"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
