"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderCard = OrderCard;
const react_1 = require("react");
const card_1 = require("@/components/ui/card");
const badge_1 = require("@/components/ui/badge");
const button_1 = require("@/components/ui/button");
const OrderContext_1 = require("@/context/OrderContext");
const date_fns_1 = require("date-fns");
const lucide_react_1 = require("lucide-react");
const navigation_1 = require("next/navigation");
function OrderCard({ order }) {
    var _a;
    const { updateOrderStatus } = (0, OrderContext_1.useOrder)();
    const [isUpdating, setIsUpdating] = (0, react_1.useState)(false);
    const router = (0, navigation_1.useRouter)();
    const getStatusColor = (status) => {
        switch (status) {
            case "pending":
                return "bg-yellow-100 text-yellow-800";
            case "preparing":
                return "bg-blue-100 text-blue-800";
            case "ready":
                return "bg-green-100 text-green-800";
            case "delivered":
                return "bg-purple-100 text-purple-800";
            case "completed":
                return "bg-green-100 text-green-800";
            case "cancelled":
                return "bg-red-100 text-red-800";
            default:
                return "bg-gray-100 text-gray-800";
        }
    };
    const getNextStatus = (currentStatus) => {
        switch (currentStatus) {
            case "pending":
                return "preparing";
            case "preparing":
                return "ready";
            case "ready":
                return "delivered";
            case "delivered":
                return "completed";
            default:
                return null;
        }
    };
    const handleStatusUpdate = async () => {
        const nextStatus = getNextStatus(order.status);
        if (!nextStatus)
            return;
        setIsUpdating(true);
        try {
            await updateOrderStatus(order.id, nextStatus);
        }
        catch (error) {
            console.error("Error updating order status:", error);
        }
        finally {
            setIsUpdating(false);
        }
    };
    const handleViewDetails = () => {
        router.push(`/dashboard/orders/${order.id}`);
    };
    return (<card_1.Card>
      <card_1.CardHeader className="p-4 pb-0">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">
            {order.tableId ? `Table ${(_a = order.table) === null || _a === void 0 ? void 0 : _a.number}` : order.customerName || "Takeaway"}
          </h3>
          <badge_1.Badge variant="outline" className={getStatusColor(order.status)}>
            {order.status}
          </badge_1.Badge>
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <lucide_react_1.Clock className="h-3 w-3"/>
          <span>{(0, date_fns_1.formatDistanceToNow)(new Date(order.createdAt), { addSuffix: true })}</span>
        </div>
      </card_1.CardHeader>
      <card_1.CardContent className="p-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm">Items:</span>
            <span className="font-medium">{order.items.length}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">Subtotal:</span>
            <span className="font-medium">${order.subtotal.toFixed(2)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">Tax:</span>
            <span className="font-medium">${order.tax.toFixed(2)}</span>
          </div>
          {order.discount > 0 && (<div className="flex items-center justify-between">
              <span className="text-sm">Discount:</span>
              <span className="font-medium text-red-500">-${order.discount.toFixed(2)}</span>
            </div>)}
          <div className="flex items-center justify-between border-t pt-2">
            <span className="font-medium">Total:</span>
            <span className="font-bold text-green-600">${order.total.toFixed(2)}</span>
          </div>
        </div>
      </card_1.CardContent>
      <card_1.CardFooter className="flex justify-between p-4 pt-0">
        <button_1.Button variant="outline" size="sm" onClick={handleViewDetails}>
          View Details <lucide_react_1.ChevronRight className="ml-1 h-4 w-4"/>
        </button_1.Button>
        {getNextStatus(order.status) && (<button_1.Button size="sm" onClick={handleStatusUpdate} disabled={isUpdating}>
            {isUpdating ? "Updating..." : `Mark as ${getNextStatus(order.status)}`}
          </button_1.Button>)}
      </card_1.CardFooter>
    </card_1.Card>);
}
