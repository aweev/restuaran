"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SalesReportChart = SalesReportChart;
const react_1 = require("react");
const date_fns_1 = require("date-fns");
const recharts_1 = require("recharts");
function SalesReportChart({ orders, dateRange }) {
    const chartData = (0, react_1.useMemo)(() => {
        // Generate data for each day in the date range
        const days = (0, date_fns_1.eachDayOfInterval)({
            start: dateRange.from,
            end: dateRange.to,
        });
        return days.map((day) => {
            // Filter orders for this day
            const dayOrders = orders.filter((order) => {
                const orderDate = new Date(order.createdAt);
                return (0, date_fns_1.isSameDay)(orderDate, day);
            });
            // Calculate total sales and order count for this day
            const totalSales = dayOrders.reduce((sum, order) => sum + order.total, 0);
            const orderCount = dayOrders.length;
            return {
                date: (0, date_fns_1.format)(day, "MMM dd"),
                sales: totalSales,
                orders: orderCount,
            };
        });
    }, [orders, dateRange]);
    return (<recharts_1.ResponsiveContainer width="100%" height={400}>
      <recharts_1.BarChart data={chartData}>
        <recharts_1.XAxis dataKey="date" stroke="#888888" fontSize={12} tickLine={false} axisLine={false}/>
        <recharts_1.YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value}`}/>
        <recharts_1.Tooltip formatter={(value, name) => {
            if (name === "sales")
                return [`$${value.toFixed(2)}`, "Sales"];
            return [value, "Orders"];
        }} cursor={{ fill: "rgba(0, 0, 0, 0.05)" }}/>
        <recharts_1.Bar dataKey="sales" fill="#4ade80" radius={[4, 4, 0, 0]}/>
      </recharts_1.BarChart>
    </recharts_1.ResponsiveContainer>);
}
