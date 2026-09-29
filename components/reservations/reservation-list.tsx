"use client"

import type { Reservation } from "@/types/reservation"
import type { Table } from "@/types"
import { format } from "date-fns"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { EditReservationForm } from "@/components/reservations/edit-reservation-form"
import { useState } from "react"
import { useReservation } from "@/context/ReservationContext"
import { Edit, Trash, Phone, Users, Clock } from "lucide-react"

interface ReservationListProps {
  reservations: Reservation[]
  tables: Table[]
}

export function ReservationList({ reservations, tables }: ReservationListProps) {
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null)
  const { cancelReservation } = useReservation()

  const getTableById = (tableId: string) => {
    return tables.find((table) => table.id === tableId)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "confirmed":
        return "bg-green-100 text-green-800"
      case "pending":
        return "bg-yellow-100 text-yellow-800"
      case "cancelled":
        return "bg-red-100 text-red-800"
      case "completed":
        return "bg-blue-100 text-blue-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const handleCancelReservation = async (id: string) => {
    if (confirm("Are you sure you want to cancel this reservation?")) {
      try {
        await cancelReservation(id)
      } catch (error) {
        console.error("Error cancelling reservation:", error)
      }
    }
  }

  if (reservations.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-muted-foreground">No reservations for this date.</div>
    )
  }

  return (
    <div className="space-y-4">
      {reservations
        .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())
        .map((reservation) => {
          const table = getTableById(reservation.tableId)

          return (
            <div
              key={reservation.id}
              className="flex flex-col rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium">{reservation.customerName}</h3>
                  <Badge variant="outline" className={getStatusColor(reservation.status)}>
                    {reservation.status}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    <span>{format(new Date(reservation.time), "h:mm a")}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    <span>{reservation.partySize} guests</span>
                  </div>
                  {table && (
                    <div>
                      Table {table.number} (Capacity: {table.capacity})
                    </div>
                  )}
                  {reservation.phone && (
                    <div className="flex items-center gap-1">
                      <Phone className="h-4 w-4" />
                      <span>{reservation.phone}</span>
                    </div>
                  )}
                </div>
                {reservation.notes && <p className="text-sm text-muted-foreground">{reservation.notes}</p>}
              </div>
              <div className="mt-4 flex gap-2 sm:mt-0">
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="icon" onClick={() => setSelectedReservation(reservation)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                      <DialogTitle>Edit Reservation</DialogTitle>
                    </DialogHeader>
                    {selectedReservation && <EditReservationForm reservation={selectedReservation} tables={tables} />}
                  </DialogContent>
                </Dialog>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleCancelReservation(reservation.id)}
                  disabled={reservation.status === "cancelled"}
                >
                  <Trash className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )
        })}
    </div>
  )
}
