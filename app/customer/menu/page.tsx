"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { useMenu } from "@/context/MenuContext"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import { Info, Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { CustomerMenuItemCard } from "@/components/customer/customer-menu-item-card"
import { CustomerHeader } from "@/components/customer/customer-header"
import { CustomerFooter } from "@/components/customer/customer-footer"
import { CustomerCartButton } from "@/components/customer/customer-cart-button"
import type { MenuItem, MenuCategory } from "@/types"

export default function CustomerMenuPage() {
  const searchParams = useSearchParams()
  const tableNumber = searchParams.get("table")
  const { state: menuState, fetchMenuItems } = useMenu()
  const [selectedCategory, setSelectedCategory] = useState<MenuCategory>("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [dietary, setDietary] = useState<"all" | "veg" | "nonveg">("all")
  const [filteredItems, setFilteredItems] = useState<MenuItem[]>([])
  const [cartCount, setCartCount] = useState(0)

  useEffect(() => {
    fetchMenuItems()

    // Get cart count from localStorage
    const cart = localStorage.getItem("customerCart")
    if (cart) {
      try {
        const parsedCart = JSON.parse(cart)
        setCartCount(parsedCart.items.length)
      } catch (error) {
        console.error("Error parsing cart from localStorage", error)
      }
    }
  }, [fetchMenuItems])

  useEffect(() => {
    if (menuState.items.length > 0) {
      let items = menuState.items

      // Filter by category
      if (selectedCategory !== "all") {
        items = items.filter((item) => item.category === selectedCategory)
      }

      // Filter by search query
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        items = items.filter(
          (item) => item.title.toLowerCase().includes(query) || item.description.toLowerCase().includes(query),
        )
      }

      // Filter by dietary preference (uses MenuItem.type Veg/NonVeg)
      if (dietary !== "all") {
        items = items.filter((item) =>
          dietary === "veg" ? item.type === "Veg" : item.type !== "Veg",
        )
      }

      // Hide unsellable items (86'd / unavailable) — kernel policy is source of truth
      items = items.filter((item) => (item as { available?: boolean }).available !== false)

      setFilteredItems(items)
    }
  }, [menuState.items, selectedCategory, searchQuery, dietary])

  const handleCartUpdate = (count: number) => {
    setCartCount(count)
  }

  return (
    <div className="flex flex-col min-h-screen">
      <CustomerHeader tableNumber={tableNumber} />

      <main className="flex-1 container max-w-lg mx-auto px-4 py-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">Our Menu</h1>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" size="icon">
                  <Info className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>About Our Menu</DialogTitle>
                  <DialogDescription>
                    Browse our menu and add items to your cart. When you&apos;re ready, you can place your order directly
                    from your device.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-green-50 text-green-700 hover:bg-green-50">
                      Veg
                    </Badge>
                    <span className="text-sm">Vegetarian dishes</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-red-50 text-red-700 hover:bg-red-50">
                      Non Veg
                    </Badge>
                    <span className="text-sm">Non-vegetarian dishes</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">Popular</Badge>
                    <span className="text-sm">Our most ordered items</span>
                  </div>
                  <Separator />
                  <p className="text-sm text-muted-foreground">
                    If you have any allergies or dietary requirements, please inform our staff before placing your
                    order.
                  </p>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search menu..."
              className="pl-8"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="flex gap-2" role="group" aria-label="Dietary preference">
            {(["all", "veg", "nonveg"] as const).map((d) => (
              <Button key={d} variant={dietary === d ? "default" : "outline"} size="sm" onClick={() => setDietary(d)} className="min-h-[40px]">
                {d === "all" ? "All" : d === "veg" ? "Veg" : "Non-veg"}
              </Button>
            ))}
          </div>

          <Tabs
            defaultValue="all"
            value={selectedCategory}
            onValueChange={(value) => setSelectedCategory(value as MenuCategory)}
          >
            <ScrollArea className="w-full">
              <TabsList className="w-auto inline-flex p-1">
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="breakfast">Breakfast</TabsTrigger>
                <TabsTrigger value="soups">Soups</TabsTrigger>
                <TabsTrigger value="pasta">Pasta</TabsTrigger>
                <TabsTrigger value="main">Main Course</TabsTrigger>
                <TabsTrigger value="burgers">Burgers</TabsTrigger>
                <TabsTrigger value="desserts">Desserts</TabsTrigger>
                <TabsTrigger value="drinks">Drinks</TabsTrigger>
                <TabsTrigger value="sides">Sides</TabsTrigger>
              </TabsList>
            </ScrollArea>

            <TabsContent value={selectedCategory} className="mt-4">
              {menuState.loading ? (
                <div className="space-y-4">
                  {[1, 2, 3, 4].map((i) => (
                    <Card key={i} className="animate-pulse">
                      <CardContent className="p-0">
                        <div className="h-40 bg-muted rounded-t-lg" />
                        <div className="p-4 space-y-2">
                          <div className="h-5 bg-muted rounded w-3/4" />
                          <div className="h-4 bg-muted rounded w-1/2" />
                          <div className="h-4 bg-muted rounded w-1/4" />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : filteredItems.length > 0 ? (
                <div className="space-y-4">
                  {filteredItems.map((item) => (
                    <CustomerMenuItemCard
                      key={item.id}
                      item={item}
                      tableNumber={tableNumber || undefined}
                      onCartUpdate={handleCartUpdate}
                    />
                  ))}
                </div>
              ) : (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-8">
                    <p className="text-center text-muted-foreground">No items found</p>
                    {searchQuery && (
                      <Button variant="link" onClick={() => setSearchQuery("")} className="mt-2">
                        Clear search
                      </Button>
                    )}
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </main>

      <CustomerFooter />

      {cartCount > 0 && <CustomerCartButton count={cartCount} tableNumber={tableNumber || undefined} />}
    </div>
  )
}
