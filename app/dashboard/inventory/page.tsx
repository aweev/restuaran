"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { InventoryTable } from "@/components/inventory/inventory-table"
import { IngredientUsageChart } from "@/components/inventory/ingredient-usage-chart"
import { LowStockAlert } from "@/components/inventory/low-stock-alert"
import { ExportButtons } from "@/components/reports/export-buttons"
import { useInventory } from "@/context/InventoryContext"
import { exportInventoryToCSV } from "@/lib/export-utils"
import { Plus, FileUp } from "lucide-react"
import { Loader2 } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { AddIngredientForm } from "@/components/inventory/add-ingredient-form"
import { format } from "date-fns"

export default function InventoryPage() {
  const { state, fetchInventory } = useInventory()
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")

  useEffect(() => {
    const loadData = async () => {
      try {
        await fetchInventory()
      } catch (error) {
        console.error("Error loading inventory data:", error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [fetchInventory])

  const filteredIngredients = state.ingredients.filter(
    (ingredient) =>
      ingredient.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ingredient.category.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  const lowStockIngredients = state.ingredients.filter(
    (ingredient) => ingredient.currentStock <= ingredient.reorderLevel,
  )

  const handleExportCSV = () => {
    return exportInventoryToCSV(filteredIngredients)
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-4" id="inventory-container">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h2 className="text-3xl font-bold tracking-tight">Inventory Management</h2>
        <div className="flex flex-col sm:flex-row gap-2">
          <Dialog>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Ingredient
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Add New Ingredient</DialogTitle>
              </DialogHeader>
              <AddIngredientForm />
            </DialogContent>
          </Dialog>
          <ExportButtons
            onExportCSV={handleExportCSV}
            fileName={`inventory-${format(new Date(), "yyyy-MM-dd")}`}
            pdfElementId="inventory-container"
          />
          <Button variant="outline">
            <FileUp className="mr-2 h-4 w-4" />
            Import
          </Button>
        </div>
      </div>

      {lowStockIngredients.length > 0 && <LowStockAlert ingredients={lowStockIngredients} />}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Ingredients</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{state.ingredients.length}</div>
            <p className="text-xs text-muted-foreground">{state.ingredients.filter((i) => i.isActive).length} active</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Low Stock Items</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{lowStockIngredients.length}</div>
            <p className="text-xs text-muted-foreground">Need to reorder soon</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inventory Value</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${state.ingredients.reduce((sum, i) => sum + i.currentStock * i.unitCost, 0).toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">Total value of all ingredients</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Last Updated</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Today</div>
            <p className="text-xs text-muted-foreground">At 09:32 AM</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="all" className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <TabsList>
            <TabsTrigger value="all">All Ingredients</TabsTrigger>
            <TabsTrigger value="low">Low Stock</TabsTrigger>
            <TabsTrigger value="usage">Usage Analytics</TabsTrigger>
          </TabsList>
          <div className="flex-1 sm:max-w-sm">
            <Input
              placeholder="Search ingredients..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
        <TabsContent value="all" className="space-y-4" id="inventory-table">
          <InventoryTable ingredients={filteredIngredients} />
        </TabsContent>
        <TabsContent value="low" className="space-y-4">
          <InventoryTable ingredients={lowStockIngredients} />
        </TabsContent>
        <TabsContent value="usage" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Ingredient Usage</CardTitle>
              <CardDescription>Consumption over the last 30 days</CardDescription>
            </CardHeader>
            <CardContent className="pl-2">
              <IngredientUsageChart ingredients={state.ingredients.slice(0, 10)} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
