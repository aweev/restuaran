"use client"

import type React from "react"

import { useState } from "react"
import { useWaitList } from "@/context/WaitListContext"
import { useTable } from "@/context/TableContext"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { format, differenceInMinutes } from "date-fns"
import { Clock, Plus, Users, Phone, X, Bell } from "lucide-react"
import { toast } from "@/components/ui/use-toast"
import type { Table, WaitListEntry } from "@/types"

interface WaitListManagerProps {
  tables: Table[]
}

export function WaitListManager({ tables }: WaitListManagerProps) {
  const { state, addEntry, removeEntry, notifyCustomer, seatCustomer } = useWaitList()
  const { occupyTable } = useTable()
  const [newEntry, setNewEntry] = useState({
    customerName: "",
    phoneNumber: "",
    partySize: 2,
    notes: "",
  })
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [selectedEntry, setSelectedEntry] = useState<WaitListEntry | null>(null)
  const [, setIsNotifyDialogOpen] = useState(false)
  const [, setIsSeatDialogOpen] = useState(false)
  const [selectedTable, setSelectedTable] = useState<string>("")

  // Get available tables that can accommodate the party size
  const getAvailableTables = (partySize: number) => {
    return tables.filter((table) => table.status === "available" && table.capacity >= partySize)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setNewEntry({
      ...newEntry,
      [name]: name === "partySize" ? Number.parseInt(value) || 1 : value,
    })
  }

  const handleAddEntry = async () => {
    if (!newEntry.customerName || newEntry.partySize < 1) {
      toast({
        title: "Missing information",
        description: "Please provide a customer name and party size.",
        variant: "destructive",
      })
      return
    }

    try {
      await addEntry({
        ...newEntry,
        estimatedWaitTime: calculateEstimatedWaitTime(newEntry.partySize),
      })

      setNewEntry({
        customerName: "",
        phoneNumber: "",
        partySize: 2,
        notes: "",
      })

      setIsAddDialogOpen(false)

      toast({
        title: "Added to wait list",
        description: `${newEntry.customerName} has been added to the wait list.`,
      })
    } catch (error) {
      console.error("Error adding to wait list:", error)
      toast({
        title: "Error",
        description: "Failed to add customer to wait list.",
        variant: "destructive",
      })
    }
  }

  const handleRemoveEntry = async (id: string) => {
    try {
      await removeEntry(id)
      toast({
        title: "Removed from wait list",
        description: "Customer has been removed from the wait list.",
      })
    } catch (error) {
      console.error("Error removing from wait list:", error)
      toast({
        title: "Error",
        description: "Failed to remove customer from wait list.",
        variant: "destructive",
      })
    }
  }

  const handleNotifyCustomer = async () => {
    if (!selectedEntry) return

    try {
      await notifyCustomer(selectedEntry.id)
      setIsNotifyDialogOpen(false)
      toast({
        title: "Customer notified",
        description: `${selectedEntry.customerName} has been notified that their table is ready.`,
      })
    } catch (error) {
      console.error("Error notifying customer:", error)
      toast({
        title: "Error",
        description: "Failed to notify customer.",
        variant: "destructive",
      })
    }
  }

  const handleSeatCustomer = async () => {
    if (!selectedEntry || !selectedTable) return

    try {
      // First occupy the table
      await occupyTable(
        selectedTable,
        selectedEntry.customerName,
        selectedEntry.partySize,
        "Server", // This should be the current user's name in a real implementation
      )

      // Then remove from wait list
      await seatCustomer(selectedEntry.id, selectedTable)

      setIsSeatDialogOpen(false)
      setSelectedEntry(null)

      toast({
        title: "Customer seated",
        description: `${selectedEntry.customerName} has been seated at table ${
          tables.find((t) => t.id === selectedTable)?.number
        }.`,
      })
    } catch (error) {
      console.error("Error seating customer:", error)
      toast({
        title: "Error",
        description: "Failed to seat customer.",
        variant: "destructive",
      })
    }
  }

  // Calculate estimated wait time based on party size and current occupancy
  const calculateEstimatedWaitTime = (partySize: number): number => {
    const availableTables = getAvailableTables(partySize)

    if (availableTables.length > 0) {
      return 0 // No wait if tables are available
    }

    // Base wait time of 15 minutes
    let waitTime = 15

    // Add time based on number of parties ahead with similar size requirements
    const partiesAhead = state.entries.filter((entry) => entry.partySize >= partySize).length
    waitTime += partiesAhead * 10

    // Adjust based on current occupancy
    const occupancyRate = tables.length > 0 ? tables.filter((t) => t.status === "occupied").length / tables.length : 0

    waitTime = Math.round(waitTime * (1 + occupancyRate))

    return waitTime
  }

  // Get wait time display
  const getWaitTimeDisplay = (entry: WaitListEntry) => {
    const createdAt = new Date(entry.createdAt)
    const waitedMinutes = differenceInMinutes(new Date(), createdAt)

    if (entry.estimatedWaitTime === 0) {
      return "Ready to seat"
    }

    if (waitedMinutes >= entry.estimatedWaitTime) {
      return "Table should be ready"
    }

    return `~${entry.estimatedWaitTime - waitedMinutes} min remaining`
  }

  // Get wait time status color
  const getWaitTimeStatusColor = (entry: WaitListEntry) => {
    const createdAt = new Date(entry.createdAt)
    const waitedMinutes = differenceInMinutes(new Date(), createdAt)

    if (entry.estimatedWaitTime === 0 || waitedMinutes >= entry.estimatedWaitTime) {
      return "bg-green-100 text-green-800"
    }

    if (waitedMinutes >= entry.estimatedWaitTime * 0.8) {
      return "bg-yellow-100 text-yellow-800"
    }

    return "bg-blue-100 text-blue-800"
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Current Wait List ({state.entries.length})</h3>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" /> Add to Wait List
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add to Wait List</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="customerName">Customer Name</Label>
                <Input
                  id="customerName"
                  name="customerName"
                  value={newEntry.customerName}
                  onChange={handleInputChange}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phoneNumber">Phone Number</Label>
                <Input id="phoneNumber" name="phoneNumber" value={newEntry.phoneNumber} onChange={handleInputChange} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="partySize">Party Size</Label>
                <Input
                  id="partySize"
                  name="partySize"
                  type="number"
                  min={1}
                  value={newEntry.partySize}
                  onChange={handleInputChange}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Input id="notes" name="notes" value={newEntry.notes} onChange={handleInputChange} />
              </div>
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddEntry}>Add to Wait List</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <ScrollArea className="h-[400px]">
        {state.entries.length === 0 ? (
          <div className="flex h-32 items-center justify-center text-muted-foreground">
            No customers currently waiting
          </div>
        ) : (
          <div className="space-y-2">
            {state.entries.map((entry) => (
              <Card key={entry.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium">{entry.customerName}</h4>
                        <Badge variant="outline" className={getWaitTimeStatusColor(entry)}>
                          {getWaitTimeDisplay(entry)}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Users className="h-4 w-4" />
                          <span>{entry.partySize} guests</span>
                        </div>
                        {entry.phoneNumber && (
                          <div className="flex items-center gap-1">
                            <Phone className="h-4 w-4" />
                            <span>{entry.phoneNumber}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          <span>Added {format(new Date(entry.createdAt), "h:mm a")}</span>
                        </div>
                      </div>
                      {entry.notes && <p className="text-sm text-muted-foreground">{entry.notes}</p>}
                    </div>
                    <div className="flex gap-2">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => {
                              setSelectedEntry(entry)
                              setIsNotifyDialogOpen(true)
                            }}
                          >
                            <Bell className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Notify Customer</DialogTitle>
                          </DialogHeader>
                          <div className="py-4">
                            <p>
                              Are you sure you want to notify {entry.customerName} that their table is ready?
                              {entry.phoneNumber ? (
                                <span> A text message will be sent to {entry.phoneNumber}.</span>
                              ) : (
                                <span> No phone number is available for SMS notification.</span>
                              )}
                            </p>
                          </div>
                          <div className="flex justify-end space-x-2">
                            <Button variant="outline" onClick={() => setIsNotifyDialogOpen(false)}>
                              Cancel
                            </Button>
                            <Button onClick={handleNotifyCustomer}>Notify Customer</Button>
                          </div>
                        </DialogContent>
                      </Dialog>

                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => {
                              setSelectedEntry(entry)
                              setIsSeatDialogOpen(true)
                              setSelectedTable("")
                            }}
                          >
                            Seat
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Seat Customer</DialogTitle>
                          </DialogHeader>
                          <div className="py-4 space-y-4">
                            <p>
                              Select a table to seat {entry.customerName}&apos;s party of {entry.partySize}:
                            </p>

                            <div className="grid grid-cols-2 gap-2">
                              {getAvailableTables(entry.partySize).length > 0 ? (
                                getAvailableTables(entry.partySize).map((table) => (
                                  <Button
                                    key={table.id}
                                    variant={selectedTable === table.id ? "default" : "outline"}
                                    className="justify-start"
                                    onClick={() => setSelectedTable(table.id)}
                                  >
                                    Table {table.number} (Seats {table.capacity})
                                  </Button>
                                ))
                              ) : (
                                <p className="col-span-2 text-center text-muted-foreground">
                                  No suitable tables available
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex justify-end space-x-2">
                            <Button variant="outline" onClick={() => setIsSeatDialogOpen(false)}>
                              Cancel
                            </Button>
                            <Button onClick={handleSeatCustomer} disabled={!selectedTable}>
                              Seat Customer
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>

                      <Button variant="ghost" size="icon" onClick={() => handleRemoveEntry(entry.id)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  )
}
