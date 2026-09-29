"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = OrdersPage;
const react_1 = require("react");
const OrderContext_1 = require("@/context/OrderContext");
const card_1 = require("@/components/ui/card");
const tabs_1 = require("@/components/ui/tabs");
const input_1 = require("@/components/ui/input");
const button_1 = require("@/components/ui/button");
const order_card_1 = require("@/components/orders/order-card");
const lucide_react_1 = require("lucide-react");
function OrdersPage() {
    const { state, fetchOrders } = (0, OrderContext_1.useOrder)();
    const [loading, setLoading] = (0, react_1.useState)(true);
    const [searchQuery, setSearchQuery] = (0, react_1.useState)("");
    const [statusFilter, setStatusFilter] = (0, react_1.useState)("all");
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
    }, [fetchOrders]);
    const filteredOrders = state.orders.filter((order) => {
        var _a, _b, _c;
        // Filter by status
        if (statusFilter !== "all" && order.status !== statusFilter) {
            return false;
        }
        // Filter by search query (customer name or table number)
        if (searchQuery) {
            const searchLower = searchQuery.toLowerCase();
            const customerNameMatch = (_a = order.customerName) === null || _a === void 0 ? void 0 : _a.toLowerCase().includes(searchLower);
            const tableMatch = (_c = (_b = order.table) === null || _b === void 0 ? void 0 : _b.number) === null || _c === void 0 ? void 0 : _c.toLowerCase().includes(searchLower);
            if (!customerNameMatch && !tableMatch) {
                return false;
            }
        }
        return true;
    });
    if (loading) {
        return (<div className="flex h-full items-center justify-center">
        <lucide_react_1.Loader2 className="h-8 w-8 animate-spin text-primary"/>
      </div>);
    }
    return (<div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Orders</h2>
        <button_1.Button>
          <lucide_react_1.Plus className="mr-2 h-4 w-4"/> New Order
        </button_1.Button>
      </div>

      <div className="flex items-center space-x-2">
        <div className="relative flex-1">
          <lucide_react_1.Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground"/>
          <input_1.Input type="search" placeholder="Search by customer or table..." className="pl-8" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}/>
        </div>
      </div>

      <tabs_1.Tabs defaultValue="all" onValueChange={(value) => setStatusFilter(value)}>
        <tabs_1.TabsList className="mb-4">
          <tabs_1.TabsTrigger value="all">All Orders</tabs_1.TabsTrigger>
          <tabs_1.TabsTrigger value="pending">Pending</tabs_1.TabsTrigger>
          <tabs_1.TabsTrigger value="preparing">Preparing</tabs_1.TabsTrigger>
          <tabs_1.TabsTrigger value="ready">Ready</tabs_1.TabsTrigger>
          <tabs_1.TabsTrigger value="delivered">Delivered</tabs_1.TabsTrigger>
          <tabs_1.TabsTrigger value="completed">Completed</tabs_1.TabsTrigger>
          <tabs_1.TabsTrigger value="cancelled">Cancelled</tabs_1.TabsTrigger>
        </tabs_1.TabsList>

        <tabs_1.TabsContent value={statusFilter} className="space-y-4">
          {filteredOrders.length > 0 ? (<div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredOrders.map((order) => (<order_card_1.OrderCard key={order.id} order={order}/>))}
            </div>) : (<card_1.Card>
              <card_1.CardContent className="flex h-40 items-center justify-center">
                <p className="text-muted-foreground">No orders found</p>
              </card_1.CardContent>
            </card_1.Card>)}
        </tabs_1.TabsContent>
      </tabs_1.Tabs>
    </div>);
}
