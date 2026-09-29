"use client"

import { useState } from "react"
import { useOrder } from "@/context/OrderContext"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { formatDistanceToNow } from "date-fns"
import { Clock, AlertCircle, ChefHat, CheckCircle } from "lucide-react"
import type { Order } from "@/types"

interface KitchenOrderCardProps {
  order: Order
  onSelect: () => void
  prepTime: number
}

export function KitchenOrderCard({ order, onSelect, prepTime }: KitchenOrderCardProps) {
  const { updateOrderStatus } = useOrder()
  const [isUpdating, setIsUpdating] = useState(false)

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100"
      case "preparing":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100"
      case "ready":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100"
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100"
    }
  }

  const getNextStatus = (currentStatus: string) => {
    switch (currentStatus) {
      case "pending":
        return "preparing"
      case "preparing":
        return "ready"
      default:
        return null
    }
  }

  const getNextStatusLabel = (currentStatus: string) => {
    switch (currentStatus) {
      case "pending":
        return "Start Preparing"
      case "preparing":
        return "Mark Ready"
      default:
        return "Update Status"
    }
  }

  const getNextStatusIcon = (currentStatus: string) => {
    switch (currentStatus) {
      case "pending":
        return <ChefHat className="mr-2 h-4 w-4" />
      case "preparing":
        return <CheckCircle className="mr-2 h-4 w-4" />
      default:
        return null
    }
  }

  const handleStatusUpdate = async () => {
    const nextStatus = getNextStatus(order.status)
    if (!nextStatus) return

    setIsUpdating(true)
    try {
      await updateOrderStatus(order.id, nextStatus)
    } catch (error) {
      console.error("Error updating order status:", error)
    } finally {
      setIsUpdating(false)
    }
  }

  // Calculate how long the order has been in its current status
  const orderAge = formatDistanceToNow(new Date(order.updatedAt), { addSuffix: false })

  // Calculate if the order is urgent based on wait time vs prep time
  const waitTimeMinutes = (Date.now() - new Date(order.createdAt).getTime()) / 60000
  const isUrgent = order.status === "pending" && waitTimeMinutes > prepTime * 0.5
  const isCritical = order.status === "pending" && waitTimeMinutes > prepTime * 0.8

  // Calculate progress for preparing orders
  const progress = order.status === "preparing" ? Math.min(100, Math.round((waitTimeMinutes / prepTime) * 100)) : 0

  return (
    <Card
      className={`cursor-pointer transition-all hover:shadow-md ${
        isCritical
          ? "border-red-500 bg-red-50 dark:bg-red-950/20"
          : isUrgent
            ? "border-orange-300 bg-orange-50 dark:bg-orange-950/20"
            : ""
      }`}
      onClick={onSelect}
    >
      <CardHeader className="p-3 pb-0">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">
            {order.tableId ? `Table ${order.tableId}` : order.customerName || "Takeaway"}
          </h3>
          <Badge variant="outline" className={getStatusColor(order.status)}>
            {order.status}
          </Badge>
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span>{orderAge}</span>
          {isUrgent && (
            <span className={`ml-2 flex items-center ${isCritical ? "text-red-500" : "text-orange-500"}`}>
              <AlertCircle className="mr-1 h-3 w-3" />
              {isCritical ? "Critical" : "Urgent"}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-3">
        <div className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span>Items: {order.items.length}</span>
            <span>Est. prep: {prepTime} min</span>
          </div>

          {order.status === "preparing" && (
            <div className="space-y-1">
              <Progress value={progress} className="h-2" />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Started</span>
                <span>{progress}% complete</span>
              </div>
            </div>
          )}

          {order.items.slice(0, 2).map((item, index) => (
            <div key={index} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${item.type === "Veg" ? "bg-green-500" : "bg-red-500"}`}></span>
                <span className="truncate">{item.title}</span>
              </div>
              <span className="font-medium">x{item.quantity}</span>
            </div>
          ))}

          {order.items.length > 2 && (
            <div className="text-xs text-muted-foreground">+{order.items.length - 2} more items</div>
          )}

          {order.notes && (
            <div className="mt-2 rounded-md bg-amber-50 p-1.5 text-xs dark:bg-amber-950/30">
              <p className="font-medium">Notes:</p>
              <p className="text-muted-foreground">{order.notes}</p>
            </div>
          )}
        </div>
      </CardContent>
      <CardFooter className="p-3 pt-0">
        {getNextStatus(order.status) && (
          <Button
            className="w-full"
            onClick={(e) => {
              e.stopPropagation()
              handleStatusUpdate()
            }}
            disabled={isUpdating}
            variant={isCritical ? "destructive" : isUrgent ? "default" : "outline"}
            size="sm"
          >
            {getNextStatusIcon(order.status)}
            {isUpdating ? "Updating..." : getNextStatusLabel(order.status)}
          </Button>
        )}
      </CardFooter>
    </Card>
  )
}
