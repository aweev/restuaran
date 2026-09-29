"use client"

import { useEffect, useState } from "react"
import { useOrder } from "@/context/OrderContext"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { OrderCard } from "@/components/orders/order-card"
import { Loader2, Plus, Search } from "lucide-react"
import type { OrderStatus } from "@/types"

export default function OrdersPage() {
  const { state, fetchOrders } = useOrder()
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "all">("all")

  useEffect(() => {
    const loadData = async () => {
      try {
        await fetchOrders()
      } catch (error) {
        console.error("Error loading orders data:", error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [fetchOrders])

  const filteredOrders = state.orders.filter((order) => {
    // Filter by status
    if (statusFilter !== "all" && order.status !== statusFilter) {
      return false
    }

    // Filter by search query (customer name or table number)
    if (searchQuery) {
      const searchLower = searchQuery.toLowerCase()
      const customerNameMatch = order.customerName?.toLowerCase().includes(searchLower)
      const tableMatch = order.table?.number?.toLowerCase().includes(searchLower)

      if (!customerNameMatch && !tableMatch) {
        return false
      }
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
        <h2 className="text-3xl font-bold tracking-tight">Orders</h2>
        <Button>
          <Plus className="mr-2 h-4 w-4" /> New Order
        </Button>
      </div>

      <div className="flex items-center space-x-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search by customer or table..."
            className="pl-8"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <Tabs defaultValue="all" onValueChange={(value) => setStatusFilter(value as OrderStatus | "all")}>
        <TabsList className="mb-4">
          <TabsTrigger value="all">All Orders</TabsTrigger>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="preparing">Preparing</TabsTrigger>
          <TabsTrigger value="ready">Ready</TabsTrigger>
          <TabsTrigger value="delivered">Delivered</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
          <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
        </TabsList>

        <TabsContent value={statusFilter} className="space-y-4">
          {filteredOrders.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredOrders.map((order) => (
                <OrderCard key={order.id} order={order} />
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="flex h-40 items-center justify-center">
                <p className="text-muted-foreground">No orders found</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
