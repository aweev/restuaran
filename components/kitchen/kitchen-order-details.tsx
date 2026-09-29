"use client"

import { useState } from "react"
import { useOrder } from "@/context/OrderContext"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { formatDistanceToNow, format } from "date-fns"
import { Clock, AlertCircle, ChefHat, CheckCircle, X } from "lucide-react"
import type { Order } from "@/types"

interface KitchenOrderDetailsProps {
  order: Order
  onClose: () => void
  prepTime: number
}

export function KitchenOrderDetails({ order, onClose, prepTime }: KitchenOrderDetailsProps) {
  const { updateOrderStatus, updateOrderNotes } = useOrder()
  const [isUpdating, setIsUpdating] = useState(false)
  const [notes, setNotes] = useState(order.notes || "")

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

  const handleStatusUpdate = async () => {
    const nextStatus = getNextStatus(order.status)
    if (!nextStatus) return

    setIsUpdating(true)
    try {
      await updateOrderStatus(order.id, nextStatus)
      onClose()
    } catch (error) {
      console.error("Error updating order status:", error)
    } finally {
      setIsUpdating(false)
    }
  }

  const handleSaveNotes = async () => {
    setIsUpdating(true)
    try {
      await updateOrderNotes(order.id, notes)
    } catch (error) {
      console.error("Error updating order notes:", error)
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

  return (
    <Dialog open={true} onOpenChange={() => onClose()}>
      <DialogContent className="max-h-[90vh] overflow-auto sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span>Order Details</span>
              <Badge variant="outline" className={getStatusColor(order.status)}>
                {order.status}
              </Badge>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h4 className="text-sm font-medium text-muted-foreground">Order ID</h4>
              <p className="font-mono text-sm">{order.id.substring(0, 8)}</p>
            </div>
            <div>
              <h4 className="text-sm font-medium text-muted-foreground">Table</h4>
              <p>{order.tableId ? `Table ${order.tableId}` : "N/A"}</p>
            </div>
            <div>
              <h4 className="text-sm font-medium text-muted-foreground">Customer</h4>
              <p>{order.customerName || "Anonymous"}</p>
            </div>
            <div>
              <h4 className="text-sm font-medium text-muted-foreground">Dining Mode</h4>
              <p>{order.diningMode}</p>
            </div>
            <div>
              <h4 className="text-sm font-medium text-muted-foreground">Created</h4>
              <p className="text-sm">{format(new Date(order.createdAt), "MMM d, h:mm a")}</p>
            </div>
            <div>
              <h4 className="text-sm font-medium text-muted-foreground">Wait Time</h4>
              <p className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                <span>{orderAge}</span>
                {isUrgent && (
                  <span className={`ml-1 flex items-center ${isCritical ? "text-red-500" : "text-orange-500"}`}>
                    <AlertCircle className="mr-1 h-3 w-3" />
                    {isCritical ? "Critical" : "Urgent"}
                  </span>
                )}
              </p>
            </div>
          </div>

          <Separator />

          <div>
            <h4 className="mb-2 font-medium">Order Items</h4>
            <div className="space-y-3">
              {order.items.map((item, index) => (
                <div key={index} className="rounded-md border p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className={`h-3 w-3 rounded-full ${item.type === "Veg" ? "bg-green-500" : "bg-red-500"}`}
                      ></span>
                      <span className="font-medium">{item.title}</span>
                    </div>
                    <span>x{item.quantity}</span>
                  </div>

                  {item.specialInstructions && (
                    <div className="mt-2 rounded-md bg-amber-50 p-2 text-sm dark:bg-amber-950/30">
                      <p className="font-medium">Special Instructions:</p>
                      <p className="text-muted-foreground">{item.specialInstructions}</p>
                    </div>
                  )}

                  {item.modifiers && item.modifiers.length > 0 && (
                    <div className="mt-2">
                      <p className="text-sm font-medium">Modifiers:</p>
                      <ul className="ml-4 list-disc text-sm text-muted-foreground">
                        {item.modifiers.map((mod, idx) => (
                          <li key={idx}>
                            {mod.modifierId}: {mod.optionIds.join(", ")}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <Separator />

          <div>
            <h4 className="mb-2 font-medium">Kitchen Notes</h4>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add notes for the kitchen staff..."
              className="min-h-[100px]"
            />
            <Button
              onClick={handleSaveNotes}
              disabled={isUpdating || notes === order.notes}
              className="mt-2"
              variant="outline"
              size="sm"
            >
              Save Notes
            </Button>
          </div>
        </div>

        <DialogFooter>
          {getNextStatus(order.status) && (
            <Button
              onClick={handleStatusUpdate}
              disabled={isUpdating}
              variant={isCritical ? "destructive" : isUrgent ? "default" : "outline"}
              className="w-full"
            >
              {order.status === "pending" ? (
                <ChefHat className="mr-2 h-4 w-4" />
              ) : (
                <CheckCircle className="mr-2 h-4 w-4" />
              )}
              {isUpdating ? "Updating..." : order.status === "pending" ? "Start Preparing" : "Mark as Ready"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
