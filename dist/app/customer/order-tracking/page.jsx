"use strict";
"use client";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = OrderTrackingPage;
const link_1 = __importDefault(require("next/link"));
const react_1 = require("react");
const navigation_1 = require("next/navigation");
const card_1 = require("@/components/ui/card");
const badge_1 = require("@/components/ui/badge");
const button_1 = require("@/components/ui/button");
const separator_1 = require("@/components/ui/separator");
const use_toast_1 = require("@/components/ui/use-toast");
const customer_header_1 = require("@/components/customer/customer-header");
const customer_footer_1 = require("@/components/customer/customer-footer");
const lucide_react_1 = require("lucide-react");
function OrderTrackingPage() {
    const searchParams = (0, navigation_1.useSearchParams)();
    const orderId = searchParams.get("orderId");
    const tableNumber = searchParams.get("table");
    const [order, setOrder] = (0, react_1.useState)(null);
    const [loading, setLoading] = (0, react_1.useState)(true);
    const [error, setError] = (0, react_1.useState)(null);
    (0, react_1.useEffect)(() => {
        const fetchOrder = async () => {
            if (!orderId) {
                setError("No order ID provided");
                setLoading(false);
                return;
            }
            try {
                const response = await fetch(`/api/customer/orders/${orderId}`);
                if (!response.ok) {
                    throw new Error("Failed to fetch order");
                }
                const data = await response.json();
                setOrder(data);
            }
            catch (error) {
                console.error("Error fetching order:", error);
                setError("Failed to load order details");
            }
            finally {
                setLoading(false);
            }
        };
        fetchOrder();
        // Set up polling for order updates
        const intervalId = setInterval(() => {
            fetchOrder();
        }, 30000); // Poll every 30 seconds
        return () => clearInterval(intervalId);
    }, [orderId]);
    const getStatusStep = (status) => {
        switch (status) {
            case "pending":
                return 1;
            case "preparing":
                return 2;
            case "ready":
                return 3;
            case "delivered":
            case "completed":
                return 4;
            case "cancelled":
                return -1;
            default:
                return 0;
        }
    };
    const getEstimatedTime = (status) => {
        switch (status) {
            case "pending":
                return "10-15 minutes";
            case "preparing":
                return "5-10 minutes";
            case "ready":
                return "Ready now";
            case "delivered":
            case "completed":
                return "Completed";
            case "cancelled":
                return "Cancelled";
            default:
                return "Unknown";
        }
    };
    const getStatusBadge = (status) => {
        switch (status) {
            case "pending":
                return <badge_1.Badge className="bg-yellow-500">Pending</badge_1.Badge>;
            case "preparing":
                return <badge_1.Badge className="bg-blue-500">Preparing</badge_1.Badge>;
            case "ready":
                return <badge_1.Badge className="bg-green-500">Ready</badge_1.Badge>;
            case "delivered":
                return <badge_1.Badge className="bg-purple-500">Delivered</badge_1.Badge>;
            case "completed":
                return <badge_1.Badge className="bg-green-700">Completed</badge_1.Badge>;
            case "cancelled":
                return <badge_1.Badge variant="destructive">Cancelled</badge_1.Badge>;
            default:
                return <badge_1.Badge variant="outline">Unknown</badge_1.Badge>;
        }
    };
    const handleCallServer = () => {
        (0, use_toast_1.toast)({
            title: "Server notified",
            description: "A server has been notified and will assist you shortly",
        });
    };
    if (loading) {
        return (<div className="flex flex-col min-h-screen">
        <customer_header_1.CustomerHeader tableNumber={tableNumber} showBackButton title="Order Tracking"/>
        
        <main className="flex-1 container max-w-lg mx-auto px-4 py-6 flex items-center justify-center">
          <div className="text-center">
            <lucide_react_1.Loader2 className="h-8 w-8 animate-spin mx-auto mb-4"/>
            <p>Loading order details...</p>
          </div>
        </main>
        
        <customer_footer_1.CustomerFooter />
      </div>);
    }
    if (error || !order) {
        return (<div className="flex flex-col min-h-screen">
        <customer_header_1.CustomerHeader tableNumber={tableNumber} showBackButton title="Order Tracking"/>
        
        <main className="flex-1 container max-w-lg mx-auto px-4 py-6">
          <card_1.Card>
            <card_1.CardContent className="flex flex-col items-center justify-center py-8">
              <p className="text-center text-muted-foreground mb-4">{error || "Order not found"}</p>
              <button_1.Button asChild>
                <link_1.default href={`/customer/menu${tableNumber ? `?table=${tableNumber}` : ""}`}>
                  Return to Menu
                </link_1.default>
              </button_1.Button>
            </card_1.CardContent>
          </card_1.Card>
        </main>
        
        <customer_footer_1.CustomerFooter />
      </div>);
    }
    const statusStep = getStatusStep(order.status);
    return (<div className="flex flex-col min-h-screen">
      <customer_header_1.CustomerHeader tableNumber={tableNumber} showBackButton title="Order Tracking"/>
      
      <main className="flex-1 container max-w-lg mx-auto px-4 py-6">
        <div className="space-y-6">
          <card_1.Card>
            <card_1.CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <card_1.CardTitle>Order #{order.id.slice(0, 8)}</card_1.CardTitle>
                  <card_1.CardDescription>
                    {new Date(order.createdAt).toLocaleString()}
                  </card_1.CardDescription>
                </div>
                {getStatusBadge(order.status)}
              </div>
            </card_1.CardHeader>
            <card_1.CardContent>
              <div className="space-y-6">
                {order.status !== "cancelled" ? (<div className="relative">
                    <div className="flex justify-between mb-2">
                      <div className="text-center">
                        <div className={`rounded-full w-8 h-8 mx-auto mb-1 flex items-center justify-center ${statusStep >= 1 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                          1
                        </div>
                        <p className="text-xs">Received</p>
                      </div>
                      <div className="text-center">
                        <div className={`rounded-full w-8 h-8 mx-auto mb-1 flex items-center justify-center ${statusStep >= 2 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                          2
                        </div>
                        <p className="text-xs">Preparing</p>
                      </div>
                      <div className="text-center">
                        <div className={`rounded-full w-8 h-8 mx-auto mb-1 flex items-center justify-center ${statusStep >= 3 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                          3
                        </div>
                        <p className="text-xs">Ready</p>
                      </div>
                      <div className="text-center">
                        <div className={`rounded-full w-8 h-8 mx-auto mb-1 flex items-center justify-center ${statusStep >= 4 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                          4
                        </div>
                        <p className="text-xs">Completed</p>
                      </div>
                    </div>
                    <div className="absolute top-4 left-8 right-8 h-1 bg-muted -z-10">
                      <div className="h-full bg-primary" style={{
                width: statusStep === -1
                    ? "0%"
                    : `${Math.min(100, (statusStep / 4) * 100)}%`
            }}/>
                    </div>
                  </div>) : (<div className="bg-red-50 p-4 rounded-md">
                    <p className="text-red-700 text-center">This order has been cancelled</p>
                  </div>)}
                
                <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
                  {order.status === "cancelled" ? (<div className="rounded-full bg-red-100 p-2">
                      <lucide_react_1.X className="h-5 w-5 text-red-600"/>
                    </div>) : order.status === "completed" || order.status === "delivered" ? (<div className="rounded-full bg-green-100 p-2">
                      <lucide_react_1.CheckCircle2 className="h-5 w-5 text-green-600"/>
                    </div>) : (<div className="rounded-full bg-blue-100 p-2">
                      <lucide_react_1.Clock className="h-5 w-5 text-blue-600"/>
                    </div>)}
                  
                  <div>
                    <p className="font-medium">
                      {order.status === "cancelled"
            ? "Order Cancelled"
            : order.status === "completed" || order.status === "delivered"
                ? "Order Completed"
                : "Estimated Time"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {order.status === "cancelled"
            ? "This order has been cancelled"
            : order.status === "completed" || order.status === "delivered"
                ? "Your order has been completed"
                : getEstimatedTime(order.status)}
                    </p>
                  </div>
                
                <separator_1.Separator />
                
                <div>
                  <h3 className="font-medium mb-2">Order Summary</h3>
                  <ul className="space-y-2">
                    {order.items.map((item) => (<li key={item.id} className="flex justify-between">
                        <span>
                          {item.quantity} × {item.title}
                        </span>
                        <span>${item.totalPrice.toFixed(2)}</span>
                      </li>))}
                  </ul>
                  
                  <separator_1.Separator className="my-4"/>
                  
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span>Subtotal</span>
                      <span>${order.subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Tax</span>
                      <span>${order.tax.toFixed(2)}</span>
                    </div>
                    {order.discount > 0 && (<div className="flex justify-between text-green-600">
                        <span>Discount</span>
                        <span>-${order.discount.toFixed(2)}</span>
                      </div>)}
                    <div className="flex justify-between font-bold pt-2">
                      <span>Total</span>
                      <span>${order.total.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
                
                {order.diningMode === "Dine in" && order.status !== "cancelled" && (<button_1.Button onClick={handleCallServer} className="w-full">
                    <lucide_react_1.Bell className="mr-2 h-4 w-4"/>
                    Call Server
                  </button_1.Button>)}
                </div>
              </div>
            </card_1.CardContent>
          </card_1.Card>
          
          {order.status === "completed" || order.status === "delivered" ? (<card_1.Card>
              <card_1.CardHeader>
                <card_1.CardTitle>How was your experience?</card_1.CardTitle>
                <card_1.CardDescription>
                  We&apos;d love to hear your feedback about your order
                </card_1.CardDescription>
              </card_1.CardHeader>
              <card_1.CardContent>
                <button_1.Button asChild className="w-full">
                  <link_1.default href={`/customer/feedback?orderId=${order.id}${tableNumber ? `&table=${tableNumber}` : ""}`}>
                    Leave Feedback
                  </link_1.default>
                </button_1.Button>
              </card_1.CardContent>
            </card_1.Card>) : null}
        </div>
      </main>
      
      <customer_footer_1.CustomerFooter />
    </div>);
}
