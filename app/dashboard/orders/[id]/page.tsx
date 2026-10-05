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
import { useCommand } from "@/kernel/react/kernel-provider"
import { printReceipt } from "@/components/pos/receipt"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function OrderDetailsPage() {
  const params = useParams()
  const router = useRouter()
  const { state, fetchOrders, updateOrderStatus, cancelOrder } = useOrder()
  const [loading, setLoading] = useState(true)
  const [order, setOrder] = useState<Order | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)
  const [isProcessingStatusUpdate, setIsProcessingStatusUpdate] = useState(false)
  const [ways, setWays] = useState(2)
  const [splitPaid, setSplitPaid] = useState<boolean[]>([])
  const [cashTendered, setCashTendered] = useState("")
  const { run } = useCommand()

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
    printReceipt(order, Number(cashTendered) || undefined)
  }

  const handleSplit = async () => {
    if (!order) return
    const n = Math.max(2, Math.min(12, Math.floor(ways) || 2))
    const result = await run("order.split", { orderId: order.id, ways: n })
    if (result.success) {
      setSplitPaid(new Array(n).fill(false))
      toast({ title: "Success", description: `Check split ${n} ways (${(order.total / n).toFixed(2)} each)` })
    } else {
      toast({ title: "Error", description: result.error?.message ?? "Split rejected", variant: "destructive" })
    }
  }

  const changeDue = cashTendered ? (Number(cashTendered) || 0) - (order?.total ?? 0) : null

  // Thermal-printer receipt via window.print (ESC/POS-friendly HTML).
  const handlePrintReceiptThermal = () => {
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
      printWindow.document.write("<h2>Maison Chili POS</h2>")
      printWindow.document.write(`<p>Order #${order.id.substring(0, 8)}</p>`)
      printWindow.document.write(`<p>${format(new Date(order.createdAt), "PPpp")}</p>`)

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

              <Card>
                <CardHeader>
                  <CardTitle>Split check</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-end gap-2">
                    <div>
                      <Label htmlFor="split-ways">Split ways</Label>
                      <Input id="split-ways" type="number" min={2} max={12} value={ways} onChange={(e) => setWays(Number(e.target.value))} className="w-24" />
                    </div>
                    <Button size="sm" variant="outline" onClick={() => void handleSplit()}>
                      Split {Math.max(2, Math.min(12, Math.floor(ways) || 2))} ways
                    </Button>
                    {order && (
                      <span className="text-sm text-muted-foreground">
                        ${(order.total / Math.max(2, Math.min(12, Math.floor(ways) || 2))).toFixed(2)} each
                      </span>
                    )}
                  </div>
                  {splitPaid.length > 0 && order && (
                    <ul className="space-y-1">
                      {splitPaid.map((paid, i) => (
                        <li key={i} className="flex items-center justify-between rounded-md border px-2 py-1 text-sm">
                          <span>Seat {i + 1} — ${(order.total / splitPaid.length).toFixed(2)}</span>
                          <Button size="sm" variant={paid ? "default" : "outline"} onClick={() => setSplitPaid((p) => p.map((v, j) => (j === i ? !v : v)))}>
                            {paid ? "Paid" : "Record payment"}
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Change due</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-end gap-2">
                    <div>
                      <Label htmlFor="cash-tendered">Cash tendered</Label>
                      <Input id="cash-tendered" type="number" min={0} step={0.01} value={cashTendered} onChange={(e) => setCashTendered(e.target.value)} className="w-32" placeholder={order.total.toFixed(2)} />
                    </div>
                    {changeDue !== null && (
                      <p className="text-sm font-semibold" aria-live="polite">
                        Change: ${Math.max(0, changeDue).toFixed(2)}
                        {changeDue < 0 && <span className="ml-2 font-normal text-destructive">(short ${Math.abs(changeDue).toFixed(2)})</span>}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={handlePrintReceipt}>
                      <Printer className="mr-2 h-4 w-4" /> Receipt (PDF)
                    </Button>
                    <Button size="sm" variant="outline" onClick={handlePrintReceiptThermal} title="Thermal / ESC-POS printers">
                      <Printer className="mr-2 h-4 w-4" /> Receipt (thermal)
                    </Button>
                  </div>
                </CardContent>
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
