"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SalesOverviewDashboard = SalesOverviewDashboard;
const react_1 = require("react");
const card_1 = require("@/components/ui/card");
const tabs_1 = require("@/components/ui/tabs");
const AnalyticsContext_1 = require("@/context/AnalyticsContext");
const date_fns_1 = require("date-fns");
const recharts_1 = require("recharts");
const lucide_react_1 = require("lucide-react");
function SalesOverviewDashboard({ dateRange }) {
    var _a, _b;
    const { salesData } = (0, AnalyticsContext_1.useAnalytics)();
    const COLORS = ["#4ade80", "#22c55e", "#16a34a", "#15803d", "#166534", "#14532d"];
    const formattedDateRange = (0, react_1.useMemo)(() => {
        return {
            from: (0, date_fns_1.format)(dateRange.from, "MMM d, yyyy"),
            to: (0, date_fns_1.format)(dateRange.to, "MMM d, yyyy"),
        };
    }, [dateRange]);
    if (!salesData) {
        return (<card_1.Card>
        <card_1.CardHeader>
          <card_1.CardTitle>Sales Overview</card_1.CardTitle>
          <card_1.CardDescription>No sales data available for the selected period</card_1.CardDescription>
        </card_1.CardHeader>
      </card_1.Card>);
    }
    return (<>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <card_1.Card>
          <card_1.CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <card_1.CardTitle className="text-sm font-medium">Total Revenue</card_1.CardTitle>
            <lucide_react_1.DollarSign className="h-4 w-4 text-muted-foreground"/>
          </card_1.CardHeader>
          <card_1.CardContent>
            <div className="text-2xl font-bold">${salesData.totalSales.toFixed(2)}</div>
            <div className="flex items-center space-x-2 text-xs text-muted-foreground">
              {salesData.comparisonToPrevious.trend === "up" ? (<lucide_react_1.ArrowUpIcon className="h-4 w-4 text-green-500"/>) : salesData.comparisonToPrevious.trend === "down" ? (<lucide_react_1.ArrowDownIcon className="h-4 w-4 text-red-500"/>) : null}
              <span className={salesData.comparisonToPrevious.trend === "up" ? "text-green-500" : "text-red-500"}>
                {salesData.comparisonToPrevious.percentage.toFixed(1)}%
              </span>
              <span>from previous period</span>
            </div>
          </card_1.CardContent>
        </card_1.Card>

        <card_1.Card>
          <card_1.CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <card_1.CardTitle className="text-sm font-medium">Total Orders</card_1.CardTitle>
            <lucide_react_1.ShoppingCart className="h-4 w-4 text-muted-foreground"/>
          </card_1.CardHeader>
          <card_1.CardContent>
            <div className="text-2xl font-bold">{salesData.totalOrders}</div>
            <p className="text-xs text-muted-foreground">Avg. ${salesData.averageOrderValue.toFixed(2)} per order</p>
          </card_1.CardContent>
        </card_1.Card>

        <card_1.Card>
          <card_1.CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <card_1.CardTitle className="text-sm font-medium">Payment Methods</card_1.CardTitle>
            <lucide_react_1.CreditCard className="h-4 w-4 text-muted-foreground"/>
          </card_1.CardHeader>
          <card_1.CardContent>
            <div className="text-2xl font-bold">{((_a = salesData.paymentMethods[0]) === null || _a === void 0 ? void 0 : _a.method) || "Cash"}</div>
            <p className="text-xs text-muted-foreground">
              {((_b = salesData.paymentMethods[0]) === null || _b === void 0 ? void 0 : _b.percentage.toFixed(0)) || 0}% of transactions
            </p>
          </card_1.CardContent>
        </card_1.Card>

        <card_1.Card>
          <card_1.CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <card_1.CardTitle className="text-sm font-medium">Peak Hours</card_1.CardTitle>
            <lucide_react_1.Clock className="h-4 w-4 text-muted-foreground"/>
          </card_1.CardHeader>
          <card_1.CardContent>
            <div className="text-2xl font-bold">
              {salesData.hourlySales.reduce((max, current) => (current.sales > max.sales ? current : max), {
            hour: 0,
            sales: 0,
            orders: 0,
        }).hour}
              :00
            </div>
            <p className="text-xs text-muted-foreground">Highest revenue hour</p>
          </card_1.CardContent>
        </card_1.Card>
      </div>

      <tabs_1.Tabs defaultValue="daily" className="space-y-4">
        <tabs_1.TabsList>
          <tabs_1.TabsTrigger value="daily">Daily</tabs_1.TabsTrigger>
          <tabs_1.TabsTrigger value="weekly">Weekly</tabs_1.TabsTrigger>
          <tabs_1.TabsTrigger value="monthly">Monthly</tabs_1.TabsTrigger>
          <tabs_1.TabsTrigger value="categories">Categories</tabs_1.TabsTrigger>
          <tabs_1.TabsTrigger value="payment">Payment Methods</tabs_1.TabsTrigger>
        </tabs_1.TabsList>

        <tabs_1.TabsContent value="daily" className="space-y-4">
          <card_1.Card>
            <card_1.CardHeader>
              <card_1.CardTitle>Daily Sales</card_1.CardTitle>
              <card_1.CardDescription>
                Sales trend from {formattedDateRange.from} to {formattedDateRange.to}
              </card_1.CardDescription>
            </card_1.CardHeader>
            <card_1.CardContent className="h-[400px]">
              <recharts_1.ResponsiveContainer width="100%" height="100%">
                <recharts_1.LineChart data={salesData.dailySales} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <recharts_1.CartesianGrid strokeDasharray="3 3"/>
                  <recharts_1.XAxis dataKey="date"/>
                  <recharts_1.YAxis />
                  <recharts_1.Tooltip formatter={(value) => `$${Number(value).toFixed(2)}`}/>
                  <recharts_1.Legend />
                  <recharts_1.Line type="monotone" dataKey="totalSales" name="Sales" stroke="#4ade80" activeDot={{ r: 8 }}/>
                  <recharts_1.Line type="monotone" dataKey="orderCount" name="Orders" stroke="#f97316" yAxisId={1}/>
                </recharts_1.LineChart>
              </recharts_1.ResponsiveContainer>
            </card_1.CardContent>
          </card_1.Card>
        </tabs_1.TabsContent>

        <tabs_1.TabsContent value="weekly" className="space-y-4">
          <card_1.Card>
            <card_1.CardHeader>
              <card_1.CardTitle>Weekly Sales</card_1.CardTitle>
              <card_1.CardDescription>Sales aggregated by week</card_1.CardDescription>
            </card_1.CardHeader>
            <card_1.CardContent className="h-[400px]">
              <recharts_1.ResponsiveContainer width="100%" height="100%">
                <recharts_1.BarChart data={salesData.weeklySales.map((sales, index) => ({
            week: `Week ${index + 1}`,
            sales,
        }))} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <recharts_1.CartesianGrid strokeDasharray="3 3"/>
                  <recharts_1.XAxis dataKey="week"/>
                  <recharts_1.YAxis />
                  <recharts_1.Tooltip formatter={(value) => `$${Number(value).toFixed(2)}`}/>
                  <recharts_1.Legend />
                  <recharts_1.Bar dataKey="sales" name="Weekly Sales" fill="#4ade80"/>
                </recharts_1.BarChart>
              </recharts_1.ResponsiveContainer>
            </card_1.CardContent>
          </card_1.Card>
        </tabs_1.TabsContent>

        <tabs_1.TabsContent value="monthly" className="space-y-4">
          <card_1.Card>
            <card_1.CardHeader>
              <card_1.CardTitle>Monthly Sales</card_1.CardTitle>
              <card_1.CardDescription>Sales aggregated by month</card_1.CardDescription>
            </card_1.CardHeader>
            <card_1.CardContent className="h-[400px]">
              <recharts_1.ResponsiveContainer width="100%" height="100%">
                <recharts_1.BarChart data={salesData.monthlySales.map((sales, index) => ({
            month: `Month ${index + 1}`,
            sales,
        }))} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <recharts_1.CartesianGrid strokeDasharray="3 3"/>
                  <recharts_1.XAxis dataKey="month"/>
                  <recharts_1.YAxis />
                  <recharts_1.Tooltip formatter={(value) => `$${Number(value).toFixed(2)}`}/>
                  <recharts_1.Legend />
                  <recharts_1.Bar dataKey="sales" name="Monthly Sales" fill="#4ade80"/>
                </recharts_1.BarChart>
              </recharts_1.ResponsiveContainer>
            </card_1.CardContent>
          </card_1.Card>
        </tabs_1.TabsContent>

        <tabs_1.TabsContent value="categories" className="space-y-4">
          <card_1.Card>
            <card_1.CardHeader>
              <card_1.CardTitle>Sales by Category</card_1.CardTitle>
              <card_1.CardDescription>Revenue distribution across menu categories</card_1.CardDescription>
            </card_1.CardHeader>
            <card_1.CardContent className="h-[400px]">
              <recharts_1.ResponsiveContainer width="100%" height="100%">
                <recharts_1.PieChart>
                  <recharts_1.Pie data={salesData.categorySales} cx="50%" cy="50%" labelLine={false} outerRadius={150} fill="#8884d8" dataKey="sales" nameKey="category" label={({ category, percentage }) => `${category}: ${percentage.toFixed(1)}%`}>
                    {salesData.categorySales.map((entry, index) => (<recharts_1.Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]}/>))}
                  </recharts_1.Pie>
                  <recharts_1.Tooltip formatter={(value) => `$${Number(value).toFixed(2)}`}/>
                  <recharts_1.Legend />
                </recharts_1.PieChart>
              </recharts_1.ResponsiveContainer>
            </card_1.CardContent>
          </card_1.Card>
        </tabs_1.TabsContent>

        <tabs_1.TabsContent value="payment" className="space-y-4">
          <card_1.Card>
            <card_1.CardHeader>
              <card_1.CardTitle>Payment Methods</card_1.CardTitle>
              <card_1.CardDescription>Distribution of payment methods used</card_1.CardDescription>
            </card_1.CardHeader>
            <card_1.CardContent className="h-[400px]">
              <recharts_1.ResponsiveContainer width="100%" height="100%">
                <recharts_1.PieChart>
                  <recharts_1.Pie data={salesData.paymentMethods} cx="50%" cy="50%" labelLine={false} outerRadius={150} fill="#8884d8" dataKey="amount" nameKey="method" label={({ method, percentage }) => `${method}: ${percentage.toFixed(1)}%`}>
                    {salesData.paymentMethods.map((entry, index) => (<recharts_1.Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]}/>))}
                  </recharts_1.Pie>
                  <recharts_1.Tooltip formatter={(value) => `$${Number(value).toFixed(2)}`}/>
                  <recharts_1.Legend />
                </recharts_1.PieChart>
              </recharts_1.ResponsiveContainer>
            </card_1.CardContent>
          </card_1.Card>
        </tabs_1.TabsContent>
      </tabs_1.Tabs>
    </>);
}
