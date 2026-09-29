"use client"

import type { Order } from "@/types"
import { Badge } from "@/components/ui/badge"
import { formatDistanceToNow } from "date-fns"

interface RecentOrdersProps {
  orders: Order[]
}

export function RecentOrders({ orders }: RecentOrdersProps) {
  if (orders.length === 0) {
    return <p className="text-sm text-muted-foreground">No recent orders</p>
  }

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

  return (
    <div className="space-y-4">
      {orders.map((order) => (
        <div key={order.id} className="flex items-center justify-between border-b pb-2">
          <div className="space-y-1">
            <p className="text-sm font-medium">
              {order.tableId ? `Table ${order.table?.number}` : order.customerName || "Takeaway"}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(order.createdAt), { addSuffix: true })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={getStatusColor(order.status)}>
              {order.status}
            </Badge>
            <span className="font-medium">${order.total.toFixed(2)}</span>
          </div>
        </div>
      ))}
    </div>
  )
}
