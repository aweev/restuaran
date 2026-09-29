"use client"

import { useEffect, useState } from "react"
import { useOrder } from "@/context/OrderContext"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Loader2, RefreshCw } from "lucide-react"
import { KitchenOrderCard } from "@/components/kitchen/kitchen-order-card"
import { KitchenSocketIntegration } from "@/components/kitchen/kitchen-socket-integration"
import type { Order, OrderStatus } from "@/types"

export default function KitchenPage() {
  const { state, fetchOrders } = useOrder()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [activeTab, setActiveTab] = useState<OrderStatus | "all">("pending")

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

    // Set up polling for real-time updates
    const interval = setInterval(() => {
      fetchOrders().catch((error) => {
        console.error("Error refreshing orders:", error)
      })
    }, 30000) // Refresh every 30 seconds

    return () => clearInterval(interval)
  }, [fetchOrders])

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await fetchOrders()
    } catch (error) {
      console.error("Error refreshing orders:", error)
    } finally {
      setRefreshing(false)
    }
  }

  // Filter orders for kitchen display
  const getFilteredOrders = (status: OrderStatus | "all"): Order[] => {
    if (status === "all") {
      return state.activeOrders.filter((order) => ["pending", "preparing", "ready"].includes(order.status))
    }
    return state.orders.filter((order) => order.status === status)
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  const pendingOrders = getFilteredOrders("pending")
  const preparingOrders = getFilteredOrders("preparing")
  const readyOrders = getFilteredOrders("ready")

  return (
    <div className="space-y-4">
      {/* WebSocket integration */}
      <KitchenSocketIntegration />

      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Kitchen Display</h2>
        <Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
          <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          {refreshing ? "Refreshing..." : "Refresh"}
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <Badge variant="outline" className="bg-yellow-100 text-yellow-800">
          Pending: {pendingOrders.length}
        </Badge>
        <Badge variant="outline" className="bg-blue-100 text-blue-800">
          Preparing: {preparingOrders.length}
        </Badge>
        <Badge variant="outline" className="bg-green-100 text-green-800">
          Ready: {readyOrders.length}
        </Badge>
      </div>

      <Tabs defaultValue="pending" onValueChange={(value) => setActiveTab(value as OrderStatus | "all")}>
        <TabsList>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="preparing">Preparing</TabsTrigger>
          <TabsTrigger value="ready">Ready</TabsTrigger>
          <TabsTrigger value="all">All Active</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          {getFilteredOrders(activeTab).length > 0 ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {getFilteredOrders(activeTab).map((order) => (
                <KitchenOrderCard 
                  key={order.id} 
                  order={order} 
                  onSelect={() => console.log(`Order selected: ${order.id}`)} 
                  prepTime={order.prepTime || 0} 
                />
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="flex h-40 items-center justify-center">
                <p className="text-muted-foreground">No {activeTab} orders</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
