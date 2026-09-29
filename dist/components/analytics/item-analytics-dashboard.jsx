"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ItemAnalyticsDashboard = ItemAnalyticsDashboard;
const card_1 = require("@/components/ui/card");
const AnalyticsContext_1 = require("@/context/AnalyticsContext");
const recharts_1 = require("recharts");
const table_1 = require("@/components/ui/table");
const badge_1 = require("@/components/ui/badge");
const lucide_react_1 = require("lucide-react");
function ItemAnalyticsDashboard({ dateRange }) {
    const { itemData } = (0, AnalyticsContext_1.useAnalytics)();
    const COLORS = ["#4ade80", "#22c55e", "#16a34a", "#15803d", "#166534", "#14532d"];
    if (!itemData) {
        return (<card_1.Card>
        <card_1.CardHeader>
          <card_1.CardTitle>Menu Item Analytics</card_1.CardTitle>
          <card_1.CardDescription>No item data available for the selected period</card_1.CardDescription>
        </card_1.CardHeader>
      </card_1.Card>);
    }
    return (<div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <card_1.Card>
          <card_1.CardHeader>
            <card_1.CardTitle>Top Selling Items</card_1.CardTitle>
            <card_1.CardDescription>Items with highest sales volume</card_1.CardDescription>
          </card_1.CardHeader>
          <card_1.CardContent>
            <div className="space-y-4">
              {itemData.topItems.slice(0, 5).map((item, index) => (<div key={item.id} className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium leading-none">{item.name}</p>
                    <p className="text-sm text-muted-foreground">{item.category}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{item.quantitySold} sold</span>
                    {item.trend === "up" ? (<badge_1.Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                        <lucide_react_1.ArrowUpIcon className="mr-1 h-3 w-3"/>
                        {item.percentageChange}%
                      </badge_1.Badge>) : item.trend === "down" ? (<badge_1.Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                        <lucide_react_1.ArrowDownIcon className="mr-1 h-3 w-3"/>
                        {item.percentageChange}%
                      </badge_1.Badge>) : null}
                  </div>
                </div>))}
            </div>
          </card_1.CardContent>
        </card_1.Card>

        <card_1.Card>
          <card_1.CardHeader>
            <card_1.CardTitle>Worst Performing Items</card_1.CardTitle>
            <card_1.CardDescription>Items with lowest sales volume</card_1.CardDescription>
          </card_1.CardHeader>
          <card_1.CardContent>
            <div className="space-y-4">
              {itemData.worstPerformingItems.slice(0, 5).map((item, index) => (<div key={item.id} className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium leading-none">{item.name}</p>
                    <p className="text-sm text-muted-foreground">{item.category}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{item.quantitySold} sold</span>
                    {item.trend === "up" ? (<badge_1.Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                        <lucide_react_1.ArrowUpIcon className="mr-1 h-3 w-3"/>
                        {item.percentageChange}%
                      </badge_1.Badge>) : item.trend === "down" ? (<badge_1.Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                        <lucide_react_1.ArrowDownIcon className="mr-1 h-3 w-3"/>
                        {item.percentageChange}%
                      </badge_1.Badge>) : null}
                  </div>
                </div>))}
            </div>
          </card_1.CardContent>
        </card_1.Card>

        <card_1.Card>
          <card_1.CardHeader>
            <card_1.CardTitle>Total Items Sold</card_1.CardTitle>
            <card_1.CardDescription>Quantity of items sold in period</card_1.CardDescription>
          </card_1.CardHeader>
          <card_1.CardContent>
            <div className="text-3xl font-bold">{itemData.totalItemsSold}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Across {itemData.topItems.length + itemData.worstPerformingItems.length} unique menu items
            </p>
          </card_1.CardContent>
        </card_1.Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <card_1.Card>
          <card_1.CardHeader>
            <card_1.CardTitle>Category Performance</card_1.CardTitle>
            <card_1.CardDescription>Sales distribution by menu category</card_1.CardDescription>
          </card_1.CardHeader>
          <card_1.CardContent className="h-[400px]">
            <recharts_1.ResponsiveContainer width="100%" height="100%">
              <recharts_1.BarChart data={itemData.categoryPerformance} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <recharts_1.CartesianGrid strokeDasharray="3 3"/>
                <recharts_1.XAxis dataKey="category"/>
                <recharts_1.YAxis yAxisId="left" orientation="left" stroke="#4ade80"/>
                <recharts_1.YAxis yAxisId="right" orientation="right" stroke="#f97316"/>
                <recharts_1.Tooltip />
                <recharts_1.Legend />
                <recharts_1.Bar yAxisId="left" dataKey="revenue" name="Revenue ($)" fill="#4ade80"/>
                <recharts_1.Bar yAxisId="right" dataKey="itemsSold" name="Items Sold" fill="#f97316"/>
              </recharts_1.BarChart>
            </recharts_1.ResponsiveContainer>
          </card_1.CardContent>
        </card_1.Card>

        <card_1.Card>
          <card_1.CardHeader>
            <card_1.CardTitle>Item Performance by Time</card_1.CardTitle>
            <card_1.CardDescription>Top selling items by hour of day</card_1.CardDescription>
          </card_1.CardHeader>
          <card_1.CardContent className="h-[400px]">
            <recharts_1.ResponsiveContainer width="100%" height="100%">
              <recharts_1.LineChart data={itemData.itemPerformanceByTime} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <recharts_1.CartesianGrid strokeDasharray="3 3"/>
                <recharts_1.XAxis dataKey="hour" label={{ value: "Hour of Day", position: "insideBottomRight", offset: -10 }}/>
                <recharts_1.YAxis />
                <recharts_1.Tooltip formatter={(value, name, props) => [value, "Quantity Sold"]} labelFormatter={(label) => `Hour: ${label}:00`}/>
                <recharts_1.Legend />
                <recharts_1.Line type="monotone" dataKey="quantitySold" stroke="#4ade80" activeDot={{ r: 8 }}/>
              </recharts_1.LineChart>
            </recharts_1.ResponsiveContainer>
          </card_1.CardContent>
        </card_1.Card>
      </div>

      <card_1.Card>
        <card_1.CardHeader>
          <card_1.CardTitle>Detailed Item Performance</card_1.CardTitle>
          <card_1.CardDescription>Comprehensive view of all menu items</card_1.CardDescription>
        </card_1.CardHeader>
        <card_1.CardContent>
          <table_1.Table>
            <table_1.TableHeader>
              <table_1.TableRow>
                <table_1.TableHead>Item Name</table_1.TableHead>
                <table_1.TableHead>Category</table_1.TableHead>
                <table_1.TableHead className="text-right">Quantity Sold</table_1.TableHead>
                <table_1.TableHead className="text-right">Revenue</table_1.TableHead>
                <table_1.TableHead className="text-right">% of Sales</table_1.TableHead>
                <table_1.TableHead className="text-right">Trend</table_1.TableHead>
              </table_1.TableRow>
            </table_1.TableHeader>
            <table_1.TableBody>
              {[...itemData.topItems, ...itemData.worstPerformingItems]
            .sort((a, b) => b.quantitySold - a.quantitySold)
            .map((item) => (<table_1.TableRow key={item.id}>
                    <table_1.TableCell className="font-medium">{item.name}</table_1.TableCell>
                    <table_1.TableCell>{item.category}</table_1.TableCell>
                    <table_1.TableCell className="text-right">{item.quantitySold}</table_1.TableCell>
                    <table_1.TableCell className="text-right">${item.revenue.toFixed(2)}</table_1.TableCell>
                    <table_1.TableCell className="text-right">{item.percentageOfSales.toFixed(2)}%</table_1.TableCell>
                    <table_1.TableCell className="text-right">
                      {item.trend === "up" ? (<badge_1.Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                          <lucide_react_1.ArrowUpIcon className="mr-1 h-3 w-3"/>
                          {item.percentageChange}%
                        </badge_1.Badge>) : item.trend === "down" ? (<badge_1.Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                          <lucide_react_1.ArrowDownIcon className="mr-1 h-3 w-3"/>
                          {item.percentageChange}%
                        </badge_1.Badge>) : (<badge_1.Badge variant="outline">Stable</badge_1.Badge>)}
                    </table_1.TableCell>
                  </table_1.TableRow>))}
            </table_1.TableBody>
          </table_1.Table>
        </card_1.CardContent>
      </card_1.Card>
    </div>);
}
