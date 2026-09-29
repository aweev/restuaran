"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = KitchenPage;
const react_1 = require("react");
const OrderContext_1 = require("@/context/OrderContext");
const tabs_1 = require("@/components/ui/tabs");
const card_1 = require("@/components/ui/card");
const button_1 = require("@/components/ui/button");
const badge_1 = require("@/components/ui/badge");
const lucide_react_1 = require("lucide-react");
const kitchen_order_card_1 = require("@/components/kitchen/kitchen-order-card");
const kitchen_socket_integration_1 = require("@/components/kitchen/kitchen-socket-integration");
function KitchenPage() {
    const { state, fetchOrders } = (0, OrderContext_1.useOrder)();
    const [loading, setLoading] = (0, react_1.useState)(true);
    const [refreshing, setRefreshing] = (0, react_1.useState)(false);
    const [activeTab, setActiveTab] = (0, react_1.useState)("pending");
    (0, react_1.useEffect)(() => {
        const loadData = async () => {
            try {
                await fetchOrders();
            }
            catch (error) {
                console.error("Error loading orders data:", error);
            }
            finally {
                setLoading(false);
            }
        };
        loadData();
        // Set up polling for real-time updates
        const interval = setInterval(() => {
            fetchOrders().catch((error) => {
                console.error("Error refreshing orders:", error);
            });
        }, 30000); // Refresh every 30 seconds
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
    // Filter orders for kitchen display
    const getFilteredOrders = (status) => {
        if (status === "all") {
            return state.activeOrders.filter((order) => ["pending", "preparing", "ready"].includes(order.status));
        }
        return state.orders.filter((order) => order.status === status);
    };
    if (loading) {
        return (<div className="flex h-full items-center justify-center">
        <lucide_react_1.Loader2 className="h-8 w-8 animate-spin text-primary"/>
      </div>);
    }
    const pendingOrders = getFilteredOrders("pending");
    const preparingOrders = getFilteredOrders("preparing");
    const readyOrders = getFilteredOrders("ready");
    return (<div className="space-y-4">
      {/* WebSocket integration */}
      <kitchen_socket_integration_1.KitchenSocketIntegration />

      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Kitchen Display</h2>
        <button_1.Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
          <lucide_react_1.RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`}/>
          {refreshing ? "Refreshing..." : "Refresh"}
        </button_1.Button>
      </div>

      <div className="flex items-center gap-4">
        <badge_1.Badge variant="outline" className="bg-yellow-100 text-yellow-800">
          Pending: {pendingOrders.length}
        </badge_1.Badge>
        <badge_1.Badge variant="outline" className="bg-blue-100 text-blue-800">
          Preparing: {preparingOrders.length}
        </badge_1.Badge>
        <badge_1.Badge variant="outline" className="bg-green-100 text-green-800">
          Ready: {readyOrders.length}
        </badge_1.Badge>
      </div>

      <tabs_1.Tabs defaultValue="pending" onValueChange={(value) => setActiveTab(value)}>
        <tabs_1.TabsList>
          <tabs_1.TabsTrigger value="pending">Pending</tabs_1.TabsTrigger>
          <tabs_1.TabsTrigger value="preparing">Preparing</tabs_1.TabsTrigger>
          <tabs_1.TabsTrigger value="ready">Ready</tabs_1.TabsTrigger>
          <tabs_1.TabsTrigger value="all">All Active</tabs_1.TabsTrigger>
        </tabs_1.TabsList>

        <tabs_1.TabsContent value={activeTab} className="mt-4">
          {getFilteredOrders(activeTab).length > 0 ? (<div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {getFilteredOrders(activeTab).map((order) => (<kitchen_order_card_1.KitchenOrderCard key={order.id} order={order} onSelect={() => console.log(`Order selected: ${order.id}`)} prepTime={order.prepTime || 0}/>))}
            </div>) : (<card_1.Card>
              <card_1.CardContent className="flex h-40 items-center justify-center">
                <p className="text-muted-foreground">No {activeTab} orders</p>
              </card_1.CardContent>
            </card_1.Card>)}
        </tabs_1.TabsContent>
      </tabs_1.Tabs>
    </div>);
}
