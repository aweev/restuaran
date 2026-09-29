"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { useOrder } from "@/context/OrderContext"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "@/components/ui/use-toast"
import { OrderItemList } from "@/components/orders/order-item-list"
import { OrderStatusTimeline } from "@/components/orders/order-status-timeline"
import { PaymentForm } from "@/components/orders/payment-form"
import { OrderReceipt } from "@/components/orders/order-receipt"
import { OrderEditForm } from "@/components/orders/order-edit-form"
import { OrderSocketIntegration } from "@/components/orders/order-socket-integration"
import { Loader2, Printer, ArrowLeft, Edit, Ban, Clock } from "lucide-react"
import { formatDistanceToNow, format } from "date-fns"
import type { Order, OrderStatus } from "@/types"

export default function OrderDetailsPage() {
  const params = useParams()
  const router = useRouter()
  const { state, fetchOrders, updateOrderStatus, cancelOrder } = useOrder()
  const [loading, setLoading] = useState(true)
  const [order, setOrder] = useState<Order | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)
  const [isProcessingStatusUpdate, setIsProcessingStatusUpdate] = useState(false)

  const orderId = params.id as string

  useEffect(() => {
    const loadOrder = async () => {
      try {
        await fetchOrders()
        setLoading(false)
      } catch (error) {
        console.error("Error loading order:", error)
        toast({
          title: "Error",
          description: "Failed to load order details",
          variant: "destructive",
        })
        setLoading(false)
      }
    }

    loadOrder()
  }, [fetchOrders, orderId])

  useEffect(() => {
    if (!loading) {
      const foundOrder = state.orders.find((o) => o.id === orderId)
      setOrder(foundOrder || null)

      if (!foundOrder) {
        toast({
          title: "Error",
          description: "Order not found",
          variant: "destructive",
        })
      }
    }
  }, [loading, state.orders, orderId])

  const getNextStatus = (currentStatus: OrderStatus): OrderStatus | null => {
    const statusFlow: OrderStatus[] = ["pending", "preparing", "ready", "delivered", "completed"]
    const currentIndex = statusFlow.indexOf(currentStatus)

    if (currentIndex < 0 || currentIndex === statusFlow.length - 1) {
      return null
    }

    return statusFlow[currentIndex + 1]
  }

  const handleStatusUpdate = async () => {
    if (!order) return

    const nextStatus = getNextStatus(order.status)
    if (!nextStatus) return

    setIsProcessingStatusUpdate(true)

    try {
      await updateOrderStatus(order.id, nextStatus)
      toast({
        title: "Success",
        description: `Order status updated to ${nextStatus}`,
      })
    } catch (error) {
      console.error("Error updating order status:", error)
      toast({
        title: "Error",
        description: "Failed to update order status",
        variant: "destructive",
      })
    } finally {
      setIsProcessingStatusUpdate(false)
    }
  }

  const handleCancelOrder = async () => {
    if (!order) return

    if (!window.confirm("Are you sure you want to cancel this order? This action cannot be undone.")) {
      return
    }

    setIsCancelling(true)

    try {
      await cancelOrder(order.id)
      toast({
        title: "Success",
        description: "Order cancelled successfully",
      })
    } catch (error) {
      console.error("Error cancelling order:", error)
      toast({
        title: "Error",
        description: "Failed to cancel order",
        variant: "destructive",
      })
    } finally {
      setIsCancelling(false)
    }
  }

  const handlePrintReceipt = () => {
    if (!order) return

    const printWindow = window.open("", "_blank")
    if (printWindow) {
      printWindow.document.write("<html><head><title>Order Receipt</title>")
      printWindow.document.write("<style>")
      printWindow.document.write(`
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
        .receipt { max-width: 300px; margin: 0 auto; }
        .header { text-align: center; margin-bottom: 20px; }
        .items { margin-bottom: 20px; }
        .item { margin-bottom: 10px; }
        .totals { border-top: 1px dashed #ccc; padding-top: 10px; }
        .total-row { display: flex; justify-content: space-between; }
        .footer { text-align: center; margin-top: 20px; font-size: 12px; }
      `)
      printWindow.document.write("</style></head><body>")
      printWindow.document.write('<div class="receipt">')

      // Header
      printWindow.document.write('<div class="header">')
      printWindow.document.write("<h2>Restaurant POS</h2>")
      printWindow.document.write(`<p>Order #${order.id.substring(0, 8)}</p>`)
      printWindow.document.write(`<p>${format(new Date(order.createdAt), "PPpp")}</p>`)
      printWindow.document.write(
        `<p>${order.diningMode} - ${order.tableId ? `Table ${order.table?.number}` : "Takeaway"}</p>`,
      )
      if (order.customerName) {
        printWindow.document.write(`<p>Customer: ${order.customerName}</p>`)
      }
      printWindow.document.write("</div>")

      // Items
      printWindow.document.write('<div class="items">')
      order.items.forEach((item) => {
        printWindow.document.write('<div class="item">')
        printWindow.document.write(`<div>${item.quantity}x ${item.title}</div>`)
        printWindow.document.write(`<div>$${item.totalPrice.toFixed(2)}</div>`)
        if (item.specialInstructions) {
          printWindow.document.write(`<div><small>Note: ${item.specialInstructions}</small></div>`)
        }
        printWindow.document.write("</div>")
      })
      printWindow.document.write("</div>")

      // Totals
      printWindow.document.write('<div class="totals">')
      printWindow.document.write('<div class="total-row">')
      printWindow.document.write("<span>Subtotal:</span>")
      printWindow.document.write(`<span>$${order.subtotal.toFixed(2)}</span>`)
      printWindow.document.write("</div>")
      printWindow.document.write('<div class="total-row">')
      printWindow.document.write("<span>Tax:</span>")
      printWindow.document.write(`<span>$${order.tax.toFixed(2)}</span>`)
      printWindow.document.write("</div>")
      if (order.discount > 0) {
        printWindow.document.write('<div class="total-row">')
        printWindow.document.write("<span>Discount:</span>")
        printWindow.document.write(`<span>-$${order.discount.toFixed(2)}</span>`)
        printWindow.document.write("</div>")
      }
      printWindow.document.write('<div class="total-row" style="font-weight: bold">')
      printWindow.document.write("<span>Total:</span>")
      printWindow.document.write(`<span>$${order.total.toFixed(2)}</span>`)
      printWindow.document.write("</div>")
      printWindow.document.write("</div>")

      // Payment info
      if (order.payments && order.payments.length > 0) {
        printWindow.document.write('<div class="payments">')
        printWindow.document.write("<h3>Payments</h3>")
        order.payments.forEach((payment) => {
          printWindow.document.write('<div class="total-row">')
          printWindow.document.write(`<span>${payment.method.toUpperCase()}:</span>`)
          printWindow.document.write(`<span>$${payment.amount.toFixed(2)}</span>`)
          printWindow.document.write("</div>")
        })
        printWindow.document.write("</div>")
      }

      // Footer
      printWindow.document.write('<div class="footer">')
      printWindow.document.write("<p>Thank you for your order!</p>")
      printWindow.document.write("</div>")

      printWindow.document.write("</div></body></html>")
      printWindow.document.close()
      printWindow.print()
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!order) {
    return (
      <div className="flex h-full flex-col items-center justify-center">
        <h2 className="text-2xl font-bold">Order not found</h2>
        <p className="text-muted-foreground">The order you&apos;re looking for doesn&apos;t exist or has been deleted.</p>
        <Button className="mt-4" onClick={() => router.push("/dashboard/orders")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Orders
        </Button>
      </div>
    )
  }

  if (isEditing) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={() => setIsEditing(false)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Order Details
          </Button>
        </div>
        <OrderEditForm order={order} onCancel={() => setIsEditing(false)} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* WebSocket integration */}
      <OrderSocketIntegration orderId={orderId} />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => router.push("/dashboard/orders")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <h2 className="text-3xl font-bold tracking-tight">Order #{order.id.substring(0, 8)}</h2>
          <Badge
            variant="outline"
            className={
              order.status === "pending"
                ? "bg-yellow-100 text-yellow-800"
                : order.status === "preparing"
                  ? "bg-blue-100 text-blue-800"
                  : order.status === "ready"
                    ? "bg-green-100 text-green-800"
                    : order.status === "delivered"
                      ? "bg-purple-100 text-purple-800"
                      : order.status === "completed"
                        ? "bg-green-100 text-green-800"
                        : "bg-red-100 text-red-800"
            }
          >
            {order.status}
          </Badge>
        </div>
        <div className="flex gap-2">
          {order.status !== "cancelled" && order.status !== "completed" && (
            <>
              <Button variant="outline" onClick={() => setIsEditing(true)}>
                <Edit className="mr-2 h-4 w-4" />
                Edit Order
              </Button>
              <Button variant="destructive" onClick={handleCancelOrder} disabled={isCancelling}>
                <Ban className="mr-2 h-4 w-4" />
                {isCancelling ? "Cancelling..." : "Cancel Order"}
              </Button>
            </>
          )}
          <Button variant="outline" onClick={handlePrintReceipt}>
            <Printer className="mr-2 h-4 w-4" />
            Print Receipt
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Clock className="h-4 w-4" />
        <span>Created {formatDistanceToNow(new Date(order.createdAt), { addSuffix: true })}</span>
        <span>•</span>
        <span>{format(new Date(order.createdAt), "PPpp")}</span>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="md:col-span-2">
          <Tabs defaultValue="details">
            <TabsList>
              <TabsTrigger value="details">Order Details</TabsTrigger>
              <TabsTrigger value="timeline">Status Timeline</TabsTrigger>
              <TabsTrigger value="receipt">Receipt</TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Order Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground">Dining Mode</h4>
                      <p>{order.diningMode}</p>
                    </div>
                    {order.tableId && (
                      <div>
                        <h4 className="text-sm font-medium text-muted-foreground">Table</h4>
                        <p>Table {order.table?.number}</p>
                      </div>
                    )}
                    {order.customerName && (
                      <div>
                        <h4 className="text-sm font-medium text-muted-foreground">Customer</h4>
                        <p>{order.customerName}</p>
                      </div>
                    )}
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground">Server</h4>
                      <p>{order.serverId}</p>
                    </div>
                  </div>

                  {order.notes && (
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground">Notes</h4>
                      <p className="text-sm">{order.notes}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Order Items</CardTitle>
                </CardHeader>
                <CardContent>
                  <OrderItemList items={order.items} editable={false} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Order Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Subtotal:</span>
                      <span>${order.subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Tax:</span>
                      <span>${order.tax.toFixed(2)}</span>
                    </div>
                    {order.discount > 0 && (
                      <div className="flex justify-between text-red-500">
                        <span>Discount:</span>
                        <span>-${order.discount.toFixed(2)}</span>
                      </div>
                    )}
                    <Separator />
                    <div className="flex justify-between font-bold">
                      <span>Total:</span>
                      <span>${order.total.toFixed(2)}</span>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex justify-between">
                  <div>
                    <Badge variant={order.isPaid ? "default" : "secondary"}>{order.isPaid ? "Paid" : "Unpaid"}</Badge>
                  </div>
                  {getNextStatus(order.status) && (
                    <Button onClick={handleStatusUpdate} disabled={isProcessingStatusUpdate}>
                      {isProcessingStatusUpdate ? "Updating..." : `Mark as ${getNextStatus(order.status)}`}
                    </Button>
                  )}
                </CardFooter>
              </Card>
            </TabsContent>

            <TabsContent value="timeline">
              <Card>
                <CardHeader>
                  <CardTitle>Order Timeline</CardTitle>
                </CardHeader>
                <CardContent>
                  <OrderStatusTimeline order={order} />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="receipt">
              <Card>
                <CardHeader>
                  <CardTitle>Order Receipt</CardTitle>
                </CardHeader>
                <CardContent>
                  <OrderReceipt order={order} />
                </CardContent>
                <CardFooter>
                  <Button variant="outline" className="w-full" onClick={handlePrintReceipt}>
                    <Printer className="mr-2 h-4 w-4" />
                    Print Receipt
                  </Button>
                </CardFooter>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        <div>
          <Card>
            <CardHeader>
              <CardTitle>Payment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {order.payments.length > 0 ? (
                <div className="space-y-2">
                  {order.payments.map((payment, index) => (
                    <div key={index} className="flex justify-between items-center">
                      <div>
                        <p className="font-medium capitalize">{payment.method}</p>
                        <p className="text-xs text-muted-foreground">{format(new Date(payment.timestamp), "PPpp")}</p>
                      </div>
                      <p className="font-medium">${payment.amount.toFixed(2)}</p>
                    </div>
                  ))}
                  <Separator />
                  <div className="flex justify-between">
                    <p>Total Paid:</p>
                    <p className="font-bold">${order.payments.reduce((sum, p) => sum + p.amount, 0).toFixed(2)}</p>
                  </div>
                  {!order.isPaid && (
                    <div className="flex justify-between text-red-500">
                      <p>Remaining:</p>
                      <p className="font-bold">
                        ${(order.total - order.payments.reduce((sum, p) => sum + p.amount, 0)).toFixed(2)}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-center text-muted-foreground">No payments recorded</p>
              )}
            </CardContent>
            {!order.isPaid && order.status !== "cancelled" && (
              <CardFooter>
                <PaymentForm
                  orderId={order.id}
                  totalDue={order.total}
                  totalPaid={order.payments.reduce((sum, p) => sum + p.amount, 0)}
                />
              </CardFooter>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
