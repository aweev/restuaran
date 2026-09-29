"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = OrderDetailsPage;
const react_1 = require("react");
const navigation_1 = require("next/navigation");
const OrderContext_1 = require("@/context/OrderContext");
const card_1 = require("@/components/ui/card");
const button_1 = require("@/components/ui/button");
const badge_1 = require("@/components/ui/badge");
const separator_1 = require("@/components/ui/separator");
const tabs_1 = require("@/components/ui/tabs");
const use_toast_1 = require("@/components/ui/use-toast");
const order_item_list_1 = require("@/components/orders/order-item-list");
const order_status_timeline_1 = require("@/components/orders/order-status-timeline");
const payment_form_1 = require("@/components/orders/payment-form");
const order_receipt_1 = require("@/components/orders/order-receipt");
const order_edit_form_1 = require("@/components/orders/order-edit-form");
const order_socket_integration_1 = require("@/components/orders/order-socket-integration");
const lucide_react_1 = require("lucide-react");
const date_fns_1 = require("date-fns");
function OrderDetailsPage() {
    var _a;
    const params = (0, navigation_1.useParams)();
    const router = (0, navigation_1.useRouter)();
    const { state, fetchOrders, updateOrderStatus, cancelOrder } = (0, OrderContext_1.useOrder)();
    const [loading, setLoading] = (0, react_1.useState)(true);
    const [order, setOrder] = (0, react_1.useState)(null);
    const [isEditing, setIsEditing] = (0, react_1.useState)(false);
    const [isCancelling, setIsCancelling] = (0, react_1.useState)(false);
    const [isProcessingStatusUpdate, setIsProcessingStatusUpdate] = (0, react_1.useState)(false);
    const orderId = params.id;
    (0, react_1.useEffect)(() => {
        const loadOrder = async () => {
            try {
                await fetchOrders();
                setLoading(false);
            }
            catch (error) {
                console.error("Error loading order:", error);
                (0, use_toast_1.toast)({
                    title: "Error",
                    description: "Failed to load order details",
                    variant: "destructive",
                });
                setLoading(false);
            }
        };
        loadOrder();
    }, [fetchOrders, orderId]);
    (0, react_1.useEffect)(() => {
        if (!loading) {
            const foundOrder = state.orders.find((o) => o.id === orderId);
            setOrder(foundOrder || null);
            if (!foundOrder) {
                (0, use_toast_1.toast)({
                    title: "Error",
                    description: "Order not found",
                    variant: "destructive",
                });
            }
        }
    }, [loading, state.orders, orderId]);
    const getNextStatus = (currentStatus) => {
        const statusFlow = ["pending", "preparing", "ready", "delivered", "completed"];
        const currentIndex = statusFlow.indexOf(currentStatus);
        if (currentIndex < 0 || currentIndex === statusFlow.length - 1) {
            return null;
        }
        return statusFlow[currentIndex + 1];
    };
    const handleStatusUpdate = async () => {
        if (!order)
            return;
        const nextStatus = getNextStatus(order.status);
        if (!nextStatus)
            return;
        setIsProcessingStatusUpdate(true);
        try {
            await updateOrderStatus(order.id, nextStatus);
            (0, use_toast_1.toast)({
                title: "Success",
                description: `Order status updated to ${nextStatus}`,
            });
        }
        catch (error) {
            console.error("Error updating order status:", error);
            (0, use_toast_1.toast)({
                title: "Error",
                description: "Failed to update order status",
                variant: "destructive",
            });
        }
        finally {
            setIsProcessingStatusUpdate(false);
        }
    };
    const handleCancelOrder = async () => {
        if (!order)
            return;
        if (!window.confirm("Are you sure you want to cancel this order? This action cannot be undone.")) {
            return;
        }
        setIsCancelling(true);
        try {
            await cancelOrder(order.id);
            (0, use_toast_1.toast)({
                title: "Success",
                description: "Order cancelled successfully",
            });
        }
        catch (error) {
            console.error("Error cancelling order:", error);
            (0, use_toast_1.toast)({
                title: "Error",
                description: "Failed to cancel order",
                variant: "destructive",
            });
        }
        finally {
            setIsCancelling(false);
        }
    };
    const handlePrintReceipt = () => {
        var _a;
        if (!order)
            return;
        const printWindow = window.open("", "_blank");
        if (printWindow) {
            printWindow.document.write("<html><head><title>Order Receipt</title>");
            printWindow.document.write("<style>");
            printWindow.document.write(`
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
        .receipt { max-width: 300px; margin: 0 auto; }
        .header { text-align: center; margin-bottom: 20px; }
        .items { margin-bottom: 20px; }
        .item { margin-bottom: 10px; }
        .totals { border-top: 1px dashed #ccc; padding-top: 10px; }
        .total-row { display: flex; justify-content: space-between; }
        .footer { text-align: center; margin-top: 20px; font-size: 12px; }
      `);
            printWindow.document.write("</style></head><body>");
            printWindow.document.write('<div class="receipt">');
            // Header
            printWindow.document.write('<div class="header">');
            printWindow.document.write("<h2>Restaurant POS</h2>");
            printWindow.document.write(`<p>Order #${order.id.substring(0, 8)}</p>`);
            printWindow.document.write(`<p>${(0, date_fns_1.format)(new Date(order.createdAt), "PPpp")}</p>`);
            printWindow.document.write(`<p>${order.diningMode} - ${order.tableId ? `Table ${(_a = order.table) === null || _a === void 0 ? void 0 : _a.number}` : "Takeaway"}</p>`);
            if (order.customerName) {
                printWindow.document.write(`<p>Customer: ${order.customerName}</p>`);
            }
            printWindow.document.write("</div>");
            // Items
            printWindow.document.write('<div class="items">');
            order.items.forEach((item) => {
                printWindow.document.write('<div class="item">');
                printWindow.document.write(`<div>${item.quantity}x ${item.title}</div>`);
                printWindow.document.write(`<div>$${item.totalPrice.toFixed(2)}</div>`);
                if (item.specialInstructions) {
                    printWindow.document.write(`<div><small>Note: ${item.specialInstructions}</small></div>`);
                }
                printWindow.document.write("</div>");
            });
            printWindow.document.write("</div>");
            // Totals
            printWindow.document.write('<div class="totals">');
            printWindow.document.write('<div class="total-row">');
            printWindow.document.write("<span>Subtotal:</span>");
            printWindow.document.write(`<span>$${order.subtotal.toFixed(2)}</span>`);
            printWindow.document.write("</div>");
            printWindow.document.write('<div class="total-row">');
            printWindow.document.write("<span>Tax:</span>");
            printWindow.document.write(`<span>$${order.tax.toFixed(2)}</span>`);
            printWindow.document.write("</div>");
            if (order.discount > 0) {
                printWindow.document.write('<div class="total-row">');
                printWindow.document.write("<span>Discount:</span>");
                printWindow.document.write(`<span>-$${order.discount.toFixed(2)}</span>`);
                printWindow.document.write("</div>");
            }
            printWindow.document.write('<div class="total-row" style="font-weight: bold">');
            printWindow.document.write("<span>Total:</span>");
            printWindow.document.write(`<span>$${order.total.toFixed(2)}</span>`);
            printWindow.document.write("</div>");
            printWindow.document.write("</div>");
            // Payment info
            if (order.payments && order.payments.length > 0) {
                printWindow.document.write('<div class="payments">');
                printWindow.document.write("<h3>Payments</h3>");
                order.payments.forEach((payment) => {
                    printWindow.document.write('<div class="total-row">');
                    printWindow.document.write(`<span>${payment.method.toUpperCase()}:</span>`);
                    printWindow.document.write(`<span>$${payment.amount.toFixed(2)}</span>`);
                    printWindow.document.write("</div>");
                });
                printWindow.document.write("</div>");
            }
            // Footer
            printWindow.document.write('<div class="footer">');
            printWindow.document.write("<p>Thank you for your order!</p>");
            printWindow.document.write("</div>");
            printWindow.document.write("</div></body></html>");
            printWindow.document.close();
            printWindow.print();
        }
    };
    if (loading) {
        return (<div className="flex h-full items-center justify-center">
        <lucide_react_1.Loader2 className="h-8 w-8 animate-spin text-primary"/>
      </div>);
    }
    if (!order) {
        return (<div className="flex h-full flex-col items-center justify-center">
        <h2 className="text-2xl font-bold">Order not found</h2>
        <p className="text-muted-foreground">The order you&apos;re looking for doesn&apos;t exist or has been deleted.</p>
        <button_1.Button className="mt-4" onClick={() => router.push("/dashboard/orders")}>
          <lucide_react_1.ArrowLeft className="mr-2 h-4 w-4"/>
          Back to Orders
        </button_1.Button>
      </div>);
    }
    if (isEditing) {
        return (<div className="space-y-4">
        <div className="flex items-center justify-between">
          <button_1.Button variant="outline" onClick={() => setIsEditing(false)}>
            <lucide_react_1.ArrowLeft className="mr-2 h-4 w-4"/>
            Back to Order Details
          </button_1.Button>
        </div>
        <order_edit_form_1.OrderEditForm order={order} onCancel={() => setIsEditing(false)}/>
      </div>);
    }
    return (<div className="space-y-6">
      {/* WebSocket integration */}
      <order_socket_integration_1.OrderSocketIntegration orderId={orderId}/>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button_1.Button variant="outline" onClick={() => router.push("/dashboard/orders")}>
            <lucide_react_1.ArrowLeft className="mr-2 h-4 w-4"/>
            Back
          </button_1.Button>
          <h2 className="text-3xl font-bold tracking-tight">Order #{order.id.substring(0, 8)}</h2>
          <badge_1.Badge variant="outline" className={order.status === "pending"
            ? "bg-yellow-100 text-yellow-800"
            : order.status === "preparing"
                ? "bg-blue-100 text-blue-800"
                : order.status === "ready"
                    ? "bg-green-100 text-green-800"
                    : order.status === "delivered"
                        ? "bg-purple-100 text-purple-800"
                        : order.status === "completed"
                            ? "bg-green-100 text-green-800"
                            : "bg-red-100 text-red-800"}>
            {order.status}
          </badge_1.Badge>
        </div>
        <div className="flex gap-2">
          {order.status !== "cancelled" && order.status !== "completed" && (<>
              <button_1.Button variant="outline" onClick={() => setIsEditing(true)}>
                <lucide_react_1.Edit className="mr-2 h-4 w-4"/>
                Edit Order
              </button_1.Button>
              <button_1.Button variant="destructive" onClick={handleCancelOrder} disabled={isCancelling}>
                <lucide_react_1.Ban className="mr-2 h-4 w-4"/>
                {isCancelling ? "Cancelling..." : "Cancel Order"}
              </button_1.Button>
            </>)}
          <button_1.Button variant="outline" onClick={handlePrintReceipt}>
            <lucide_react_1.Printer className="mr-2 h-4 w-4"/>
            Print Receipt
          </button_1.Button>
        </div>
      </div>

      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <lucide_react_1.Clock className="h-4 w-4"/>
        <span>Created {(0, date_fns_1.formatDistanceToNow)(new Date(order.createdAt), { addSuffix: true })}</span>
        <span>•</span>
        <span>{(0, date_fns_1.format)(new Date(order.createdAt), "PPpp")}</span>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="md:col-span-2">
          <tabs_1.Tabs defaultValue="details">
            <tabs_1.TabsList>
              <tabs_1.TabsTrigger value="details">Order Details</tabs_1.TabsTrigger>
              <tabs_1.TabsTrigger value="timeline">Status Timeline</tabs_1.TabsTrigger>
              <tabs_1.TabsTrigger value="receipt">Receipt</tabs_1.TabsTrigger>
            </tabs_1.TabsList>

            <tabs_1.TabsContent value="details" className="space-y-4">
              <card_1.Card>
                <card_1.CardHeader>
                  <card_1.CardTitle>Order Information</card_1.CardTitle>
                </card_1.CardHeader>
                <card_1.CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground">Dining Mode</h4>
                      <p>{order.diningMode}</p>
                    </div>
                    {order.tableId && (<div>
                        <h4 className="text-sm font-medium text-muted-foreground">Table</h4>
                        <p>Table {(_a = order.table) === null || _a === void 0 ? void 0 : _a.number}</p>
                      </div>)}
                    {order.customerName && (<div>
                        <h4 className="text-sm font-medium text-muted-foreground">Customer</h4>
                        <p>{order.customerName}</p>
                      </div>)}
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground">Server</h4>
                      <p>{order.serverId}</p>
                    </div>
                  </div>

                  {order.notes && (<div>
                      <h4 className="text-sm font-medium text-muted-foreground">Notes</h4>
                      <p className="text-sm">{order.notes}</p>
                    </div>)}
                </card_1.CardContent>
              </card_1.Card>

              <card_1.Card>
                <card_1.CardHeader>
                  <card_1.CardTitle>Order Items</card_1.CardTitle>
                </card_1.CardHeader>
                <card_1.CardContent>
                  <order_item_list_1.OrderItemList items={order.items} editable={false}/>
                </card_1.CardContent>
              </card_1.Card>

              <card_1.Card>
                <card_1.CardHeader>
                  <card_1.CardTitle>Order Summary</card_1.CardTitle>
                </card_1.CardHeader>
                <card_1.CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Subtotal:</span>
                      <span>${order.subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Tax:</span>
                      <span>${order.tax.toFixed(2)}</span>
                    </div>
                    {order.discount > 0 && (<div className="flex justify-between text-red-500">
                        <span>Discount:</span>
                        <span>-${order.discount.toFixed(2)}</span>
                      </div>)}
                    <separator_1.Separator />
                    <div className="flex justify-between font-bold">
                      <span>Total:</span>
                      <span>${order.total.toFixed(2)}</span>
                    </div>
                  </div>
                </card_1.CardContent>
                <card_1.CardFooter className="flex justify-between">
                  <div>
                    <badge_1.Badge variant={order.isPaid ? "default" : "secondary"}>{order.isPaid ? "Paid" : "Unpaid"}</badge_1.Badge>
                  </div>
                  {getNextStatus(order.status) && (<button_1.Button onClick={handleStatusUpdate} disabled={isProcessingStatusUpdate}>
                      {isProcessingStatusUpdate ? "Updating..." : `Mark as ${getNextStatus(order.status)}`}
                    </button_1.Button>)}
                </card_1.CardFooter>
              </card_1.Card>
            </tabs_1.TabsContent>

            <tabs_1.TabsContent value="timeline">
              <card_1.Card>
                <card_1.CardHeader>
                  <card_1.CardTitle>Order Timeline</card_1.CardTitle>
                </card_1.CardHeader>
                <card_1.CardContent>
                  <order_status_timeline_1.OrderStatusTimeline order={order}/>
                </card_1.CardContent>
              </card_1.Card>
            </tabs_1.TabsContent>

            <tabs_1.TabsContent value="receipt">
              <card_1.Card>
                <card_1.CardHeader>
                  <card_1.CardTitle>Order Receipt</card_1.CardTitle>
                </card_1.CardHeader>
                <card_1.CardContent>
                  <order_receipt_1.OrderReceipt order={order}/>
                </card_1.CardContent>
                <card_1.CardFooter>
                  <button_1.Button variant="outline" className="w-full" onClick={handlePrintReceipt}>
                    <lucide_react_1.Printer className="mr-2 h-4 w-4"/>
                    Print Receipt
                  </button_1.Button>
                </card_1.CardFooter>
              </card_1.Card>
            </tabs_1.TabsContent>
          </tabs_1.Tabs>
        </div>

        <div>
          <card_1.Card>
            <card_1.CardHeader>
              <card_1.CardTitle>Payment</card_1.CardTitle>
            </card_1.CardHeader>
            <card_1.CardContent className="space-y-4">
              {order.payments.length > 0 ? (<div className="space-y-2">
                  {order.payments.map((payment, index) => (<div key={index} className="flex justify-between items-center">
                      <div>
                        <p className="font-medium capitalize">{payment.method}</p>
                        <p className="text-xs text-muted-foreground">{(0, date_fns_1.format)(new Date(payment.timestamp), "PPpp")}</p>
                      </div>
                      <p className="font-medium">${payment.amount.toFixed(2)}</p>
                    </div>))}
                  <separator_1.Separator />
                  <div className="flex justify-between">
                    <p>Total Paid:</p>
                    <p className="font-bold">${order.payments.reduce((sum, p) => sum + p.amount, 0).toFixed(2)}</p>
                  </div>
                  {!order.isPaid && (<div className="flex justify-between text-red-500">
                      <p>Remaining:</p>
                      <p className="font-bold">
                        ${(order.total - order.payments.reduce((sum, p) => sum + p.amount, 0)).toFixed(2)}
                      </p>
                    </div>)}
                </div>) : (<p className="text-center text-muted-foreground">No payments recorded</p>)}
            </card_1.CardContent>
            {!order.isPaid && order.status !== "cancelled" && (<card_1.CardFooter>
                <payment_form_1.PaymentForm orderId={order.id} totalDue={order.total} totalPaid={order.payments.reduce((sum, p) => sum + p.amount, 0)}/>
              </card_1.CardFooter>)}
          </card_1.Card>
        </div>
      </div>
    </div>);
}
