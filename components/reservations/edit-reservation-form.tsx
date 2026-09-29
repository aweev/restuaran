"use client"

import type React from "react"

import { useState } from "react"
import type { Reservation } from "@/types/reservation"
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

interface EditReservationFormProps {
  reservation: Reservation
  tables: Table[]
}

export function EditReservationForm({ reservation, tables }: EditReservationFormProps) {
  const { updateReservation } = useReservation()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [date, setDate] = useState<Date>(new Date(reservation.date))
  const reservationTime = new Date(reservation.time)
  const initialTimeString = `${reservationTime.getHours().toString().padStart(2, "0")}:${reservationTime.getMinutes().toString().padStart(2, "0")}`
  const [time, setTime] = useState(initialTimeString)

  const [formData, setFormData] = useState({
    id: reservation.id,
    customerName: reservation.customerName,
    phone: reservation.phone || "",
    email: reservation.email || "",
    partySize: reservation.partySize,
    tableId: reservation.tableId,
    status: reservation.status,
    notes: reservation.notes || "",
  })

  const availableTables = tables.filter(
    (table) =>
      (table.status === "available" || table.id === reservation.tableId) && table.capacity >= formData.partySize,
  )

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

      await updateReservation({
        ...formData,
        date: date.toISOString(),
        time: reservationDateTime.toISOString(),
        updatedAt: new Date().toISOString(),
      })
    } catch (error) {
      console.error("Error updating reservation:", error)
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
        <Label htmlFor="status">Status</Label>
        <Select value={formData.status} onValueChange={(value) => handleSelectChange("status", value)}>
          <SelectTrigger>
            <SelectValue placeholder="Select status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="confirmed">Confirmed</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" name="notes" value={formData.notes} onChange={handleChange} rows={3} />
      </div>

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Updating...
          </>
        ) : (
          "Update Reservation"
        )}
      </Button>
    </form>
  )
}
