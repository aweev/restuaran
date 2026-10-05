"use client"

import { useEffect, useState } from "react"
import { useTable } from "@/context/TableContext"
import { useAuth } from "@/context/AuthContext"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { TableGrid } from "@/components/tables/table-grid"
import { Loader2, Plus } from "lucide-react"

export default function TablesPage() {
  const { state, myTables, fetchTables } = useTable()
  const { state: authState } = useAuth()
  const [loading, setLoading] = useState(true)
  const [scope, setScope] = useState<"mine" | "all">("all")
  const visibleTables = scope === "mine" && authState.user?.id ? myTables : state.tables

  useEffect(() => {
    const loadData = async () => {
      try {
        await fetchTables()
      } catch (error) {
        console.error("Error loading tables data:", error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [fetchTables])

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  // Count tables by status
  const availableTables = visibleTables.filter((table) => table.status === "available").length
  const occupiedTables = visibleTables.filter((table) => table.status === "occupied").length
  const reservedTables = visibleTables.filter((table) => table.status === "reserved").length
  const dirtyTables = visibleTables.filter((table) => table.status === "dirty").length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-3xl font-bold tracking-tight">Tables</h2>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border p-0.5" role="group" aria-label="Table scope">
            <Button variant={scope === "mine" ? "default" : "ghost"} size="sm" onClick={() => setScope("mine")}>
              My tables
            </Button>
            <Button variant={scope === "all" ? "default" : "ghost"} size="sm" onClick={() => setScope("all")}>
              All
            </Button>
          </div>
          <Button>
            <Plus className="mr-2 h-4 w-4" /> Add Table
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Available</CardTitle>
            <div className="h-4 w-4 rounded-full bg-green-500"></div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{availableTables}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Occupied</CardTitle>
            <div className="h-4 w-4 rounded-full bg-red-500"></div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{occupiedTables}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Reserved</CardTitle>
            <div className="h-4 w-4 rounded-full bg-blue-500"></div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{reservedTables}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Needs Cleaning</CardTitle>
            <div className="h-4 w-4 rounded-full bg-yellow-500"></div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dirtyTables}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Table Layout{scope === "mine" ? " — My section" : ""}</CardTitle>
        </CardHeader>
        <CardContent>
          <TableGrid tables={visibleTables} />
        </CardContent>
      </Card>
    </div>
  )
}
