"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderSocketIntegration = OrderSocketIntegration;
const react_1 = require("react");
const AuthContext_1 = require("@/context/AuthContext");
const OrderContext_1 = require("@/context/OrderContext");
const use_toast_1 = require("@/components/ui/use-toast");
const socket_client_1 = require("@/lib/socket-client");
function OrderSocketIntegration({ orderId }) {
    const { state: authState } = (0, AuthContext_1.useAuth)();
    const { fetchOrders } = (0, OrderContext_1.useOrder)();
    // Initialize socket when component mounts
    (0, react_1.useEffect)(() => {
        if (authState.isAuthenticated && authState.token) {
            const socket = (0, socket_client_1.initializeSocket)(authState.token);
            // Join the order-specific room
            (0, socket_client_1.joinRoom)(`order:${orderId}`);
            return () => {
                // Leave the room when component unmounts
                (0, socket_client_1.leaveRoom)(`order:${orderId}`);
            };
        }
    }, [authState.isAuthenticated, authState.token, orderId]);
    // Listen for order events
    const events = (0, socket_client_1.useSocketEvents)([
        "order_updated",
        "order_cancelled",
        "payment_added",
        "order_ready",
        "order_preparing",
    ]);
    // Handle events
    (0, react_1.useEffect)(() => {
        var _a;
        if (events.length > 0) {
            // Get the latest event
            const latestEvent = events[events.length - 1];
            // Handle different event types
            switch (latestEvent.type) {
                case "order_updated":
                    (0, use_toast_1.toast)({
                        title: "Order Updated",
                        description: "The order has been updated",
                    });
                    fetchOrders();
                    break;
                case "order_cancelled":
                    (0, use_toast_1.toast)({
                        title: "Order Cancelled",
                        description: "The order has been cancelled",
                        variant: "destructive",
                    });
                    fetchOrders();
                    break;
                case "payment_added":
                    (0, use_toast_1.toast)({
                        title: "Payment Added",
                        description: `A payment of $${((_a = latestEvent.data) === null || _a === void 0 ? void 0 : _a.amount) ? Number(latestEvent.data.amount).toFixed(2) : '0.00'} has been added`,
                    });
                    fetchOrders();
                    break;
                case "order_ready":
                    (0, use_toast_1.toast)({
                        title: "Order Ready",
                        description: "The order is ready for pickup/delivery",
                        variant: "default",
                    });
                    fetchOrders();
                    break;
                case "order_preparing":
                    (0, use_toast_1.toast)({
                        title: "Order Preparing",
                        description: "The kitchen has started preparing the order",
                    });
                    fetchOrders();
                    break;
            }
        }
    }, [events, fetchOrders]);
    // This component doesn't render anything
    return null;
}
