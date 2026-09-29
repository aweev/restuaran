"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Progress } from "@/components/ui/progress"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { format, differenceInMinutes } from "date-fns"
import { Clock, AlertTriangle } from "lucide-react"
import { useOrder } from "@/context/OrderContext"
import type { Table } from "@/types"

interface TableServiceTrackerProps {
  tables: Table[]
}

export function TableServiceTracker({ tables }: TableServiceTrackerProps) {
  const { state: orderState } = useOrder()
  const [currentTime, setCurrentTime] = useState(new Date())
  const [selectedTable, setSelectedTable] = useState<Table | null>(null)
  const [, setIsDetailsOpen] = useState(false)

  // Update current time every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date())
    }, 60000)

    return () => clearInterval(interval)
  }, [])

  // Get occupied tables with their orders
  const occupiedTables = tables
    .filter((table) => table.status === "occupied")
    .map((table) => {
      const tableOrders = orderState.orders.filter(
        (order) => order.tableId === table.id && ["pending", "preparing", "ready"].includes(order.status),
      )

      return {
        ...table,
        orders: tableOrders,
        serviceTime: table.startTime ? differenceInMinutes(currentTime, new Date(table.startTime)) : 0,
      }
    })
    .sort((a, b) => b.serviceTime - a.serviceTime)

  // Get service time status
  const getServiceTimeStatus = (minutes: number) => {
    if (minutes < 30) return "normal"
    if (minutes < 60) return "medium"
    return "long"
  }

  // Get service time color
  const getServiceTimeColor = (status: string) => {
    switch (status) {
      case "normal":
        return "bg-green-100 text-green-800"
      case "medium":
        return "bg-yellow-100 text-yellow-800"
      case "long":
        return "bg-red-100 text-red-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  // Format service time
  const formatServiceTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60

    if (hours > 0) {
      return `${hours}h ${mins}m`
    }

    return `${mins}m`
  }

  // Get order status color
  const getOrderStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-100 text-yellow-800"
      case "preparing":
        return "bg-blue-100 text-blue-800"
      case "ready":
        return "bg-green-100 text-green-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  // Calculate order progress
  const calculateOrderProgress = (order: { createdAt: string; items: unknown[] }) => {
    const createdAt = new Date(order.createdAt)
    const now = new Date()

    // Estimate total preparation time based on number of items (2 minutes per item)
    const estimatedPrepTime = Math.max(5, order.items.length * 2)

    // Calculate elapsed time in minutes
    const elapsedMinutes = differenceInMinutes(now, createdAt)

    // Calculate progress percentage (capped at 100%)
    return Math.min(100, Math.round((elapsedMinutes / estimatedPrepTime) * 100))
  }

  return (
    <div className="space-y-4">
      <ScrollArea className="h-[500px]">
        {occupiedTables.length === 0 ? (
          <div className="flex h-32 items-center justify-center text-muted-foreground">
            No tables currently occupied
          </div>
        ) : (
          <div className="space-y-2">
            {occupiedTables.map((table) => {
              const serviceTimeStatus = getServiceTimeStatus(table.serviceTime)

              return (
                <Card
                  key={table.id}
                  className={`border-l-4 ${
                    serviceTimeStatus === "long"
                      ? "border-l-red-500"
                      : serviceTimeStatus === "medium"
                        ? "border-l-yellow-500"
                        : "border-l-green-500"
                  }`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium">Table {table.number}</h4>
                          <Badge variant="outline" className={getServiceTimeColor(serviceTimeStatus)}>
                            {formatServiceTime(table.serviceTime)}
                          </Badge>
                          {serviceTimeStatus === "long" && <AlertTriangle className="h-4 w-4 text-red-500" />}
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <span>{table.customerName}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span>{table.customerCount} guests</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            <span>
                              Seated at {table.startTime ? format(new Date(table.startTime), "h:mm a") : "N/A"}
                            </span>
                          </div>
                        </div>

                        {table.orders.length > 0 && (
                          <div className="mt-2 space-y-2">
                            {table.orders.map((order) => (
                              <div key={order.id} className="flex items-center gap-2">
                                <Badge variant="outline" className={getOrderStatusColor(order.status)}>
                                  {order.status}
                                </Badge>
                                <Progress value={calculateOrderProgress(order)} className="h-2 w-24" />
                                <span className="text-xs text-muted-foreground">{order.items.length} items</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <div>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              variant="outline"
                              onClick={() => {
                                setSelectedTable(table)
                                setIsDetailsOpen(true)
                              }}
                            >
                              Details
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-3xl">
                            <DialogHeader>
                              <DialogTitle>Table {table.number} Service Details</DialogTitle>
                            </DialogHeader>

                            {selectedTable && (
                              <Tabs defaultValue="timeline" className="w-full">
                                <TabsList className="grid w-full grid-cols-3">
                                  <TabsTrigger value="timeline">Service Timeline</TabsTrigger>
                                  <TabsTrigger value="orders">Orders</TabsTrigger>
                                  <TabsTrigger value="actions">Service Actions</TabsTrigger>
                                </TabsList>

                                <TabsContent value="timeline" className="space-y-4 py-4">
                                  <div className="relative pl-6 pb-10">
                                    <div className="absolute left-0 top-0 bottom-0 w-px bg-border"></div>

                                    {/* Seated */}
                                    <div className="relative mb-8">
                                      <div className="absolute -left-2 top-1 h-4 w-4 rounded-full bg-primary"></div>
                                      <div className="font-medium">Customer Seated</div>
                                      <div className="text-sm text-muted-foreground">
                                        {table.startTime ? format(new Date(table.startTime), "h:mm a") : "N/A"}
                                      </div>
                                    </div>

                                    {/* Orders */}
                                    {table.orders.map((order, index) => (
                                      <div key={order.id} className="relative mb-8">
                                        <div className="absolute -left-2 top-1 h-4 w-4 rounded-full bg-primary"></div>
                                        <div className="font-medium">Order #{index + 1} Placed</div>
                                        <div className="text-sm text-muted-foreground">
                                          {format(new Date(order.createdAt), "h:mm a")}
                                        </div>
                                        <div className="mt-2 flex items-center gap-2">
                                          <Badge variant="outline" className={getOrderStatusColor(order.status)}>
                                            {order.status}
                                          </Badge>
                                          <span className="text-sm text-muted-foreground">
                                            {order.items.length} items
                                          </span>
                                        </div>
                                      </div>
                                    ))}

                                    {/* Current time */}
                                    <div className="relative">
                                      <div className="absolute -left-2 top-1 h-4 w-4 rounded-full bg-muted"></div>
                                      <div className="font-medium">Current Time</div>
                                      <div className="text-sm text-muted-foreground">
                                        {format(currentTime, "h:mm a")}
                                      </div>
                                    </div>
                                  </div>
                                </TabsContent>

                                <TabsContent value="orders" className="space-y-4 py-4">
                                  {table.orders.length === 0 ? (
                                    <div className="text-center text-muted-foreground py-8">No orders placed yet</div>
                                  ) : (
                                    <div className="space-y-4">
                                      {table.orders.map((order, index) => (
                                        <Card key={order.id}>
                                          <CardContent className="p-4">
                                            <div className="flex items-center justify-between mb-2">
                                              <h4 className="font-medium">Order #{index + 1}</h4>
                                              <Badge variant="outline" className={getOrderStatusColor(order.status)}>
                                                {order.status}
                                              </Badge>
                                            </div>

                                            <div className="text-sm text-muted-foreground mb-4">
                                              Placed at {format(new Date(order.createdAt), "h:mm a")}
                                            </div>

                                            <div className="space-y-2">
                                              {order.items.map((item, itemIndex) => (
                                                <div key={itemIndex} className="flex justify-between">
                                                  <div>
                                                    <span>{item.quantity}x </span>
                                                    <span className="font-medium">{item.title}</span>
                                                    {item.specialInstructions && (
                                                      <div className="text-xs text-muted-foreground">
                                                        Note: {item.specialInstructions}
                                                      </div>
                                                    )}
                                                  </div>
                                                  <div>${(item.totalPrice / 100).toFixed(2)}</div>
                                                </div>
                                              ))}
                                            </div>

                                            <div className="mt-4 pt-4 border-t flex justify-between font-medium">
                                              <span>Total</span>
                                              <span>${(order.total / 100).toFixed(2)}</span>
                                            </div>
                                          </CardContent>
                                        </Card>
                                      ))}
                                    </div>
                                  )}
                                </TabsContent>

                                <TabsContent value="actions" className="space-y-4 py-4">
                                  <div className="grid grid-cols-2 gap-4">
                                    <Button className="w-full">Request Server Assistance</Button>
                                    <Button className="w-full">Mark Course Delivered</Button>
                                    <Button className="w-full">Add Service Note</Button>
                                    <Button className="w-full">Request Check</Button>
                                    <Button className="w-full" variant="destructive">
                                      Mark Table as Problem
                                    </Button>
                                    <Button className="w-full" variant="outline">
                                      Print Service Timeline
                                    </Button>
                                  </div>
                                </TabsContent>
                              </Tabs>
                            )}
                          </DialogContent>
                        </Dialog>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  )
}
