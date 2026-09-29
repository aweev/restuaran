"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = KitchenDisplayPage;
const react_1 = require("react");
const OrderContext_1 = require("@/context/OrderContext");
const KitchenContext_1 = require("@/context/KitchenContext");
const tabs_1 = require("@/components/ui/tabs");
const card_1 = require("@/components/ui/card");
const button_1 = require("@/components/ui/button");
const lucide_react_1 = require("lucide-react");
const kitchen_order_queue_1 = require("@/components/kitchen/kitchen-order-queue");
const kitchen_completed_orders_1 = require("@/components/kitchen/kitchen-completed-orders");
const kitchen_performance_metrics_1 = require("@/components/kitchen/kitchen-performance-metrics");
const kitchen_socket_integration_1 = require("@/components/kitchen/kitchen-socket-integration");
const kitchen_notification_settings_1 = require("@/components/kitchen/kitchen-notification-settings");
const kitchen_staff_assignment_1 = require("@/components/kitchen/kitchen-staff-assignment");
function KitchenDisplayPage() {
    const { state: orderState, fetchOrders } = (0, OrderContext_1.useOrder)();
    const { state: kitchenState, toggleSound } = (0, KitchenContext_1.useKitchen)();
    const [refreshing, setRefreshing] = (0, react_1.useState)(false);
    (0, react_1.useEffect)(() => {
        const loadData = async () => {
            try {
                await fetchOrders();
            }
            catch (error) {
                console.error("Error loading orders data:", error);
            }
        };
        loadData();
        // Set up polling for real-time updates (as a fallback to WebSockets)
        const interval = setInterval(() => {
            fetchOrders().catch((error) => {
                console.error("Error refreshing orders:", error);
            });
        }, 60000); // Refresh every minute as a fallback
        return () => clearInterval(interval);
    }, [fetchOrders]);
    const handleRefresh = async () => {
        setRefreshing(true);
        try {
            await fetchOrders();
        }
        catch (error) {
            console.error("Error refreshing orders:", error);
        }
        finally {
            setRefreshing(false);
        }
    };
    const pendingOrders = orderState.orders.filter((order) => order.status === "pending");
    const preparingOrders = orderState.orders.filter((order) => order.status === "preparing");
    const readyOrders = orderState.orders.filter((order) => order.status === "ready");
    const completedOrders = orderState.orders.filter((order) => order.status === "completed" || order.status === "delivered");
    return (<div className="space-y-4">
      {/* WebSocket integration for real-time updates */}
      <kitchen_socket_integration_1.KitchenSocketIntegration />

      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Kitchen Display System</h2>
        <div className="flex items-center gap-2">
          <button_1.Button variant="outline" size="icon" onClick={toggleSound} title={kitchenState.soundEnabled ? "Mute notifications" : "Enable sound"}>
            {kitchenState.soundEnabled ? <lucide_react_1.Volume2 className="h-4 w-4"/> : <lucide_react_1.VolumeX className="h-4 w-4"/>}
          </button_1.Button>
          <button_1.Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
            <lucide_react_1.RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`}/>
            {refreshing ? "Refreshing..." : "Refresh"}
          </button_1.Button>
          <kitchen_notification_settings_1.KitchenNotificationSettings />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <card_1.Card>
          <card_1.CardHeader className="bg-yellow-50 dark:bg-yellow-950/30">
            <card_1.CardTitle className="flex items-center justify-between">
              <span>Pending</span>
              <span className="rounded-full bg-yellow-100 px-2.5 py-0.5 text-sm font-medium text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100">
                {pendingOrders.length}
              </span>
            </card_1.CardTitle>
          </card_1.CardHeader>
          <card_1.CardContent className="p-0">
            <kitchen_order_queue_1.KitchenOrderQueue orders={pendingOrders} status="pending"/>
          </card_1.CardContent>
        </card_1.Card>

        <card_1.Card>
          <card_1.CardHeader className="bg-blue-50 dark:bg-blue-950/30">
            <card_1.CardTitle className="flex items-center justify-between">
              <span>Preparing</span>
              <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-sm font-medium text-blue-800 dark:bg-blue-900 dark:text-blue-100">
                {preparingOrders.length}
              </span>
            </card_1.CardTitle>
          </card_1.CardHeader>
          <card_1.CardContent className="p-0">
            <kitchen_order_queue_1.KitchenOrderQueue orders={preparingOrders} status="preparing"/>
          </card_1.CardContent>
        </card_1.Card>

        <card_1.Card>
          <card_1.CardHeader className="bg-green-50 dark:bg-green-950/30">
            <card_1.CardTitle className="flex items-center justify-between">
              <span>Ready</span>
              <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-sm font-medium text-green-800 dark:bg-green-900 dark:text-green-100">
                {readyOrders.length}
              </span>
            </card_1.CardTitle>
          </card_1.CardHeader>
          <card_1.CardContent className="p-0">
            <kitchen_order_queue_1.KitchenOrderQueue orders={readyOrders} status="ready"/>
          </card_1.CardContent>
        </card_1.Card>
      </div>

      <tabs_1.Tabs defaultValue="staff">
        <tabs_1.TabsList>
          <tabs_1.TabsTrigger value="staff">Staff Assignment</tabs_1.TabsTrigger>
          <tabs_1.TabsTrigger value="completed">Completed Orders</tabs_1.TabsTrigger>
          <tabs_1.TabsTrigger value="metrics">Performance Metrics</tabs_1.TabsTrigger>
        </tabs_1.TabsList>

        <tabs_1.TabsContent value="staff" className="mt-4">
          <kitchen_staff_assignment_1.KitchenStaffAssignment />
        </tabs_1.TabsContent>

        <tabs_1.TabsContent value="completed" className="mt-4">
          <kitchen_completed_orders_1.KitchenCompletedOrders orders={completedOrders}/>
        </tabs_1.TabsContent>

        <tabs_1.TabsContent value="metrics" className="mt-4">
          <kitchen_performance_metrics_1.KitchenPerformanceMetrics />
        </tabs_1.TabsContent>
      </tabs_1.Tabs>
    </div>);
}
