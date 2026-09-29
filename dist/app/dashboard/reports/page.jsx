"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = ReportsPage;
const react_1 = require("react");
const OrderContext_1 = require("@/context/OrderContext");
const MenuContext_1 = require("@/context/MenuContext");
const card_1 = require("@/components/ui/card");
const tabs_1 = require("@/components/ui/tabs");
const date_range_picker_1 = require("@/components/date-range-picker");
const sales_report_chart_1 = require("@/components/reports/sales-report-chart");
const item_sales_chart_1 = require("@/components/reports/item-sales-chart");
const order_type_chart_1 = require("@/components/reports/order-type-chart");
const hourly_revenue_chart_1 = require("@/components/reports/hourly-revenue-chart");
const report_table_1 = require("@/components/reports/report-table");
const export_buttons_1 = require("@/components/reports/export-buttons");
const export_utils_1 = require("@/lib/export-utils");
const date_fns_1 = require("date-fns");
const lucide_react_1 = require("lucide-react");
function ReportsPage() {
    const { state: orderState, fetchOrders } = (0, OrderContext_1.useOrder)();
    const { state: menuState, fetchMenu } = (0, MenuContext_1.useMenu)();
    const [loading, setLoading] = (0, react_1.useState)(true);
    const [dateRange, setDateRange] = (0, react_1.useState)({
        from: (0, date_fns_1.subDays)(new Date(), 30),
        to: new Date(),
    });
    (0, react_1.useEffect)(() => {
        const loadData = async () => {
            try {
                await Promise.all([fetchOrders(), fetchMenu()]);
            }
            catch (error) {
                console.error("Error loading report data:", error);
            }
            finally {
                setLoading(false);
            }
        };
        loadData();
    }, [fetchOrders, fetchMenu]);
    // Filter orders by date range
    const filteredOrders = orderState.orders.filter((order) => {
        const orderDate = new Date(order.createdAt);
        return orderDate >= dateRange.from && orderDate <= dateRange.to;
    });
    // Calculate total revenue
    const totalRevenue = filteredOrders.reduce((sum, order) => sum + order.total, 0);
    // Calculate average order value
    const avgOrderValue = filteredOrders.length > 0 ? totalRevenue / filteredOrders.length : 0;
    // Calculate order count by type
    const dineInOrders = filteredOrders.filter((order) => order.diningMode === "Dine in").length;
    const takeAwayOrders = filteredOrders.filter((order) => order.diningMode === "Take Away").length;
    const deliveryOrders = filteredOrders.filter((order) => order.diningMode === "Delivery").length;
    const handleExportCSV = () => {
        return (0, export_utils_1.exportOrdersToCSV)(filteredOrders);
    };
    if (loading) {
        return (<div className="flex h-full items-center justify-center">
        <lucide_react_1.Loader2 className="h-8 w-8 animate-spin text-primary"/>
      </div>);
    }
    return (<div className="space-y-4" id="reports-container">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h2 className="text-3xl font-bold tracking-tight">Reports & Analytics</h2>
        <div className="flex flex-col sm:flex-row gap-2">
          <date_range_picker_1.DateRangePicker date={dateRange} onDateChange={setDateRange}/>
          <export_buttons_1.ExportButtons onExportCSV={handleExportCSV} fileName={`sales-report-${(0, date_fns_1.format)(dateRange.from, "yyyy-MM-dd")}-to-${(0, date_fns_1.format)(dateRange.to, "yyyy-MM-dd")}`} pdfElementId="reports-container"/>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <card_1.Card>
          <card_1.CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <card_1.CardTitle className="text-sm font-medium">Total Revenue</card_1.CardTitle>
          </card_1.CardHeader>
          <card_1.CardContent>
            <div className="text-2xl font-bold">${totalRevenue.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              For period {(0, date_fns_1.format)(dateRange.from, "MMM d, yyyy")} - {(0, date_fns_1.format)(dateRange.to, "MMM d, yyyy")}
            </p>
          </card_1.CardContent>
        </card_1.Card>
        <card_1.Card>
          <card_1.CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <card_1.CardTitle className="text-sm font-medium">Orders</card_1.CardTitle>
          </card_1.CardHeader>
          <card_1.CardContent>
            <div className="text-2xl font-bold">{filteredOrders.length}</div>
            <p className="text-xs text-muted-foreground">Avg. ${avgOrderValue.toFixed(2)} per order</p>
          </card_1.CardContent>
        </card_1.Card>
        <card_1.Card>
          <card_1.CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <card_1.CardTitle className="text-sm font-medium">Dine-in vs Takeaway</card_1.CardTitle>
          </card_1.CardHeader>
          <card_1.CardContent>
            <div className="text-2xl font-bold">
              {dineInOrders} / {takeAwayOrders}
            </div>
            <p className="text-xs text-muted-foreground">{deliveryOrders} delivery orders</p>
          </card_1.CardContent>
        </card_1.Card>
        <card_1.Card>
          <card_1.CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <card_1.CardTitle className="text-sm font-medium">Top Category</card_1.CardTitle>
          </card_1.CardHeader>
          <card_1.CardContent>
            <div className="text-2xl font-bold">Main Dishes</div>
            <p className="text-xs text-muted-foreground">42% of total sales</p>
          </card_1.CardContent>
        </card_1.Card>
      </div>

      <tabs_1.Tabs defaultValue="sales" className="space-y-4">
        <tabs_1.TabsList>
          <tabs_1.TabsTrigger value="sales">Sales</tabs_1.TabsTrigger>
          <tabs_1.TabsTrigger value="items">Menu Items</tabs_1.TabsTrigger>
          <tabs_1.TabsTrigger value="hourly">Hourly Analysis</tabs_1.TabsTrigger>
          <tabs_1.TabsTrigger value="tables">Table Data</tabs_1.TabsTrigger>
        </tabs_1.TabsList>
        <tabs_1.TabsContent value="sales" className="space-y-4">
          <card_1.Card>
            <card_1.CardHeader>
              <card_1.CardTitle>Sales Overview</card_1.CardTitle>
              <card_1.CardDescription>Daily revenue for the selected period</card_1.CardDescription>
            </card_1.CardHeader>
            <card_1.CardContent className="pl-2">
              <sales_report_chart_1.SalesReportChart orders={filteredOrders} dateRange={dateRange}/>
            </card_1.CardContent>
          </card_1.Card>
          <card_1.Card>
            <card_1.CardHeader>
              <card_1.CardTitle>Order Types</card_1.CardTitle>
              <card_1.CardDescription>Distribution of order types</card_1.CardDescription>
            </card_1.CardHeader>
            <card_1.CardContent>
              <order_type_chart_1.OrderTypeChart orders={filteredOrders}/>
            </card_1.CardContent>
          </card_1.Card>
        </tabs_1.TabsContent>
        <tabs_1.TabsContent value="items" className="space-y-4">
          <card_1.Card>
            <card_1.CardHeader>
              <card_1.CardTitle>Top Selling Items</card_1.CardTitle>
              <card_1.CardDescription>Most popular menu items by quantity sold</card_1.CardDescription>
            </card_1.CardHeader>
            <card_1.CardContent>
              <item_sales_chart_1.ItemSalesChart orders={filteredOrders} menuItems={menuState.items}/>
            </card_1.CardContent>
          </card_1.Card>
        </tabs_1.TabsContent>
        <tabs_1.TabsContent value="hourly" className="space-y-4">
          <card_1.Card>
            <card_1.CardHeader>
              <card_1.CardTitle>Hourly Revenue</card_1.CardTitle>
              <card_1.CardDescription>Revenue distribution by hour of day</card_1.CardDescription>
            </card_1.CardHeader>
            <card_1.CardContent>
              <hourly_revenue_chart_1.HourlyRevenueChart orders={filteredOrders}/>
            </card_1.CardContent>
          </card_1.Card>
        </tabs_1.TabsContent>
        <tabs_1.TabsContent value="tables" className="space-y-4" id="table-report">
          <card_1.Card>
            <card_1.CardHeader className="flex flex-row items-center justify-between">
              <div>
                <card_1.CardTitle>Detailed Sales Report</card_1.CardTitle>
                <card_1.CardDescription>Comprehensive sales data for the selected period</card_1.CardDescription>
              </div>
              <export_buttons_1.ExportButtons onExportCSV={handleExportCSV} fileName={`detailed-sales-${(0, date_fns_1.format)(new Date(), "yyyy-MM-dd")}`} pdfElementId="table-report"/>
            </card_1.CardHeader>
            <card_1.CardContent>
              <report_table_1.ReportTable orders={filteredOrders}/>
            </card_1.CardContent>
          </card_1.Card>
        </tabs_1.TabsContent>
      </tabs_1.Tabs>
    </div>);
}
