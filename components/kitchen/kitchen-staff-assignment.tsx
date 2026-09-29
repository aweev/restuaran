"use client"

import { useState, useEffect } from "react"
import { useKitchen } from "@/context/KitchenContext"
import { useAuth } from "@/context/AuthContext"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { PlusCircle, Trash2 } from "lucide-react"
import { toast } from "@/components/ui/use-toast"

const KITCHEN_STATIONS = ["Grill", "Fry", "Salad", "Pizza", "Dessert", "Expo"]

export function KitchenStaffAssignment() {
  const { state, fetchStaffAssignments, updateStaffAssignment, removeStaffAssignment } = useKitchen()
  const { state: _authState } = useAuth()
  const [, setLoading] = useState(true)
  const [newAssignment, setNewAssignment] = useState({
    userId: "",
    userName: "",
    station: KITCHEN_STATIONS[0],
  })

  useEffect(() => {
    const loadData = async () => {
      try {
        await fetchStaffAssignments()
      } catch (error) {
        console.error("Error loading staff assignments:", error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [fetchStaffAssignments])

  const handleAddAssignment = async () => {
    if (!newAssignment.userId || !newAssignment.userName || !newAssignment.station) {
      toast({
        title: "Missing Information",
        description: "Please fill in all fields",
        variant: "destructive",
      })
      return
    }

    try {
      await updateStaffAssignment({
        ...newAssignment,
        assignedOrders: [],
      })

      setNewAssignment({
        userId: "",
        userName: "",
        station: KITCHEN_STATIONS[0],
      })

      toast({
        title: "Staff Assigned",
        description: `${newAssignment.userName} has been assigned to ${newAssignment.station}`,
      })
    } catch (error) {
      console.error("Error adding staff assignment:", error)
      toast({
        title: "Error",
        description: "Failed to add staff assignment",
        variant: "destructive",
      })
    }
  }

  const handleRemoveAssignment = async (userId: string, userName: string) => {
    try {
      await removeStaffAssignment(userId)
      toast({
        title: "Staff Removed",
        description: `${userName} has been removed from assignment`,
      })
    } catch (error) {
      console.error("Error removing staff assignment:", error)
      toast({
        title: "Error",
        description: "Failed to remove staff assignment",
        variant: "destructive",
      })
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Kitchen Staff Assignment</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="userId">Staff ID</Label>
              <Input
                id="userId"
                placeholder="Staff ID"
                value={newAssignment.userId}
                onChange={(e) => setNewAssignment({ ...newAssignment, userId: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="userName">Staff Name</Label>
              <Input
                id="userName"
                placeholder="Staff Name"
                value={newAssignment.userName}
                onChange={(e) => setNewAssignment({ ...newAssignment, userName: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="station">Station</Label>
              <Select
                value={newAssignment.station}
                onValueChange={(value) => setNewAssignment({ ...newAssignment, station: value })}
              >
                <SelectTrigger id="station">
                  <SelectValue placeholder="Select Station" />
                </SelectTrigger>
                <SelectContent>
                  {KITCHEN_STATIONS.map((station) => (
                    <SelectItem key={station} value={station}>
                      {station}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button onClick={handleAddAssignment} className="w-full">
            <PlusCircle className="mr-2 h-4 w-4" />
            Add Staff Assignment
          </Button>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Staff ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Station</TableHead>
                  <TableHead>Assigned Orders</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {state.staffAssignments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center">
                      No staff assignments
                    </TableCell>
                  </TableRow>
                ) : (
                  state.staffAssignments.map((assignment) => (
                    <TableRow key={assignment.userId}>
                      <TableCell className="font-mono">{assignment.userId}</TableCell>
                      <TableCell>{assignment.userName}</TableCell>
                      <TableCell>{assignment.station}</TableCell>
                      <TableCell>{assignment.assignedOrders.length}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveAssignment(assignment.userId, assignment.userName)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
