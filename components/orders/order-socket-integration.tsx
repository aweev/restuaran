"use client"

import { useEffect } from "react"
import { useAuth } from "@/context/AuthContext"
import { useOrder } from "@/context/OrderContext"
import { toast } from "@/components/ui/use-toast"
import { initializeSocket, joinRoom, leaveRoom, useSocketEvents } from "@/lib/socket-client"

interface OrderSocketIntegrationProps {
  orderId: string
}

export function OrderSocketIntegration({ orderId }: OrderSocketIntegrationProps) {
  const { state: authState } = useAuth()
  const { fetchOrders } = useOrder()

  // Initialize socket when component mounts
  useEffect(() => {
    if (authState.isAuthenticated && authState.accessToken) {
      // Connecting the socket is a side effect of the lib; the instance itself is not needed here.
      initializeSocket(authState.accessToken)

      // Join the order-specific room
      joinRoom(`order:${orderId}`)

      return () => {
        // Leave the room when component unmounts
        leaveRoom(`order:${orderId}`)
      }
    }
  }, [authState.isAuthenticated, authState.accessToken, orderId])

  // Listen for order events
  const events = useSocketEvents([
    "order_updated",
    "order_cancelled",
    "payment_added",
    "order_ready",
    "order_preparing",
  ])

  // Handle events
  useEffect(() => {
    if (events.length > 0) {
      // Get the latest event
      // Shape of the socket payloads this component reacts to. `useSocketEvents`
      // returns the broad `SocketEvent` union, so narrow it once here rather than
      // carrying `any` through the switch below.
      const latestEvent = events[events.length - 1] as unknown as {
        type: string
        data?: { amount?: number | string }
      }

      // Handle different event types
      switch (latestEvent.type) {
        case "order_updated":
          toast({
            title: "Order Updated",
            description: "The order has been updated",
          })
          fetchOrders()
          break
        case "order_cancelled":
          toast({
            title: "Order Cancelled",
            description: "The order has been cancelled",
            variant: "destructive",
          })
          fetchOrders()
          break
        case "payment_added":
          toast({
            title: "Payment Added",
            description: `A payment of $${latestEvent.data?.amount ? Number(latestEvent.data.amount).toFixed(2) : '0.00'} has been added`,
          })
          fetchOrders()
          break
        case "order_ready":
          toast({
            title: "Order Ready",
            description: "The order is ready for pickup/delivery",
            variant: "default",
          })
          fetchOrders()
          break
        case "order_preparing":
          toast({
            title: "Order Preparing",
            description: "The kitchen has started preparing the order",
          })
          fetchOrders()
          break
      }
    }
  }, [events, fetchOrders])

  // This component doesn't render anything
  return null
}
