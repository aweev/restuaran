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
  const { state: cartState } = useCart()
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<MenuCategory>("all")

  useEffect(() => {
    const loadData = async () => {
      try {
        await fetchMenuItems()
      } catch (error) {
        console.error("Error loading menu data:", error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [fetchMenuItems])

  const filteredItems = menuState.items.filter((item) => {
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

  const handleItemClick = (_item: MenuItem) => {
    // This would open the item customization modal
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
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
                <CardContent className="flex h-40 items-center justify-center">
                  <p className="text-muted-foreground">No menu items found</p>
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
                          <Button size="sm" onClick={() => handleItemClick(item)}>
                            Add to Order
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="flex h-40 items-center justify-center">
                  <p className="text-muted-foreground">No menu items found</p>
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
