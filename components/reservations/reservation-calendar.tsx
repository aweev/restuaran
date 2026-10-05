"use client"

import { useMemo } from "react"
import type { Reservation } from "@/types/reservation"
import type { Table } from "@/types"
import { format, addMinutes, isBefore, isAfter, setHours, setMinutes } from "date-fns"
import { reservationSlotToDate } from "@/lib/kernel-mappers"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"

interface ReservationCalendarProps {
  reservations: Reservation[]
  tables: Table[]
  date: Date
}

export function ReservationCalendar({ reservations, tables, date }: ReservationCalendarProps) {
  // Generate time slots from 9 AM to 10 PM in 30-minute intervals
  const timeSlots = useMemo(() => {
    const slots = []
    const startTime = setHours(setMinutes(new Date(date), 0), 9) // 9:00 AM
    const endTime = setHours(setMinutes(new Date(date), 0), 22) // 10:00 PM

    let currentTime = startTime
    while (isBefore(currentTime, endTime)) {
      slots.push({
        time: new Date(currentTime),
        label: format(currentTime, "h:mm a"),
      })
      currentTime = addMinutes(currentTime, 30)
    }

    return slots
  }, [date])

  // Group reservations by time slot
  const reservationsByTimeSlot = useMemo(() => {
    const grouped = new Map()

    timeSlots.forEach((slot) => {
      const slotStart = slot.time
      const slotEnd = addMinutes(slot.time, 30)

      const slotReservations = reservations.filter((reservation) => {
        const reservationTime = reservationSlotToDate(reservation.date, reservation.time)
        return isAfter(reservationTime, slotStart) && isBefore(reservationTime, slotEnd)
      })

      grouped.set(slot.label, slotReservations)
    })

    return grouped
  }, [reservations, timeSlots])

  return (
    <ScrollArea className="h-[500px] pr-4">
      <div className="space-y-1">
        {timeSlots.map((slot) => {
          const slotReservations = reservationsByTimeSlot.get(slot.label) || []

          return (
            <div key={slot.label} className="grid grid-cols-[100px_1fr] gap-2">
              <div className="py-2 font-medium">{slot.label}</div>
              <div className="flex flex-wrap gap-2 py-2">
                {slotReservations.length > 0 ? (
                  slotReservations.map((reservation: Reservation) => {
                    const table = tables.find((t) => t.id === reservation.tableId)

                    return (
                      <div key={reservation.id} className="flex items-center gap-2 rounded-md bg-muted p-2 text-sm">
                        <Badge variant="outline">Table {table?.number || "?"}</Badge>
                        <span>{reservation.customerName}</span>
                        <span className="text-muted-foreground">({reservation.partySize} guests)</span>
                      </div>
                    )
                  })
                ) : (
                  <div className="flex h-10 items-center text-sm text-muted-foreground">Available</div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </ScrollArea>
  )
}
