"use client"

import { useEffect, useState } from "react"
import { useMenu } from "@/context/MenuContext"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { MenuItemCard } from "@/components/menu/menu-item-card"
import { Loader2, Plus, Search } from "lucide-react"
import type { MenuCategory } from "@/types"

export default function MenuPage() {
  const { state, fetchMenu, setSelectedCategory } = useMenu()
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")

  useEffect(() => {
    const loadData = async () => {
      try {
        await fetchMenu()
      } catch (error) {
        console.error("Error loading menu data:", error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [fetchMenu])

  const handleCategoryChange = (category: MenuCategory) => {
    setSelectedCategory(category)
  }

  const filteredItems = state.items.filter((item) => {
    // Filter by category
    if (state.selectedCategory !== "all" && item.category.toLowerCase() !== state.selectedCategory) {
      return false
    }

    // Filter by search query
    if (searchQuery && !item.title.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false
    }

    return true
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
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Menu Management</h2>
        <Button>
          <Plus className="mr-2 h-4 w-4" /> Add Item
        </Button>
      </div>

      <div className="flex items-center space-x-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search menu items..."
            className="pl-8"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <Tabs defaultValue="all" onValueChange={(value) => handleCategoryChange(value as MenuCategory)}>
        <TabsList className="mb-4 flex flex-wrap">
          {state.categories.map((category) => (
            <TabsTrigger key={category.id} value={category.id}>
              {category.label} ({category.items})
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={state.selectedCategory} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredItems.length > 0 ? (
              filteredItems.map((item) => <MenuItemCard key={item.id} menuItem={item} />)
            ) : (
              <Card className="col-span-full">
                <CardContent className="flex h-40 items-center justify-center">
                  <p className="text-muted-foreground">No menu items found</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
