"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.KitchenPerformanceMetrics = KitchenPerformanceMetrics;
const react_1 = require("react");
const card_1 = require("@/components/ui/card");
const tabs_1 = require("@/components/ui/tabs");
const date_range_picker_1 = require("@/components/date-range-picker");
const recharts_1 = require("recharts");
const chart_1 = require("@/components/ui/chart");
const date_fns_1 = require("date-fns");
const OrderContext_1 = require("@/context/OrderContext");
function KitchenPerformanceMetrics() {
    const { state } = (0, OrderContext_1.useOrder)();
    const [dateRange, setDateRange] = (0, react_1.useState)({
        from: (0, date_fns_1.startOfDay)((0, date_fns_1.addDays)(new Date(), -7)),
        to: (0, date_fns_1.endOfDay)(new Date()),
    });
    const [prepTimeData, setPrepTimeData] = (0, react_1.useState)([]);
    const [volumeData, setVolumeData] = (0, react_1.useState)([]);
    const [efficiencyData, setEfficiencyData] = (0, react_1.useState)([]);
    // Calculate metrics when orders or date range changes
    (0, react_1.useEffect)(() => {
        // Filter orders by date range
        const filteredOrders = state.orders.filter((order) => {
            const orderDate = new Date(order.createdAt);
            return orderDate >= dateRange.from && orderDate <= dateRange.to;
        });
        // Calculate preparation time data (average time by day)
        const prepTimeByDay = filteredOrders.reduce((acc, order) => {
            const day = (0, date_fns_1.format)(new Date(order.createdAt), "MMM d");
            const createdTime = new Date(order.createdAt).getTime();
            const updatedTime = new Date(order.updatedAt).getTime();
            const prepTime = Math.round((updatedTime - createdTime) / 60000); // in minutes
            if (!acc[day]) {
                acc[day] = { total: 0, count: 0 };
            }
            acc[day].total += prepTime;
            acc[day].count += 1;
            return acc;
        }, {});
        const prepTimeDataArray = Object.entries(prepTimeByDay).map(([day, data]) => ({
            day,
            avgPrepTime: Math.round(data.total / data.count),
        }));
        setPrepTimeData(prepTimeDataArray);
        // Calculate order volume by day
        const volumeByDay = filteredOrders.reduce((acc, order) => {
            const day = (0, date_fns_1.format)(new Date(order.createdAt), "MMM d");
            if (!acc[day]) {
                acc[day] = { total: 0, completed: 0 };
            }
            acc[day].total += 1;
            if (order.status === "completed" || order.status === "delivered") {
                acc[day].completed += 1;
            }
            return acc;
        }, {});
        const volumeDataArray = Object.entries(volumeByDay).map(([day, data]) => ({
            day,
            total: data.total,
            completed: data.completed,
        }));
        setVolumeData(volumeDataArray);
        // Calculate efficiency data (orders completed on time)
        const efficiencyByDay = filteredOrders.reduce((acc, order) => {
            if (order.status !== "completed" && order.status !== "delivered")
                return acc;
            const day = (0, date_fns_1.format)(new Date(order.createdAt), "MMM d");
            const createdTime = new Date(order.createdAt).getTime();
            const updatedTime = new Date(order.updatedAt).getTime();
            const prepTime = Math.round((updatedTime - createdTime) / 60000); // in minutes
            // Assume target prep time is 15 minutes
            const targetPrepTime = 15;
            const onTime = prepTime <= targetPrepTime;
            if (!acc[day]) {
                acc[day] = { total: 0, onTime: 0 };
            }
            acc[day].total += 1;
            if (onTime)
                acc[day].onTime += 1;
            return acc;
        }, {});
        const efficiencyDataArray = Object.entries(efficiencyByDay).map(([day, data]) => ({
            day,
            efficiency: Math.round((data.onTime / data.total) * 100),
        }));
        setEfficiencyData(efficiencyDataArray);
    }, [state.orders, dateRange]);
    return (<card_1.Card>
      <card_1.CardHeader className="flex flex-row items-center justify-between pb-2">
        <card_1.CardTitle className="text-xl">Kitchen Performance Metrics</card_1.CardTitle>
        <date_range_picker_1.DateRangePicker from={dateRange.from} to={dateRange.to} onFromChange={(date) => setDateRange((prev) => (Object.assign(Object.assign({}, prev), { from: (0, date_fns_1.startOfDay)(date) })))} onToChange={(date) => setDateRange((prev) => (Object.assign(Object.assign({}, prev), { to: (0, date_fns_1.endOfDay)(date) })))}/>
      </card_1.CardHeader>
      <card_1.CardContent>
        <tabs_1.Tabs defaultValue="prepTime">
          <tabs_1.TabsList className="mb-4">
            <tabs_1.TabsTrigger value="prepTime">Preparation Time</tabs_1.TabsTrigger>
            <tabs_1.TabsTrigger value="volume">Order Volume</tabs_1.TabsTrigger>
            <tabs_1.TabsTrigger value="efficiency">Efficiency</tabs_1.TabsTrigger>
          </tabs_1.TabsList>

          <tabs_1.TabsContent value="prepTime">
            <div className="h-[400px]">
              <chart_1.ChartContainer config={{
            avgPrepTime: {
                label: "Average Preparation Time (minutes)",
                color: "hsl(var(--chart-1))",
            },
        }}>
                <recharts_1.ResponsiveContainer width="100%" height="100%">
                  <recharts_1.LineChart data={prepTimeData}>
                    <recharts_1.CartesianGrid strokeDasharray="3 3"/>
                    <recharts_1.XAxis dataKey="day"/>
                    <recharts_1.YAxis />
                    <chart_1.ChartTooltip content={<chart_1.ChartTooltipContent />}/>
                    <recharts_1.Legend />
                    <recharts_1.Line type="monotone" dataKey="avgPrepTime" stroke="var(--color-avgPrepTime)" name="Avg Prep Time (min)"/>
                  </recharts_1.LineChart>
                </recharts_1.ResponsiveContainer>
              </chart_1.ChartContainer>
            </div>
          </tabs_1.TabsContent>

          <tabs_1.TabsContent value="volume">
            <div className="h-[400px]">
              <chart_1.ChartContainer config={{
            total: {
                label: "Total Orders",
                color: "hsl(var(--chart-1))",
            },
            completed: {
                label: "Completed Orders",
                color: "hsl(var(--chart-2))",
            },
        }}>
                <recharts_1.ResponsiveContainer width="100%" height="100%">
                  <recharts_1.BarChart data={volumeData}>
                    <recharts_1.CartesianGrid strokeDasharray="3 3"/>
                    <recharts_1.XAxis dataKey="day"/>
                    <recharts_1.YAxis />
                    <chart_1.ChartTooltip content={<chart_1.ChartTooltipContent />}/>
                    <recharts_1.Legend />
                    <recharts_1.Bar dataKey="total" fill="var(--color-total)" name="Total Orders"/>
                    <recharts_1.Bar dataKey="completed" fill="var(--color-completed)" name="Completed Orders"/>
                  </recharts_1.BarChart>
                </recharts_1.ResponsiveContainer>
              </chart_1.ChartContainer>
            </div>
          </tabs_1.TabsContent>

          <tabs_1.TabsContent value="efficiency">
            <div className="h-[400px]">
              <chart_1.ChartContainer config={{
            efficiency: {
                label: "On-Time Completion Rate (%)",
                color: "hsl(var(--chart-3))",
            },
        }}>
                <recharts_1.ResponsiveContainer width="100%" height="100%">
                  <recharts_1.LineChart data={efficiencyData}>
                    <recharts_1.CartesianGrid strokeDasharray="3 3"/>
                    <recharts_1.XAxis dataKey="day"/>
                    <recharts_1.YAxis domain={[0, 100]}/>
                    <chart_1.ChartTooltip content={<chart_1.ChartTooltipContent />}/>
                    <recharts_1.Legend />
                    <recharts_1.Line type="monotone" dataKey="efficiency" stroke="var(--color-efficiency)" name="On-Time Rate (%)"/>
                  </recharts_1.LineChart>
                </recharts_1.ResponsiveContainer>
              </chart_1.ChartContainer>
            </div>
          </tabs_1.TabsContent>
        </tabs_1.Tabs>
      </card_1.CardContent>
    </card_1.Card>);
}
