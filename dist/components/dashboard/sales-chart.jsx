"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SalesChart = SalesChart;
const react_1 = require("react");
const date_fns_1 = require("date-fns");
const recharts_1 = require("recharts");
function SalesChart({ orders }) {
    const [chartData, setChartData] = (0, react_1.useState)([]);
    (0, react_1.useEffect)(() => {
        // Generate data for the last 7 days
        const today = new Date();
        const last7Days = (0, date_fns_1.eachDayOfInterval)({
            start: (0, date_fns_1.subDays)(today, 6),
            end: today,
        });
        const data = last7Days.map((date) => {
            // Filter orders for this date
            const dayOrders = orders.filter((order) => {
                const orderDate = new Date(order.createdAt);
                return (orderDate.getDate() === date.getDate() &&
                    orderDate.getMonth() === date.getMonth() &&
                    orderDate.getFullYear() === date.getFullYear());
            });
            // Calculate total sales for this date
            const totalSales = dayOrders.reduce((sum, order) => sum + order.total, 0);
            const orderCount = dayOrders.length;
            return {
                name: (0, date_fns_1.format)(date, "EEE"),
                total: totalSales,
                orders: orderCount,
            };
        });
        setChartData(data);
    }, [orders]);
    return (<recharts_1.ResponsiveContainer width="100%" height={350}>
      <recharts_1.BarChart data={chartData}>
        <recharts_1.XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false}/>
        <recharts_1.YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value}`}/>
        <recharts_1.Tooltip formatter={(value) => [`$${value.toFixed(2)}`, "Sales"]} cursor={{ fill: "rgba(0, 0, 0, 0.05)" }}/>
        <recharts_1.Bar dataKey="total" fill="#4ade80" radius={[4, 4, 0, 0]}/>
      </recharts_1.BarChart>
    </recharts_1.ResponsiveContainer>);
}
