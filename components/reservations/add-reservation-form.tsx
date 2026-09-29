"use client"

import type React from "react"

import { useState } from "react"
import type { Table } from "@/types"
import { useReservation } from "@/context/ReservationContext"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { format, setHours, setMinutes } from "date-fns"
import { CalendarIcon, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface AddReservationFormProps {
  tables: Table[]
}

export function AddReservationForm({ tables }: AddReservationFormProps) {
  const { addReservation } = useReservation()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [date, setDate] = useState<Date>(new Date())
  const [time, setTime] = useState("18:00") // Default to 6:00 PM
  const [formData, setFormData] = useState({
    customerName: "",
    phone: "",
    email: "",
    partySize: 2,
    tableId: "",
    notes: "",
  })

  const availableTables = tables.filter((table) => table.status === "available" && table.capacity >= formData.partySize)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target
    setFormData({
      ...formData,
      [name]: type === "number" ? Number.parseInt(value) : value,
    })
  }

  const handleSelectChange = (name: string, value: string) => {
    setFormData({
      ...formData,
      [name]: value,
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      // Combine date and time
      const [hours, minutes] = time.split(":").map(Number)
      const reservationDateTime = setMinutes(setHours(new Date(date), hours), minutes)

      await addReservation({
        id: crypto.randomUUID(),
        customerName: formData.customerName,
        phone: formData.phone,
        email: formData.email,
        partySize: formData.partySize,
        tableId: formData.tableId,
        date: date.toISOString(),
        time: reservationDateTime.toISOString(),
        status: "confirmed",
        notes: formData.notes,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })

      // Reset form
      setFormData({
        customerName: "",
        phone: "",
        email: "",
        partySize: 2,
        tableId: "",
        notes: "",
      })
    } catch (error) {
      console.error("Error adding reservation:", error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="customerName">Customer Name</Label>
        <Input id="customerName" name="customerName" value={formData.customerName} onChange={handleChange} required />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="phone">Phone Number</Label>
          <Input id="phone" name="phone" value={formData.phone} onChange={handleChange} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" value={formData.email} onChange={handleChange} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="date">Date</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {date ? format(date, "PPP") : <span>Pick a date</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar mode="single" selected={date} onSelect={(date) => date && setDate(date)} initialFocus />
            </PopoverContent>
          </Popover>
        </div>

        <div className="space-y-2">
          <Label htmlFor="time">Time</Label>
          <Select value={time} onValueChange={(value) => setTime(value)}>
            <SelectTrigger>
              <SelectValue placeholder="Select time" />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 28 }, (_, i) => {
                const hour = Math.floor(i / 2) + 9 // Start at 9 AM
                const minute = (i % 2) * 30
                const formattedHour = hour.toString().padStart(2, "0")
                const formattedMinute = minute.toString().padStart(2, "0")
                const timeValue = `${formattedHour}:${formattedMinute}`
                const displayTime = format(setMinutes(setHours(new Date(), hour), minute), "h:mm a")
                return (
                  <SelectItem key={timeValue} value={timeValue}>
                    {displayTime}
                  </SelectItem>
                )
              })}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="partySize">Party Size</Label>
          <Input
            id="partySize"
            name="partySize"
            type="number"
            min="1"
            value={formData.partySize}
            onChange={handleChange}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="tableId">Table</Label>
          <Select value={formData.tableId} onValueChange={(value) => handleSelectChange("tableId", value)}>
            <SelectTrigger>
              <SelectValue placeholder="Select table" />
            </SelectTrigger>
            <SelectContent>
              {availableTables.length > 0 ? (
                availableTables.map((table) => (
                  <SelectItem key={table.id} value={table.id}>
                    Table {table.number} (Seats {table.capacity})
                  </SelectItem>
                ))
              ) : (
                <SelectItem value="none" disabled>
                  No suitable tables available
                </SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" name="notes" value={formData.notes} onChange={handleChange} rows={3} />
      </div>

      <Button type="submit" className="w-full" disabled={isSubmitting || !formData.tableId}>
        {isSubmitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Creating...
          </>
        ) : (
          "Create Reservation"
        )}
      </Button>
    </form>
  )
}
