"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useMenu } from "@/context/MenuContext"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Loader2, Search, ShoppingCart } from "lucide-react"
import { CreateOrderForm } from "@/components/orders/create-order-form"
import { FoodCard } from "@/components/food-card"
import { CategoryFilter } from "@/components/category-filter"
import { useCart } from "@/context/CartContext"
import type { MenuItem, MenuCategory } from "@/types"

export default function NewOrderPage() {
  const router = useRouter()
  const { state: menuState, fetchMenuItems } = useMenu()
  const { state: cartState, addItem } = useCart()
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<MenuCategory>("all")
  const [addingId, setAddingId] = useState<string | null>(null)

  useEffect(() => {
    const loadData = async () => {
      try {
        await fetchMenuItems()
      } catch (error) {
        console.error("Error loading menu data:", error)
        setLoadError(error instanceof Error ? error.message : "Could not load menu")
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [fetchMenuItems])

  const filteredItems = menuState.items.filter((item) => {
    // Never offer 86'd / unavailable items as orderable — kernel would reject on addLine.
    if (item.available === false) {
      return false
    }
    // Filter by category
    if (selectedCategory !== "all" && item.category !== selectedCategory) {
      return false
    }

    // Filter by search query
    if (searchQuery) {
      const searchLower = searchQuery.toLowerCase()
      return item.title.toLowerCase().includes(searchLower) || item.description.toLowerCase().includes(searchLower)
    }

    return true
  })

  const handleItemClick = async (item: MenuItem) => {
    // Quick-add: single tap rings the item (modifiers handled in cart edit).
    // Previously a no-op — taps went nowhere.
    if (addingId) return
    setAddingId(item.id)
    try {
      await addItem(item, 1, [])
    } catch {
      // CartContext already surfaces rejection with recovery actions; swallow here
      // to avoid double-toasting.
    } finally {
      setAddingId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center" role="status" aria-label="Loading menu">
        <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
        <span className="sr-only">Loading menu…</span>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8" role="alert">
        <p className="font-medium">Could not load the menu</p>
        <p className="text-sm text-muted-foreground">{loadError}</p>
        <Button onClick={() => { setLoading(true); setLoadError(null); fetchMenuItems().catch((e) => setLoadError(e instanceof Error ? e.message : "Could not load menu")).finally(() => setLoading(false)) }}>
          Try again
        </Button>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col md:flex-row">
      <div className="flex-1 overflow-auto p-4">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-3xl font-bold tracking-tight">New Order</h2>
          <Button onClick={() => router.push("/dashboard/orders")}>
            <ShoppingCart className="mr-2 h-4 w-4" />
            Cart ({cartState.items.length})
          </Button>
        </div>

        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center">
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
          <CategoryFilter
            categories={menuState.categories}
            selectedCategory={selectedCategory}
            onCategoryChange={setSelectedCategory}
          />
        </div>

        <Tabs defaultValue="grid">
          <TabsList className="mb-4">
            <TabsTrigger value="grid">Grid View</TabsTrigger>
            <TabsTrigger value="list">List View</TabsTrigger>
          </TabsList>

          <TabsContent value="grid" className="space-y-4">
            {filteredItems.length > 0 ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {filteredItems.map((item) => (
                  <FoodCard
                    key={item.id}
                    title={item.title}
                    description={item.description}
                    price={item.price}
                    image={item.image}
                    type={item.type}
                    onClick={() => handleItemClick(item)}
                  />
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="flex h-40 flex-col items-center justify-center gap-2">
                  <p className="text-muted-foreground">{searchQuery || selectedCategory !== "all" ? "No items match these filters" : "No sellable items right now — check the menu board"}</p>
                  {(searchQuery || selectedCategory !== "all") && (
                    <Button variant="outline" size="sm" onClick={() => { setSearchQuery(""); setSelectedCategory("all") }}>
                      Clear filters
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="list" className="space-y-4">
            {filteredItems.length > 0 ? (
              <div className="space-y-2">
                {filteredItems.map((item) => (
                  <Card key={item.id} className="overflow-hidden">
                    <CardContent className="flex items-center gap-4 p-4">
                      <div
                        className="h-16 w-16 rounded-md bg-cover bg-center bg-no-repeat"
                        style={{ backgroundImage: `url(${item.image})` }}
                      />
                      <div className="flex-1">
                        <h3 className="font-medium">{item.title}</h3>
                        <p className="line-clamp-1 text-sm text-muted-foreground">{item.description}</p>
                        <div className="mt-1 flex items-center justify-between">
                          <span className="font-medium">${item.price.toFixed(2)}</span>
                          <Button size="lg" className="min-h-[44px]" disabled={addingId === item.id} onClick={() => handleItemClick(item)}>
                            {addingId === item.id ? "Adding…" : "Add to Order"}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="flex h-40 flex-col items-center justify-center gap-2">
                  <p className="text-muted-foreground">{searchQuery || selectedCategory !== "all" ? "No items match these filters" : "No sellable items right now — check the menu board"}</p>
                  {(searchQuery || selectedCategory !== "all") && (
                    <Button variant="outline" size="sm" onClick={() => { setSearchQuery(""); setSelectedCategory("all") }}>
                      Clear filters
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <div className="w-full border-t md:w-[400px] md:border-l md:border-t-0">
        <CreateOrderForm />
      </div>
    </div>
  )
}
