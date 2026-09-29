"use client"

import { useEffect, useRef } from "react"
import { useAuth } from "@/context/AuthContext"
import { useOrder } from "@/context/OrderContext"
import { useKitchen } from "@/context/KitchenContext"
import { toast } from "@/components/ui/use-toast"
import { initializeSocket, joinRoom, leaveRoom, useSocketEvents } from "@/lib/socket-client"

export function KitchenSocketIntegration() {
  const { state: authState } = useAuth()
  const { fetchOrders } = useOrder()
  const { state: kitchenState } = useKitchen()
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Initialize audio element
  useEffect(() => {
    audioRef.current = new Audio("/sounds/notification.mp3")
    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
    }
  }, [])

  // Initialize socket when component mounts
  useEffect(() => {
    if (authState.isAuthenticated && authState.token) {
      // Connecting the socket is a side effect of the lib; the instance itself is not needed here.
      initializeSocket(authState.token)

      // Join the kitchen room
      joinRoom("kitchen")

      return () => {
        // Leave the room when component unmounts
        leaveRoom("kitchen")
      }
    }
  }, [authState.isAuthenticated, authState.token])

  // Listen for order events
  const events = useSocketEvents(["order:new", "order:update", "order:cancelled", "order:expedite"])

  // Handle events
  useEffect(() => {
    if (events.length > 0) {
      // Get the latest event
      // Shape of the socket payloads this component reacts to. `useSocketEvents`
      // returns the broad `SocketEvent` union, so narrow it once here rather than
      // carrying `any` through the switch below.
      const latestEvent = events[events.length - 1] as unknown as {
        type: string
        orderId: string
      }

      // Play sound if enabled
      const playSound = () => {
        if (kitchenState.soundEnabled && audioRef.current) {
          audioRef.current.play().catch((error) => {
            console.error("Error playing notification sound:", error)
          })
        }
      }

      // Handle different event types
      switch (latestEvent.type) {
        case "order:new":
          if (kitchenState.notificationSettings.newOrder) {
            toast({
              title: "New Order",
              description: `Order #${latestEvent.orderId.substring(0, 8)} has been created`,
              variant: "default",
            })
            playSound()
          }
          fetchOrders()
          break
        case "order:update":
          if (kitchenState.notificationSettings.orderUpdated) {
            toast({
              title: "Order Updated",
              description: `Order #${latestEvent.orderId.substring(0, 8)} has been updated`,
              variant: "default",
            })
            playSound()
          }
          fetchOrders()
          break
        case "order:cancelled":
          if (kitchenState.notificationSettings.orderCancelled) {
            toast({
              title: "Order Cancelled",
              description: `Order #${latestEvent.orderId.substring(0, 8)} has been cancelled`,
              variant: "destructive",
            })
            playSound()
          }
          fetchOrders()
          break
        case "order:expedite":
          if (kitchenState.notificationSettings.orderExpedite) {
            toast({
              title: "Expedite Order",
              description: `Order #${latestEvent.orderId.substring(0, 8)} needs to be expedited!`,
              variant: "destructive",
            })
            playSound()
          }
          fetchOrders()
          break
      }
    }
  }, [events, fetchOrders, kitchenState.notificationSettings, kitchenState.soundEnabled])

  // This component doesn't render anything
  return null
}
