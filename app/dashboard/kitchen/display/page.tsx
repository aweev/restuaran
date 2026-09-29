"use client"

import { useState, useEffect } from "react"
import { useOrder } from "@/context/OrderContext"
import { useKitchen } from "@/context/KitchenContext"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { RefreshCw, Volume2, VolumeX } from "lucide-react"
import { KitchenOrderQueue } from "@/components/kitchen/kitchen-order-queue"
import { KitchenCompletedOrders } from "@/components/kitchen/kitchen-completed-orders"
import { KitchenPerformanceMetrics } from "@/components/kitchen/kitchen-performance-metrics"
import { KitchenSocketIntegration } from "@/components/kitchen/kitchen-socket-integration"
import { KitchenNotificationSettings } from "@/components/kitchen/kitchen-notification-settings"
import { KitchenStaffAssignment } from "@/components/kitchen/kitchen-staff-assignment"

export default function KitchenDisplayPage() {
  const { state: orderState, fetchOrders } = useOrder()
  const { state: kitchenState, toggleSound } = useKitchen()
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    const loadData = async () => {
      try {
        await fetchOrders()
      } catch (error) {
        console.error("Error loading orders data:", error)
      }
    }

    loadData()

    // Set up polling for real-time updates (as a fallback to WebSockets)
    const interval = setInterval(() => {
      fetchOrders().catch((error) => {
        console.error("Error refreshing orders:", error)
      })
    }, 60000) // Refresh every minute as a fallback

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

  const pendingOrders = orderState.orders.filter((order) => order.status === "pending")
  const preparingOrders = orderState.orders.filter((order) => order.status === "preparing")
  const readyOrders = orderState.orders.filter((order) => order.status === "ready")
  const completedOrders = orderState.orders.filter(
    (order) => order.status === "completed" || order.status === "delivered",
  )

  return (
    <div className="space-y-4">
      {/* WebSocket integration for real-time updates */}
      <KitchenSocketIntegration />

      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Kitchen Display System</h2>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={toggleSound}
            title={kitchenState.soundEnabled ? "Mute notifications" : "Enable sound"}
          >
            {kitchenState.soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </Button>
          <Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Refreshing..." : "Refresh"}
          </Button>
          <KitchenNotificationSettings />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="bg-yellow-50 dark:bg-yellow-950/30">
            <CardTitle className="flex items-center justify-between">
              <span>Pending</span>
              <span className="rounded-full bg-yellow-100 px-2.5 py-0.5 text-sm font-medium text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100">
                {pendingOrders.length}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <KitchenOrderQueue orders={pendingOrders} status="pending" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="bg-blue-50 dark:bg-blue-950/30">
            <CardTitle className="flex items-center justify-between">
              <span>Preparing</span>
              <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-sm font-medium text-blue-800 dark:bg-blue-900 dark:text-blue-100">
                {preparingOrders.length}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <KitchenOrderQueue orders={preparingOrders} status="preparing" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="bg-green-50 dark:bg-green-950/30">
            <CardTitle className="flex items-center justify-between">
              <span>Ready</span>
              <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-sm font-medium text-green-800 dark:bg-green-900 dark:text-green-100">
                {readyOrders.length}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <KitchenOrderQueue orders={readyOrders} status="ready" />
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="staff">
        <TabsList>
          <TabsTrigger value="staff">Staff Assignment</TabsTrigger>
          <TabsTrigger value="completed">Completed Orders</TabsTrigger>
          <TabsTrigger value="metrics">Performance Metrics</TabsTrigger>
        </TabsList>

        <TabsContent value="staff" className="mt-4">
          <KitchenStaffAssignment />
        </TabsContent>

        <TabsContent value="completed" className="mt-4">
          <KitchenCompletedOrders orders={completedOrders} />
        </TabsContent>

        <TabsContent value="metrics" className="mt-4">
          <KitchenPerformanceMetrics />
        </TabsContent>
      </Tabs>
    </div>
  )
}
