"use client"

import { useState } from "react"
import type { Order } from "@/types"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useOrder } from "@/context/OrderContext"
import { formatDistanceToNow } from "date-fns"
import { ChevronRight, Clock } from "lucide-react"
import { useRouter } from "next/navigation"

interface OrderCardProps {
  order: Order
}

export function OrderCard({ order }: OrderCardProps) {
  const { updateOrderStatus } = useOrder()
  const [isUpdating, setIsUpdating] = useState(false)
  const router = useRouter()

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-100 text-yellow-800"
      case "preparing":
        return "bg-blue-100 text-blue-800"
      case "ready":
        return "bg-green-100 text-green-800"
      case "delivered":
        return "bg-purple-100 text-purple-800"
      case "completed":
        return "bg-green-100 text-green-800"
      case "cancelled":
        return "bg-red-100 text-red-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const getNextStatus = (currentStatus: string) => {
    switch (currentStatus) {
      case "pending":
        return "preparing"
      case "preparing":
        return "ready"
      case "ready":
        return "delivered"
      case "delivered":
        return "completed"
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

  const handleViewDetails = () => {
    router.push(`/dashboard/orders/${order.id}`)
  }

  return (
    <Card>
      <CardHeader className="p-4 pb-0">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">
            {order.tableId ? `Table ${order.table?.number}` : order.customerName || "Takeaway"}
          </h3>
          <Badge variant="outline" className={getStatusColor(order.status)}>
            {order.status}
          </Badge>
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span>{formatDistanceToNow(new Date(order.createdAt), { addSuffix: true })}</span>
        </div>
      </CardHeader>
      <CardContent className="p-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm">Items:</span>
            <span className="font-medium">{order.items.length}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">Subtotal:</span>
            <span className="font-medium">${order.subtotal.toFixed(2)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">Tax:</span>
            <span className="font-medium">${order.tax.toFixed(2)}</span>
          </div>
          {order.discount > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-sm">Discount:</span>
              <span className="font-medium text-red-500">-${order.discount.toFixed(2)}</span>
            </div>
          )}
          <div className="flex items-center justify-between border-t pt-2">
            <span className="font-medium">Total:</span>
            <span className="font-bold text-green-600">${order.total.toFixed(2)}</span>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between p-4 pt-0">
        <Button variant="outline" size="sm" onClick={handleViewDetails}>
          View Details <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
        {getNextStatus(order.status) && (
          <Button size="sm" onClick={handleStatusUpdate} disabled={isUpdating}>
            {isUpdating ? "Updating..." : `Mark as ${getNextStatus(order.status)}`}
          </Button>
        )}
      </CardFooter>
    </Card>
  )
}
