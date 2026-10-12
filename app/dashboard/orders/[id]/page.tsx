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
import type { Order, OrderStatus, PaymentMethod } from "@/types"
import { useCommand, useKernel } from "@/kernel/react/kernel-provider"
import { printReceipt } from "@/components/pos/receipt"
import { printHtml } from "@/lib/print"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { getVenueSettings, roundCash } from "@/lib/settings"
import { useCart } from "@/context/CartContext"
import type { MenuItem } from "@/types"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export default function OrderDetailsPage() {
  const params = useParams()
  const router = useRouter()
  const { state, fetchOrders, updateOrderStatus, cancelOrder, refundOrder } = useOrder()
  const [loading, setLoading] = useState(true)
  const [order, setOrder] = useState<Order | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)
  const [isRefunding, setIsRefunding] = useState(false)
  const [isProcessingStatusUpdate, setIsProcessingStatusUpdate] = useState(false)
  const [ways, setWays] = useState(2)
  const [splitPaid, setSplitPaid] = useState<boolean[]>([])
  const [splitId, setSplitId] = useState<string | null>(null)
  const [splitBusy, setSplitBusy] = useState<number | null>(null)
  const [splitMethod, setSplitMethod] = useState<PaymentMethod>("cash")
  const [splitting, setSplitting] = useState(false)
  const [splitMode, setSplitMode] = useState<"equal" | "itemized">("equal")
  const [seatMap, setSeatMap] = useState<Record<string, number>>({})
  const [cashTendered, setCashTendered] = useState("")
  const [voidOpen, setVoidOpen] = useState(false)
  const [voidReason, setVoidReason] = useState("")
  const [refundOpen, setRefundOpen] = useState(false)
  const [refundReason, setRefundReason] = useState("")
  const [refundAmount, setRefundAmount] = useState("")
  const { run } = useCommand()
  const { ask } = useKernel()
  const { addItem } = useCart()
  const [trail, setTrail] = useState<{ discounts: { label: string; amount: number; appliedBy: string }[]; tips: { amount: number; splitIndex: number | null }[]; voided: number; comped: number } | null>(null)
  const [gratuityBusy, setGratuityBusy] = useState(false)
  const [reordering, setReordering] = useState(false)

  const orderId = params.id as string
  const splitKey = `pos.split.${orderId}`

  // Persist split progress per order so reload can't double-charge a seat.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(splitKey)
      if (raw) {
        const parsed = JSON.parse(raw) as { splitId?: string; paid?: boolean[]; seatMap?: Record<string, number>; mode?: "equal" | "itemized" }
        if (parsed.splitId) setSplitId(parsed.splitId)
        if (Array.isArray(parsed.paid)) setSplitPaid(parsed.paid)
        if (parsed.seatMap) setSeatMap(parsed.seatMap)
        if (parsed.mode) setSplitMode(parsed.mode)
      }
    } catch { /* private mode */ }
  }, [splitKey])
  useEffect(() => {
    try {
      if (splitId || splitPaid.length > 0) localStorage.setItem(splitKey, JSON.stringify({ splitId, paid: splitPaid, seatMap, mode: splitMode }))
    } catch { /* ignore */ }
  }, [splitId, splitPaid, seatMap, splitMode, splitKey])

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

  // Money trail: full aggregate state carries the discount ledger (who + why),
  // tips, and voided/comped line counts the board collapses to totals.
  useEffect(() => {
    if (!order) return
    let alive = true
    void ask<{ state: { discounts?: { label: string; amount: number; appliedBy: string }[]; tips?: { amount: number; splitIndex: number | null }[]; lines?: { status: string; comped?: boolean }[] } }>("get.order", { orderId: order.id })
      .then((r) => {
        if (!alive || !r.success) return
        const s = r.data.state
        setTrail({
          discounts: (s.discounts ?? []).map((d) => ({ label: d.label, amount: d.amount, appliedBy: d.appliedBy })),
          tips: (s.tips ?? []).map((t) => ({ amount: t.amount, splitIndex: t.splitIndex })),
          voided: (s.lines ?? []).filter((l) => l.status === "voided").length,
          comped: (s.lines ?? []).filter((l) => l.comped).length,
        })
      })
      .catch(() => null)
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ask, order?.id])

  const gratuityRate = getVenueSettings().gratuityRate
  const gratuityBase = order ? Math.max(0, order.subtotal - order.discount) : 0
  const gratuityAmount = Math.round(gratuityBase * gratuityRate * 100) / 100

  const handleGratuity = async () => {
    if (!order || gratuityAmount <= 0 || gratuityBusy) return
    setGratuityBusy(true)
    try {
      const result = await run("order.addTip", { orderId: order.id, amount: gratuityAmount })
      if (result.success) {
        toast({ title: "Gratuity added", description: `${(gratuityRate * 100).toFixed(1)}% service charge ($${gratuityAmount.toFixed(2)}) recorded.` })
        await fetchOrders()
      } else {
        toast({ title: "Gratuity rejected", description: result.error?.message ?? "Rejected", variant: "destructive" })
      }
    } finally {
      setGratuityBusy(false)
    }
  }

  const handleReorder = async () => {
    if (!order || reordering) return
    setReordering(true)
    try {
      for (const line of order.items) {
        const menuItem: MenuItem = {
          id: line.menuItemId,
          title: line.title,
          description: "",
          price: line.price,
          image: line.image || "",
          category: "all",
          type: line.type,
          available: true,
        }
        await addItem(menuItem, line.quantity, [], line.specialInstructions ?? undefined)
      }
      router.push("/dashboard/orders/new")
    } catch {
      toast({ title: "Reorder failed", description: "Some lines are 86'd or unavailable now.", variant: "destructive" })
    } finally {
      setReordering(false)
    }
  }

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
    if (!order || !voidReason.trim()) return
    setIsCancelling(true)

    try {
      await cancelOrder(order.id, voidReason.trim())
      setVoidOpen(false)
      setVoidReason("")
      toast({
        title: "Success",
        description: "Order voided — reason recorded in the audit log.",
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

  const openRefund = () => {
    if (!order) return
    const paid = order.payments.reduce((sum, p) => sum + p.amount, 0)
    if (paid <= 0) {
      toast({ title: "Nothing to refund", description: "No payments recorded on this order." })
      return
    }
    setRefundAmount(paid.toFixed(2))
    setRefundReason("")
    setRefundOpen(true)
  }

  const handleRefund = async () => {
    if (!order) return
    const paid = order.payments.reduce((sum, p) => sum + p.amount, 0)
    const amount = Number(refundAmount) || 0
    if (amount <= 0 || amount > paid) {
      toast({ title: "Check refund amount", description: `Enter 0.01 – ${paid.toFixed(2)} (total paid).`, variant: "destructive" })
      return
    }
    if (!refundReason.trim()) {
      toast({ title: "Reason required", description: "Refunds without a reason are rejected.", variant: "destructive" })
      return
    }
    setIsRefunding(true)
    try {
      await refundOrder(order.id, amount, refundReason.trim())
      setRefundOpen(false)
      setRefundReason("")
      await fetchOrders()
    } catch (e) {
      toast({ title: "Refund failed", description: e instanceof Error ? e.message : "Refund rejected", variant: "destructive" })
    } finally {
      setIsRefunding(false)
    }
  }

  const handlePrintReceipt = () => {
    if (!order) return
    printReceipt(order, Number(cashTendered) || undefined)
  }

  const handleSplit = async () => {
    if (!order || splitting) return
    const paid = order.payments.reduce((sum, p) => sum + p.amount, 0)
    const remaining = order.total - paid
    if (remaining <= 0) {
      toast({ title: "Nothing to split", description: "This check is already fully paid." })
      return
    }
    const n = Math.max(2, Math.min(12, Math.floor(ways) || 2))
    setSplitting(true)
    try {
      // Idempotent split: reuse splitId on retry so double-tap creates one split.
      const id = splitId ?? crypto.randomUUID()
      const result = await run("order.split", { orderId: order.id, ways: n, splitId: id }, { requestId: `split:${order.id}:${id}` })
      if (result.success) {
        setSplitId(id)
        setSplitPaid(new Array(n).fill(false))
        setSeatMap({})
        toast({ title: "Success", description: `Check split ${n} ways (${(remaining / n).toFixed(2)} each of remaining $${remaining.toFixed(2)})` })
      } else {
        toast({ title: "Error", description: result.error?.message ?? "Split rejected", variant: "destructive" })
      }
    } finally {
      setSplitting(false)
    }
  }

  const handleSeatPayment = async (index: number) => {
    if (!order || splitPaid[index] || splitBusy !== null) return
    const paid = order.payments.reduce((sum, p) => sum + p.amount, 0)
    const remaining = order.total - paid
    const seatsLeft = splitPaid.filter((v) => !v).length || 1
    // Remaining-balance guard: never over-collect when seats pay unevenly.
    const perSeat = Math.min(order.total / splitPaid.length, remaining / seatsLeft)
    if (perSeat <= 0) {
      toast({ title: "Nothing due", description: "Remaining balance is already zero." })
      return
    }
    setSplitBusy(index)
    try {
      const result = await run(
        "order.recordPayment",
        { orderId: order.id, method: splitMethod, amount: Math.round(perSeat * 100) / 100, splitIndex: index },
        { requestId: `split-pay:${order.id}:${splitId}:${index}` },
      )
      if (result.success) {
        setSplitPaid((p) => p.map((v, j) => (j === index ? true : v)))
        await fetchOrders()
      } else {
        toast({ title: "Error", description: result.error?.message ?? "Payment rejected", variant: "destructive" })
      }
    } finally {
      setSplitBusy(null)
    }
  }

  // ---- Itemized seats: assign each line to a seat, pay per-seat totals ----
  // Seat totals = line subtotal share, scaled to the order total so tax and
  // discounts ride along proportionally. Payments still record with splitIndex,
  // so the kernel ledger stays split-aware without moving lines between orders.
  const seatOf = (lineId: string) => seatMap[lineId] ?? 0
  const seatSubtotal = (seat: number) => {
    if (!order) return 0
    return order.items.filter((l) => seatOf(l.id) === seat).reduce((s, l) => s + l.totalPrice, 0)
  }
  const seatTotal = (seat: number) => {
    if (!order || splitPaid.length === 0) return 0
    if (order.subtotal <= 0) return order.total / splitPaid.length
    return (order.total * seatSubtotal(seat)) / order.subtotal
  }
  const handleItemizedSeatPayment = async (index: number) => {
    if (!order || splitPaid[index] || splitBusy !== null) return
    const paid = order.payments.reduce((sum, p) => sum + p.amount, 0)
    const remaining = order.total - paid
    if (remaining <= 0) {
      toast({ title: "Nothing due", description: "Remaining balance is already zero." })
      return
    }
    const due = Math.min(Math.round(seatTotal(index) * 100) / 100, Math.round(remaining * 100) / 100)
    if (due <= 0) {
      toast({ title: "Seat is empty", description: `Move some lines to Seat ${index + 1} first.` })
      return
    }
    setSplitBusy(index)
    try {
      const result = await run(
        "order.recordPayment",
        { orderId: order.id, method: splitMethod, amount: due, splitIndex: index },
        { requestId: `split-pay:${order.id}:${splitId}:itemized:${index}` },
      )
      if (result.success) {
        setSplitPaid((p) => p.map((v, j) => (j === index ? true : v)))
        await fetchOrders()
      } else {
        toast({ title: "Error", description: result.error?.message ?? "Payment rejected", variant: "destructive" })
      }
    } finally {
      setSplitBusy(null)
    }
  }

  const roundingIncrement = getVenueSettings().roundingIncrement
  const changeDue = cashTendered ? (Number(cashTendered) || 0) - roundCash(order?.total ?? 0, roundingIncrement) : null
  const cashRounded = roundCash(order?.total ?? 0, roundingIncrement)

  // Thermal receipt via the single print path (lib/print.ts): queued job with
  // retry when the popup is blocked. Same payload a future ESC/POS transport
  // will send to the LAN printer.
  const handlePrintReceiptThermal = async () => {
    if (!order) return
    const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;")
    const items = order.items.map((item) =>
      `<div class="item"><div>${item.quantity}x ${esc(item.title)}</div>` +
      `<div>$${item.totalPrice.toFixed(2)}</div>` +
      (item.specialInstructions ? `<div><small>Note: ${esc(item.specialInstructions)}</small></div>` : "") +
      `</div>`,
    ).join("")
    const payments = (order.payments && order.payments.length > 0)
      ? `<div class="payments"><h3>Payments</h3>` + order.payments.map((p) =>
        `<div class="total-row"><span>${esc(p.method.toUpperCase())}:</span><span>$${p.amount.toFixed(2)}</span></div>`,
      ).join("") + `</div>`
      : ""
    const html =
      `<div class="receipt"><div class="header"><h2>Maison Chili POS</h2>` +
      `<p>Order #${order.id.substring(0, 8)}</p><p>${format(new Date(order.createdAt), "PPpp")}</p></div>` +
      `<div class="items">${items}</div><div class="totals">` +
      `<div class="total-row"><span>Subtotal:</span><span>$${order.subtotal.toFixed(2)}</span></div>` +
      `<div class="total-row"><span>Tax:</span><span>$${order.tax.toFixed(2)}</span></div>` +
      (order.discount > 0 ? `<div class="total-row"><span>Discount:</span><span>-$${order.discount.toFixed(2)}</span></div>` : "") +
      `<div class="total-row" style="font-weight: bold"><span>Total:</span><span>$${order.total.toFixed(2)}</span></div>` +
      (cashRounded !== order.total ? `<div class="total-row"><span>Cash rounded:</span><span>$${cashRounded.toFixed(2)}</span></div>` : "") + `</div>` +
      payments +
      `<div class="footer"><p>Thank you for your order!</p></div></div>`
    const { ok, jobId } = await printHtml(`Order ${order.id.substring(0, 8)}`, html)
    if (!ok) {
      toast({ title: "Print blocked", description: "Receipt queued — allow popups then retry.", variant: "destructive" })
      void jobId
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
                ? "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                : order.status === "preparing"
                  ? "border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-300"
                  : order.status === "ready"
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                    : order.status === "delivered"
                      ? "border-purple-500/40 bg-purple-500/10 text-purple-700 dark:text-purple-300"
                      : order.status === "completed"
                        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                        : "border-destructive/40 bg-destructive/10 text-destructive"
            }
          >
            {order.status}
          </Badge>
        </div>
        <div className="flex gap-2">
          {order.status !== "cancelled" && order.status !== "completed" && (
            <Button variant="outline" size="lg" className="min-h-[44px]" onClick={() => setIsEditing(true)}>
              <Edit className="mr-2 h-4 w-4" />
              Edit Order
            </Button>
          )}
          {(order.status === "completed" || order.status === "cancelled") && order.items.length > 0 && (
            <Button variant="default" size="lg" className="min-h-[44px]" disabled={reordering} onClick={() => void handleReorder()} title="Copy these lines into a new draft order">
              {reordering ? "Copying…" : "Fire again"}
            </Button>
          )}
          <Button variant="outline" size="lg" className="min-h-[44px]" onClick={handlePrintReceipt}>
            <Printer className="mr-2 h-4 w-4" />
            Print Receipt
          </Button>
        </div>
      </div>

      {/* Void + refund dialogs (replaces window.prompt/confirm: tablet-safe, validated, audited) */}
      <AlertDialog open={voidOpen} onOpenChange={setVoidOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Void order #{order.id.substring(0, 8)}?</AlertDialogTitle>
            <AlertDialogDescription>
              Total ${order.total.toFixed(2)} · {order.items.length} line(s). The reason is written to the event log with your name. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="void-reason">Reason (required)</Label>
            <Input id="void-reason" value={voidReason} onChange={(e) => setVoidReason(e.target.value)} placeholder="Wrong item, walkout, duplicate…" autoFocus />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep order</AlertDialogCancel>
            <AlertDialogAction disabled={!voidReason.trim() || isCancelling} onClick={(e) => { e.preventDefault(); void handleCancelOrder() }}>
              {isCancelling ? "Voiding…" : "Void order"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={refundOpen} onOpenChange={setRefundOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Refund from drawer?</AlertDialogTitle>
            <AlertDialogDescription>
              Paid ${order.payments.reduce((s, p) => s + p.amount, 0).toFixed(2)}. Refunds pay out of the open drawer — verify it is open before confirming.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="refund-amount">Amount (max paid)</Label>
              <Input id="refund-amount" type="number" min={0.01} step={0.01} value={refundAmount} onChange={(e) => setRefundAmount(e.target.value)} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="refund-reason">Reason (required)</Label>
              <Input id="refund-reason" value={refundReason} onChange={(e) => setRefundReason(e.target.value)} placeholder="Double-charge, kitchen error…" />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={isRefunding} onClick={(e) => { e.preventDefault(); void handleRefund() }}>
              {isRefunding ? "Recording…" : "Record refund"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
                  <CardTitle>Adjustments & trail</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {!trail ? (
                    <p className="text-muted-foreground">Loading ledger…</p>
                  ) : (
                    <>
                      {trail.discounts.length === 0 && trail.tips.length === 0 && trail.voided === 0 && trail.comped === 0 ? (
                        <p className="text-muted-foreground">No discounts, gratuity, voids or comps on this check.</p>
                      ) : (
                        <ul className="space-y-1">
                          {trail.discounts.map((d, i) => (
                            <li key={i} className="flex justify-between gap-2 rounded-md border px-2 py-1.5">
                              <span>Discount · {d.label} <span className="text-muted-foreground">by {d.appliedBy.slice(0, 8)}</span></span>
                              <span className="font-medium tabular-nums">−${d.amount.toFixed(2)}</span>
                            </li>
                          ))}
                          {trail.tips.map((t, i) => (
                            <li key={i} className="flex justify-between gap-2 rounded-md border px-2 py-1.5">
                              <span>Gratuity / tip{t.splitIndex != null ? ` · seat ${t.splitIndex + 1}` : ""}</span>
                              <span className="font-medium tabular-nums">${t.amount.toFixed(2)}</span>
                            </li>
                          ))}
                          {trail.voided > 0 && <li className="rounded-md border px-2 py-1.5 text-muted-foreground">▼ {trail.voided} line(s) voided (reason in event log)</li>}
                          {trail.comped > 0 && <li className="rounded-md border px-2 py-1.5 text-muted-foreground">{trail.comped} line(s) comped</li>}
                        </ul>
                      )}
                      {gratuityRate > 0 && order.status !== "cancelled" && (
                        <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
                          <span className="text-muted-foreground">Venue gratuity {(gratuityRate * 100).toFixed(1)}% of ${gratuityBase.toFixed(2)}</span>
                          <Button size="lg" className="min-h-[44px]" variant="outline" disabled={gratuityBusy || gratuityAmount <= 0} onClick={() => void handleGratuity()}>
                            {gratuityBusy ? "Adding…" : `Add gratuity ($${gratuityAmount.toFixed(2)})`}
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Split check</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap items-end gap-2">
                    <div>
                      <Label htmlFor="split-ways">Split ways</Label>
                      <Input id="split-ways" type="number" min={2} max={12} value={ways} onChange={(e) => setWays(Number(e.target.value))} className="h-11 w-24" />
                    </div>
                    <div>
                      <Label htmlFor="split-method">Seat method</Label>
                      <Select value={splitMethod} onValueChange={(v) => setSplitMethod(v as PaymentMethod)}>
                        <SelectTrigger id="split-method" className="h-11 w-36"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cash">Cash</SelectItem>
                          <SelectItem value="credit">Credit</SelectItem>
                          <SelectItem value="debit">Debit</SelectItem>
                          <SelectItem value="mobile">Mobile</SelectItem>
                          <SelectItem value="gift">Gift</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button size="lg" className="min-h-[44px]" variant="outline" disabled={splitting} onClick={() => void handleSplit()}>
                      {splitting ? "Splitting…" : `Split ${Math.max(2, Math.min(12, Math.floor(ways) || 2))} ways`}
                    </Button>
                    {order && (
                      <span className="text-sm text-muted-foreground" aria-live="polite">
                        ${(order.total / Math.max(2, Math.min(12, Math.floor(ways) || 2))).toFixed(2)} each
                      </span>
                    )}
                  </div>
                  {splitPaid.length > 0 && order && (
                    <>
                      <div className="flex gap-2" role="group" aria-label="Split mode">
                        <Button size="lg" className="min-h-[44px]" variant={splitMode === "equal" ? "default" : "outline"} onClick={() => setSplitMode("equal")}>Equal shares</Button>
                        <Button size="lg" className="min-h-[44px]" variant={splitMode === "itemized" ? "default" : "outline"} onClick={() => setSplitMode("itemized")}>By seat (items)</Button>
                      </div>
                      {splitMode === "equal" ? (
                        <ul className="space-y-1">
                          {splitPaid.map((paid, i) => (
                            <li key={i} className="flex items-center justify-between gap-2 rounded-md border px-2 py-1.5 text-sm">
                              <span>Seat {i + 1} — ${(order.total / splitPaid.length).toFixed(2)} · {paid ? "paid" : "unpaid"}</span>
                              <Button size="lg" className="min-h-[44px]" variant={paid ? "default" : "outline"} disabled={paid || splitBusy !== null} onClick={() => void handleSeatPayment(i)}>
                                {splitBusy === i ? "Recording…" : paid ? "✓ Paid" : "Record payment"}
                              </Button>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className="space-y-3">
                          <div className="space-y-1">
                            {order.items.map((line) => (
                              <div key={line.id} className="flex items-center justify-between gap-2 rounded-md border px-2 py-1.5 text-sm">
                                <span className="min-w-0 flex-1 truncate">{line.quantity}× {line.title} — ${line.totalPrice.toFixed(2)}</span>
                                <Select value={String(seatOf(line.id))} onValueChange={(v) => setSeatMap((m) => ({ ...m, [line.id]: Number(v) }))}>
                                  <SelectTrigger className="h-11 w-28" aria-label={`Seat for ${line.title}`}><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    {splitPaid.map((_, i) => (
                                      <SelectItem key={i} value={String(i)}>Seat {i + 1}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            ))}
                          </div>
                          <ul className="space-y-1">
                            {splitPaid.map((paid, i) => (
                              <li key={i} className="flex items-center justify-between gap-2 rounded-md border px-2 py-1.5 text-sm">
                                <span>Seat {i + 1} — ${seatTotal(i).toFixed(2)} ({order.items.filter((l) => seatOf(l.id) === i).length} line(s)) · {paid ? "paid" : "unpaid"}</span>
                                <Button size="lg" className="min-h-[44px]" variant={paid ? "default" : "outline"} disabled={paid || splitBusy !== null} onClick={() => void handleItemizedSeatPayment(i)}>
                                  {splitBusy === i ? "Recording…" : paid ? "✓ Paid" : "Record payment"}
                                </Button>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Change due</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {cashRounded !== order.total && (
                    <p className="rounded-md border px-3 py-2 text-sm" role="status">
                      Cash total (rounded to nearest {roundingIncrement.toFixed(2)}):{" "}
                      <strong className="tabular-nums">${cashRounded.toFixed(2)}</strong>{" "}
                      <span className="text-muted-foreground">(exact ${order.total.toFixed(2)} — cards stay exact)</span>
                    </p>
                  )}
                  <div className="flex items-end gap-2">
                    <div>
                      <Label htmlFor="cash-tendered">Cash tendered</Label>
                      <Input id="cash-tendered" type="number" min={0} step={0.01} value={cashTendered} onChange={(e) => setCashTendered(e.target.value)} className="h-11 w-32" placeholder={cashRounded.toFixed(2)} />
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
                    <div className="flex justify-between font-semibold text-destructive">
                      <p>▲ Remaining due:</p>
                      <p className="font-bold tabular-nums">
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
            {order.payments.length > 0 && order.status !== "cancelled" && (
              <CardFooter>
                <Button variant="outline" size="lg" className="min-h-[44px] w-full" disabled={isRefunding} onClick={openRefund}>
                  {isRefunding ? "Recording refund…" : "Refund (drawer payout, reason required)"}
                </Button>
              </CardFooter>
            )}
          </Card>
          {order.status !== "cancelled" && order.status !== "completed" && (
            <Card className="border-destructive/30">
              <CardHeader>
                <CardTitle className="text-sm text-destructive">Danger zone</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="mb-3 text-xs text-muted-foreground">Voiding is permanent and audited. Kept away from Print/Edit so a rush tap can&apos;t kill a live check.</p>
                <Button variant="destructive" size="lg" className="min-h-[44px] w-full" onClick={() => { setVoidReason(""); setVoidOpen(true) }} disabled={isCancelling}>
                  <Ban className="mr-2 h-4 w-4" />
                  {isCancelling ? "Voiding…" : "Void order…"}
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
