"use client"

import type React from "react"

import { useState } from "react"
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd"
import { Clock, CheckCircle, AlertCircle, ChefHat, Truck } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { useOrder } from "@/context/OrderContext"
import type { Order } from "@/types"

type OrderStatus = "pending" | "preparing" | "ready" | "delivered" | "cancelled"

interface OrderColumn {
  id: OrderStatus
  title: string
  icon: React.ElementType
  orders: Order[]
}

export function DragDropOrderManager() {
  const { orders, updateOrderStatus } = useOrder()

  // Group orders by status
  const initialColumns: OrderColumn[] = [
    {
      id: "pending",
      title: "Pending",
      icon: Clock,
      orders: orders.filter((order) => order.status === "pending"),
    },
    {
      id: "preparing",
      title: "Preparing",
      icon: ChefHat,
      orders: orders.filter((order) => order.status === "preparing"),
    },
    {
      id: "ready",
      title: "Ready",
      icon: CheckCircle,
      orders: orders.filter((order) => order.status === "ready"),
    },
    {
      id: "delivered",
      title: "Delivered",
      icon: Truck,
      orders: orders.filter((order) => order.status === "delivered"),
    },
    {
      id: "cancelled",
      title: "Cancelled",
      icon: AlertCircle,
      orders: orders.filter((order) => order.status === "cancelled"),
    },
  ]

  const [columns, setColumns] = useState<OrderColumn[]>(initialColumns)

  const handleDragEnd = async (result: DropResult) => {
    const { source, destination, draggableId } = result

    // Dropped outside a valid drop target
    if (!destination) return

    // No change in position
    if (source.droppableId === destination.droppableId && source.index === destination.index) return

    // Find the source and destination columns
    const sourceColumn = columns.find((col) => col.id === source.droppableId)
    const destColumn = columns.find((col) => col.id === destination.droppableId)

    if (!sourceColumn || !destColumn) return

    // Create new arrays for the columns
    const sourceOrders = [...sourceColumn.orders]
    const destOrders = source.droppableId === destination.droppableId ? sourceOrders : [...destColumn.orders]

    // Remove from source
    const [movedOrder] = sourceOrders.splice(source.index, 1)

    // Add to destination
    destOrders.splice(destination.index, 0, movedOrder)

    // Update columns state
    setColumns(
      columns.map((col) => {
        if (col.id === source.droppableId) {
          return { ...col, orders: sourceOrders }
        }
        if (col.id === destination.droppableId) {
          return { ...col, orders: destOrders }
        }
        return col
      }),
    )

    // Update order status in the backend
    if (source.droppableId !== destination.droppableId) {
      try {
        await updateOrderStatus(draggableId, destination.droppableId as OrderStatus)
      } catch (error) {
        console.error("Failed to update order status:", error)
        // Revert the UI change if the API call fails
        setColumns(initialColumns)
      }
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Order Management</h2>
      <p className="text-muted-foreground">Drag and drop orders to change their status</p>

      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {columns.map((column) => (
            <div key={column.id} className="flex flex-col">
              <div className="mb-2 flex items-center gap-2">
                <column.icon className="h-5 w-5" />
                <h3 className="font-medium">{column.title}</h3>
                <Badge variant="outline">{column.orders.length}</Badge>
              </div>
              <Droppable droppableId={column.id}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={cn(
                      "flex flex-1 flex-col gap-2 rounded-md border p-2",
                      snapshot.isDraggingOver && "bg-muted",
                    )}
                  >
                    {column.orders.map((order, index) => (
                      <Draggable key={order.id} draggableId={order.id} index={index}>
                        {(provided, snapshot) => (
                          <Card
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            className={cn("cursor-grab border", snapshot.isDragging && "shadow-lg")}
                          >
                            <CardHeader className="p-3">
                              <CardTitle className="text-sm">Order #{order.orderNumber}</CardTitle>
                            </CardHeader>
                            <CardContent className="p-3 pt-0">
                              <div className="text-xs text-muted-foreground">
                                {order.items.length} items · ${order.total.toFixed(2)}
                              </div>
                              <div className="mt-1 text-xs">Table: {order.tableNumber || "Takeout"}</div>
                            </CardContent>
                          </Card>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                    {column.orders.length === 0 && (
                      <div className="flex h-20 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
                        No orders
                      </div>
                    )}
                  </div>
                )}
              </Droppable>
            </div>
          ))}
        </div>
      </DragDropContext>
    </div>
  )
}
