"use client"

import { useState } from "react"
import { useKitchen } from "@/context/KitchenContext"
import { ScrollArea } from "@/components/ui/scroll-area"
import { KitchenOrderCard } from "@/components/kitchen/kitchen-order-card"
import { KitchenOrderDetails } from "@/components/kitchen/kitchen-order-details"
import { Button } from "@/components/ui/button"
import { Clock, Filter } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { Order, OrderStatus } from "@/types"

interface KitchenOrderQueueProps {
  orders: Order[]
  status: OrderStatus
}

type SortOption = "time" | "priority" | "table"

export function KitchenOrderQueue({ orders }: KitchenOrderQueueProps) {
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [sortBy, setSortBy] = useState<SortOption>("time")
  const { state } = useKitchen()

  // Calculate estimated preparation time for an order
  const calculatePrepTime = (order: Order): number => {
    let totalTime = 0

    for (const item of order.items) {
      const itemPrepTime = state.preparationTimes[item.menuItemId] || 5 // Default to 5 minutes if not set
      totalTime = Math.max(totalTime, itemPrepTime * item.quantity)
    }

    return totalTime
  }

  // Sort orders based on selected sort option
  const sortedOrders = [...orders].sort((a, b) => {
    switch (sortBy) {
      case "time":
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      case "priority":
        // Priority based on preparation time and wait time
        const aWaitTime = (Date.now() - new Date(a.createdAt).getTime()) / 60000 // in minutes
        const bWaitTime = (Date.now() - new Date(b.createdAt).getTime()) / 60000 // in minutes
        const aPrepTime = calculatePrepTime(a)
        const bPrepTime = calculatePrepTime(b)
        const aPriority = aWaitTime / aPrepTime
        const bPriority = bWaitTime / bPrepTime
        return bPriority - aPriority // Higher priority first
      case "table":
        // Sort by table number if available, otherwise by customer name
        if (a.tableId && b.tableId) {
          return a.tableId.localeCompare(b.tableId)
        } else if (a.tableId) {
          return -1
        } else if (b.tableId) {
          return 1
        } else {
          return (a.customerName || "").localeCompare(b.customerName || "")
        }
      default:
        return 0
    }
  })

  const handleSelectOrder = (order: Order) => {
    setSelectedOrder(order)
  }

  const handleCloseDetails = () => {
    setSelectedOrder(null)
  }

  return (
    <div className="relative h-full">
      <div className="flex items-center justify-between border-b p-2">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            {orders.length} {orders.length === 1 ? "order" : "orders"}
          </span>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm">
              <Filter className="mr-2 h-4 w-4" />
              Sort
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuRadioGroup value={sortBy} onValueChange={(value) => setSortBy(value as SortOption)}>
              <DropdownMenuRadioItem value="time">Time Received</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="priority">Priority</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="table">Table Number</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {orders.length === 0 ? (
        <div className="flex h-40 items-center justify-center">
          <p className="text-sm text-muted-foreground">No orders</p>
        </div>
      ) : (
        <ScrollArea className="h-[calc(100vh-20rem)]">
          <div className="space-y-2 p-2">
            {sortedOrders.map((order) => (
              <KitchenOrderCard
                key={order.id}
                order={order}
                onSelect={() => handleSelectOrder(order)}
                prepTime={calculatePrepTime(order)}
              />
            ))}
          </div>
        </ScrollArea>
      )}

      {selectedOrder && (
        <KitchenOrderDetails
          order={selectedOrder}
          onClose={handleCloseDetails}
          prepTime={calculatePrepTime(selectedOrder)}
        />
      )}
    </div>
  )
}
