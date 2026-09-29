"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.KitchenSocketIntegration = KitchenSocketIntegration;
const react_1 = require("react");
const AuthContext_1 = require("@/context/AuthContext");
const OrderContext_1 = require("@/context/OrderContext");
const KitchenContext_1 = require("@/context/KitchenContext");
const use_toast_1 = require("@/components/ui/use-toast");
const socket_client_1 = require("@/lib/socket-client");
function KitchenSocketIntegration() {
    const { state: authState } = (0, AuthContext_1.useAuth)();
    const { fetchOrders } = (0, OrderContext_1.useOrder)();
    const { state: kitchenState } = (0, KitchenContext_1.useKitchen)();
    const audioRef = (0, react_1.useRef)(null);
    // Initialize audio element
    (0, react_1.useEffect)(() => {
        audioRef.current = new Audio("/sounds/notification.mp3");
        return () => {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current = null;
            }
        };
    }, []);
    // Initialize socket when component mounts
    (0, react_1.useEffect)(() => {
        if (authState.isAuthenticated && authState.token) {
            const socket = (0, socket_client_1.initializeSocket)(authState.token);
            // Join the kitchen room
            (0, socket_client_1.joinRoom)("kitchen");
            return () => {
                // Leave the room when component unmounts
                (0, socket_client_1.leaveRoom)("kitchen");
            };
        }
    }, [authState.isAuthenticated, authState.token]);
    // Listen for order events
    const events = (0, socket_client_1.useSocketEvents)(["order:new", "order:update", "order:cancelled", "order:expedite"]);
    // Handle events
    (0, react_1.useEffect)(() => {
        if (events.length > 0) {
            // Get the latest event
            const latestEvent = events[events.length - 1];
            // Play sound if enabled
            const playSound = () => {
                if (kitchenState.soundEnabled && audioRef.current) {
                    audioRef.current.play().catch((error) => {
                        console.error("Error playing notification sound:", error);
                    });
                }
            };
            // Handle different event types
            switch (latestEvent.type) {
                case "order:new":
                    if (kitchenState.notificationSettings.newOrder) {
                        (0, use_toast_1.toast)({
                            title: "New Order",
                            description: `Order #${latestEvent.orderId.substring(0, 8)} has been created`,
                            variant: "default",
                        });
                        playSound();
                    }
                    fetchOrders();
                    break;
                case "order:update":
                    if (kitchenState.notificationSettings.orderUpdated) {
                        (0, use_toast_1.toast)({
                            title: "Order Updated",
                            description: `Order #${latestEvent.orderId.substring(0, 8)} has been updated`,
                            variant: "default",
                        });
                        playSound();
                    }
                    fetchOrders();
                    break;
                case "order:cancelled":
                    if (kitchenState.notificationSettings.orderCancelled) {
                        (0, use_toast_1.toast)({
                            title: "Order Cancelled",
                            description: `Order #${latestEvent.orderId.substring(0, 8)} has been cancelled`,
                            variant: "destructive",
                        });
                        playSound();
                    }
                    fetchOrders();
                    break;
                case "order:expedite":
                    if (kitchenState.notificationSettings.orderExpedite) {
                        (0, use_toast_1.toast)({
                            title: "Expedite Order",
                            description: `Order #${latestEvent.orderId.substring(0, 8)} needs to be expedited!`,
                            variant: "destructive",
                        });
                        playSound();
                    }
                    fetchOrders();
                    break;
            }
        }
    }, [events, fetchOrders, kitchenState.notificationSettings, kitchenState.soundEnabled]);
    // This component doesn't render anything
    return null;
}
