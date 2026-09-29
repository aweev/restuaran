"use client"

import type React from "react"

import { useState } from "react"
import { useTable } from "@/context/TableContext"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "@/components/ui/use-toast"
import { Loader2 } from "lucide-react"
import type { TableStatus } from "@/types"

interface TableActionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface TableFormData {
  number: string
  capacity: number
  status: TableStatus
  positionX: number
  positionY: number
}

export function TableActionDialog({ open, onOpenChange }: TableActionDialogProps) {
  const { addTable } = useTable()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState<TableFormData>({
    number: "",
    capacity: 4,
    status: "available",
    positionX: 100,
    positionY: 100,
  })

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target
    setFormData({
      ...formData,
      [name]: type === "number" ? Number.parseInt(value) : value,
    })
  }

  const handleSelectChange = <K extends keyof TableFormData>(name: K, value: TableFormData[K]) => {
    setFormData({
      ...formData,
      [name]: value,
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.number) {
      toast({
        title: "Missing information",
        description: "Please provide a table number.",
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)

    try {
      await addTable({
        id: crypto.randomUUID(),
        number: formData.number,
        capacity: formData.capacity,
        status: formData.status,
        position: {
          x: formData.positionX,
          y: formData.positionY,
        },
      })

      setFormData({
        number: "",
        capacity: 4,
        status: "available",
        positionX: 100,
        positionY: 100,
      })

      onOpenChange(false)

      toast({
        title: "Table added",
        description: `Table ${formData.number} has been added successfully.`,
      })
    } catch (error) {
      console.error("Error adding table:", error)
      toast({
        title: "Error",
        description: "Failed to add table. The table number may already exist.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New Table</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="number">Table Number</Label>
              <Input
                id="number"
                name="number"
                value={formData.number}
                onChange={handleInputChange}
                placeholder="e.g., 1, A1, etc."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="capacity">Seating Capacity</Label>
              <Input
                id="capacity"
                name="capacity"
                type="number"
                min={1}
                max={20}
                value={formData.capacity}
                onChange={handleInputChange}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Initial Status</Label>
              {/* The <SelectItem> values below are exactly the TableStatus members. */}
              <Select
                value={formData.status}
                onValueChange={(value) => handleSelectChange("status", value as TableStatus)}
              >
                <SelectTrigger id="status">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="available">Available</SelectItem>
                  <SelectItem value="reserved">Reserved</SelectItem>
                  <SelectItem value="occupied">Occupied</SelectItem>
                  <SelectItem value="dirty">Needs Cleaning</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Initial Position</Label>
              <div className="flex space-x-2">
                <div className="flex-1">
                  <Input
                    id="positionX"
                    name="positionX"
                    type="number"
                    min={0}
                    max={800}
                    value={formData.positionX}
                    onChange={handleInputChange}
                    placeholder="X"
                  />
                </div>
                <div className="flex-1">
                  <Input
                    id="positionY"
                    name="positionY"
                    type="number"
                    min={0}
                    max={600}
                    value={formData.positionY}
                    onChange={handleInputChange}
                    placeholder="Y"
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                You can adjust the position later in the floor plan editor.
              </p>
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adding...
                </>
              ) : (
                "Add Table"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
