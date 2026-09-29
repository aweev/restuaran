"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { useReservation } from "@/context/ReservationContext"
import { useTable } from "@/context/TableContext"
import { ReservationList } from "@/components/reservations/reservation-list"
import { ReservationCalendar } from "@/components/reservations/reservation-calendar"
import { Plus } from "lucide-react"
import { Loader2 } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { AddReservationForm } from "@/components/reservations/add-reservation-form"
import { format } from "date-fns"

export default function ReservationsPage() {
  const { state: reservationState, fetchReservations } = useReservation()
  const { state: tableState, fetchTables } = useTable()
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())

  useEffect(() => {
    const loadData = async () => {
      try {
        await Promise.all([fetchReservations(), fetchTables()])
      } catch (error) {
        console.error("Error loading reservation data:", error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [fetchReservations, fetchTables])

  // Filter reservations for the selected date
  const filteredReservations = reservationState.reservations.filter((reservation) => {
    const reservationDate = new Date(reservation.date)
    return (
      reservationDate.getDate() === selectedDate.getDate() &&
      reservationDate.getMonth() === selectedDate.getMonth() &&
      reservationDate.getFullYear() === selectedDate.getFullYear()
    )
  })

  // Count today's reservations
  const today = new Date()
  const todayReservations = reservationState.reservations.filter((reservation) => {
    const reservationDate = new Date(reservation.date)
    return (
      reservationDate.getDate() === today.getDate() &&
      reservationDate.getMonth() === today.getMonth() &&
      reservationDate.getFullYear() === today.getFullYear()
    )
  })

  // Count upcoming reservations (future dates)
  const upcomingReservations = reservationState.reservations.filter((reservation) => {
    const reservationDate = new Date(reservation.date)
    return reservationDate > today
  })

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h2 className="text-3xl font-bold tracking-tight">Reservations</h2>
        <Dialog>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Reservation
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Add New Reservation</DialogTitle>
            </DialogHeader>
            <AddReservationForm tables={tableState.tables} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today&apos;s Reservations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{todayReservations.length}</div>
            <p className="text-xs text-muted-foreground">{format(today, "MMMM d, yyyy")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Upcoming Reservations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{upcomingReservations.length}</div>
            <p className="text-xs text-muted-foreground">Next 30 days</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Available Tables</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {tableState.tables.filter((t) => t.status === "available").length} / {tableState.tables.length}
            </div>
            <p className="text-xs text-muted-foreground">For current time slot</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Selected Date</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{format(selectedDate, "MMM d")}</div>
            <p className="text-xs text-muted-foreground">{filteredReservations.length} reservations</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle>Select Date</CardTitle>
            <CardDescription>Choose a date to view reservations</CardDescription>
          </CardHeader>
          <CardContent>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => date && setSelectedDate(date)}
              className="rounded-md border"
            />
          </CardContent>
        </Card>
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Reservations for {format(selectedDate, "MMMM d, yyyy")}</CardTitle>
            <CardDescription>{filteredReservations.length} reservations scheduled</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="list" className="space-y-4">
              <TabsList>
                <TabsTrigger value="list">List View</TabsTrigger>
                <TabsTrigger value="calendar">Time Slots</TabsTrigger>
              </TabsList>
              <TabsContent value="list">
                <ReservationList reservations={filteredReservations} tables={tableState.tables} />
              </TabsContent>
              <TabsContent value="calendar">
                <ReservationCalendar
                  reservations={filteredReservations}
                  tables={tableState.tables}
                  date={selectedDate}
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
