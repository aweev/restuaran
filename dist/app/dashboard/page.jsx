"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = DashboardPage;
const react_1 = require("react");
const AuthContext_1 = require("@/context/AuthContext");
const MenuContext_1 = require("@/context/MenuContext");
const OrderContext_1 = require("@/context/OrderContext");
const TableContext_1 = require("@/context/TableContext");
const card_1 = require("@/components/ui/card");
const tabs_1 = require("@/components/ui/tabs");
const recent_orders_1 = require("@/components/dashboard/recent-orders");
const table_status_1 = require("@/components/dashboard/table-status");
const popular_items_1 = require("@/components/dashboard/popular-items");
const sales_chart_1 = require("@/components/dashboard/sales-chart");
const lucide_react_1 = require("lucide-react");
function DashboardPage() {
    const { state: authState } = (0, AuthContext_1.useAuth)();
    const { state: menuState, fetchMenu } = (0, MenuContext_1.useMenu)();
    const { state: orderState, fetchOrders } = (0, OrderContext_1.useOrder)();
    const { state: tableState, fetchTables } = (0, TableContext_1.useTable)();
    const [loading, setLoading] = (0, react_1.useState)(true);
    (0, react_1.useEffect)(() => {
        const loadData = async () => {
            try {
                await Promise.all([fetchMenu(), fetchOrders(), fetchTables()]);
            }
            catch (error) {
                console.error("Error loading dashboard data:", error);
            }
            finally {
                setLoading(false);
            }
        };
        if (authState.isAuthenticated) {
            loadData();
        }
    }, [authState.isAuthenticated, fetchMenu, fetchOrders, fetchTables]);
    if (loading) {
        return (<div className="flex h-full items-center justify-center">
        <lucide_react_1.Loader2 className="h-8 w-8 animate-spin text-primary"/>
      </div>);
    }
    // Calculate statistics
    const totalSales = orderState.orders.reduce((sum, order) => sum + order.total, 0);
    const completedOrders = orderState.orders.filter((order) => order.status === "completed").length;
    const pendingOrders = orderState.orders.filter((order) => ["pending", "preparing", "ready"].includes(order.status)).length;
    const availableTables = tableState.tables.filter((table) => table.status === "available").length;
    return (<div className="space-y-4">
      <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <card_1.Card>
          <card_1.CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <card_1.CardTitle className="text-sm font-medium">Total Sales</card_1.CardTitle>
          </card_1.CardHeader>
          <card_1.CardContent>
            <div className="text-2xl font-bold">${totalSales.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">+20.1% from last month</p>
          </card_1.CardContent>
        </card_1.Card>
        <card_1.Card>
          <card_1.CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <card_1.CardTitle className="text-sm font-medium">Completed Orders</card_1.CardTitle>
          </card_1.CardHeader>
          <card_1.CardContent>
            <div className="text-2xl font-bold">{completedOrders}</div>
            <p className="text-xs text-muted-foreground">+15% from last month</p>
          </card_1.CardContent>
        </card_1.Card>
        <card_1.Card>
          <card_1.CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <card_1.CardTitle className="text-sm font-medium">Pending Orders</card_1.CardTitle>
          </card_1.CardHeader>
          <card_1.CardContent>
            <div className="text-2xl font-bold">{pendingOrders}</div>
            <p className="text-xs text-muted-foreground">Current active orders</p>
          </card_1.CardContent>
        </card_1.Card>
        <card_1.Card>
          <card_1.CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <card_1.CardTitle className="text-sm font-medium">Available Tables</card_1.CardTitle>
          </card_1.CardHeader>
          <card_1.CardContent>
            <div className="text-2xl font-bold">
              {availableTables} / {tableState.tables.length}
            </div>
            <p className="text-xs text-muted-foreground">
              {Math.round((availableTables / tableState.tables.length) * 100)}% availability
            </p>
          </card_1.CardContent>
        </card_1.Card>
      </div>

      <tabs_1.Tabs defaultValue="overview" className="space-y-4">
        <tabs_1.TabsList>
          <tabs_1.TabsTrigger value="overview">Overview</tabs_1.TabsTrigger>
          <tabs_1.TabsTrigger value="analytics">Analytics</tabs_1.TabsTrigger>
        </tabs_1.TabsList>
        <tabs_1.TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
            <card_1.Card className="col-span-4">
              <card_1.CardHeader>
                <card_1.CardTitle>Sales Overview</card_1.CardTitle>
              </card_1.CardHeader>
              <card_1.CardContent className="pl-2">
                <sales_chart_1.SalesChart orders={orderState.orders}/>
              </card_1.CardContent>
            </card_1.Card>
            <card_1.Card className="col-span-3">
              <card_1.CardHeader>
                <card_1.CardTitle>Recent Orders</card_1.CardTitle>
                <card_1.CardDescription>{pendingOrders} orders pending</card_1.CardDescription>
              </card_1.CardHeader>
              <card_1.CardContent>
                <recent_orders_1.RecentOrders orders={orderState.activeOrders.slice(0, 5)}/>
              </card_1.CardContent>
            </card_1.Card>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
            <card_1.Card className="col-span-3">
              <card_1.CardHeader>
                <card_1.CardTitle>Popular Items</card_1.CardTitle>
                <card_1.CardDescription>Top selling menu items</card_1.CardDescription>
              </card_1.CardHeader>
              <card_1.CardContent>
                <popular_items_1.PopularItems menuItems={menuState.items.filter((item) => item.popular)}/>
              </card_1.CardContent>
            </card_1.Card>
            <card_1.Card className="col-span-4">
              <card_1.CardHeader>
                <card_1.CardTitle>Table Status</card_1.CardTitle>
                <card_1.CardDescription>Current table occupancy</card_1.CardDescription>
              </card_1.CardHeader>
              <card_1.CardContent>
                <table_status_1.TableStatus tables={tableState.tables}/>
              </card_1.CardContent>
            </card_1.Card>
          </div>
        </tabs_1.TabsContent>
        <tabs_1.TabsContent value="analytics">
          <card_1.Card>
            <card_1.CardHeader>
              <card_1.CardTitle>Advanced Analytics</card_1.CardTitle>
              <card_1.CardDescription>Detailed sales and performance metrics</card_1.CardDescription>
            </card_1.CardHeader>
            <card_1.CardContent className="pl-2">
              <p>Advanced analytics will be implemented in a future update.</p>
            </card_1.CardContent>
          </card_1.Card>
        </tabs_1.TabsContent>
      </tabs_1.Tabs>
    </div>);
}
