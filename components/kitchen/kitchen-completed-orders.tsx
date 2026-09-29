"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { format } from "date-fns"
import { Search, MoreVertical, Eye, FileText, Clock } from "lucide-react"
import { KitchenOrderDetails } from "@/components/kitchen/kitchen-order-details"
import type { Order } from "@/types"

interface KitchenCompletedOrdersProps {
  orders: Order[]
}

export function KitchenCompletedOrders({ orders }: KitchenCompletedOrdersProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)

  // Filter orders based on search query
  const filteredOrders = orders.filter((order) => {
    const searchLower = searchQuery.toLowerCase()
    return (
      order.id.toLowerCase().includes(searchLower) ||
      (order.customerName && order.customerName.toLowerCase().includes(searchLower)) ||
      (order.tableId && order.tableId.toLowerCase().includes(searchLower))
    )
  })

  // Calculate preparation time for an order (time between pending and ready)
  const calculatePrepTime = (order: Order): string => {
    // This is a simplified calculation - in a real system you would track status change timestamps
    const createdTime = new Date(order.createdAt).getTime()
    const updatedTime = new Date(order.updatedAt).getTime()
    const diffMinutes = Math.round((updatedTime - createdTime) / 60000)

    return `${diffMinutes} min`
  }

  const handleViewOrder = (order: Order) => {
    setSelectedOrder(order)
  }

  const handleCloseDetails = () => {
    setSelectedOrder(null)
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xl">Completed Orders</CardTitle>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search orders..."
              className="pl-8"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order ID</TableHead>
                <TableHead>Customer/Table</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Completed At</TableHead>
                <TableHead>Prep Time</TableHead>
                <TableHead>Items</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center">
                    No completed orders found
                  </TableCell>
                </TableRow>
              ) : (
                filteredOrders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-mono text-xs">{order.id.substring(0, 8)}</TableCell>
                    <TableCell>{order.tableId ? `Table ${order.tableId}` : order.customerName || "Takeaway"}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          order.status === "completed"
                            ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100"
                            : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100"
                        }
                      >
                        {order.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{format(new Date(order.updatedAt), "MMM d, h:mm a")}</TableCell>
                    <TableCell className="flex items-center gap-1">
                      <Clock className="h-3 w-3 text-muted-foreground" />
                      {calculatePrepTime(order)}
                    </TableCell>
                    <TableCell>{order.items.length}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleViewOrder(order)}>
                            <Eye className="mr-2 h-4 w-4" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <FileText className="mr-2 h-4 w-4" />
                            Print Ticket
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      {selectedOrder && (
        <KitchenOrderDetails
          order={selectedOrder}
          onClose={handleCloseDetails}
          prepTime={10} // Default value since it's already completed
        />
      )}
    </Card>
  )
}
