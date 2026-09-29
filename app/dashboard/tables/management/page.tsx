"use client"

import { useState, useEffect } from "react"
import { useTable } from "@/context/TableContext"
import { useReservation } from "@/context/ReservationContext"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, Plus } from "lucide-react"
import { FloorPlanEditor } from "@/components/tables/floor-plan-editor"
import { TableStatusOverview } from "@/components/tables/table-status-overview"
import { ReservationCalendar } from "@/components/reservations/reservation-calendar"
import { WaitListManager } from "@/components/tables/wait-list-manager"
import { TableServiceTracker } from "@/components/tables/table-service-tracker"
import { CustomerPreferences } from "@/components/tables/customer-preferences"
import { TableActionDialog } from "@/components/tables/table-action-dialog"

export default function TableManagementPage() {
  const { state: tableState, fetchTables } = useTable()
  const { state: reservationState, fetchReservations } = useReservation()
  const [loading, setLoading] = useState(true)
  const [showTableActionDialog, setShowTableActionDialog] = useState(false)

  useEffect(() => {
    const loadData = async () => {
      try {
        await Promise.all([fetchTables(), fetchReservations()])
      } catch (error) {
        console.error("Error loading table management data:", error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [fetchTables, fetchReservations])

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Table Management</h2>
        <Button onClick={() => setShowTableActionDialog(true)}>
          <Plus className="mr-2 h-4 w-4" /> Add Table
        </Button>
      </div>

      <TableStatusOverview tables={tableState.tables} />

      <Tabs defaultValue="floor-plan" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="floor-plan">Floor Plan</TabsTrigger>
          <TabsTrigger value="reservations">Reservations</TabsTrigger>
          <TabsTrigger value="wait-list">Wait List</TabsTrigger>
          <TabsTrigger value="service">Service Timing</TabsTrigger>
          <TabsTrigger value="customers">Customer Profiles</TabsTrigger>
        </TabsList>

        <TabsContent value="floor-plan" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Restaurant Floor Plan</CardTitle>
              <CardDescription>
                Drag tables to rearrange. Click on a table to view details or take actions.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FloorPlanEditor tables={tableState.tables} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reservations" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Reservations</CardTitle>
              <CardDescription>Manage upcoming reservations and table assignments.</CardDescription>
            </CardHeader>
            <CardContent>
              <ReservationCalendar 
                reservations={reservationState.reservations} 
                tables={tableState.tables} 
                date={new Date()} 
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="wait-list" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Wait List</CardTitle>
              <CardDescription>Manage customers waiting for tables.</CardDescription>
            </CardHeader>
            <CardContent>
              <WaitListManager tables={tableState.tables} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="service" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Service Timing</CardTitle>
              <CardDescription>Track service timing for occupied tables.</CardDescription>
            </CardHeader>
            <CardContent>
              <TableServiceTracker tables={tableState.tables} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="customers" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Customer Profiles</CardTitle>
              <CardDescription>View and manage customer preferences and history.</CardDescription>
            </CardHeader>
            <CardContent>
              <CustomerPreferences />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <TableActionDialog open={showTableActionDialog} onOpenChange={setShowTableActionDialog} />
    </div>
  )
}
