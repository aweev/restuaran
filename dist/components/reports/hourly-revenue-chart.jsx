"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HourlyRevenueChart = HourlyRevenueChart;
const react_1 = require("react");
const recharts_1 = require("recharts");
function HourlyRevenueChart({ orders }) {
    const chartData = (0, react_1.useMemo)(() => {
        // Initialize array for 24 hours
        const hourlyData = Array.from({ length: 24 }, (_, i) => ({
            hour: i,
            revenue: 0,
            orders: 0,
        }));
        // Aggregate data by hour
        orders.forEach((order) => {
            const orderDate = new Date(order.createdAt);
            const hour = orderDate.getHours();
            hourlyData[hour].revenue += order.total;
            hourlyData[hour].orders += 1;
        });
        // Format hour labels
        return hourlyData.map((data) => (Object.assign(Object.assign({}, data), { hourLabel: `${data.hour}:00` })));
    }, [orders]);
    return (<recharts_1.ResponsiveContainer width="100%" height={400}>
      <recharts_1.BarChart data={chartData}>
        <recharts_1.XAxis dataKey="hourLabel" stroke="#888888" fontSize={12} tickLine={false} axisLine={false}/>
        <recharts_1.YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value}`}/>
        <recharts_1.Tooltip formatter={(value, name) => {
            if (name === "revenue")
                return [`$${value.toFixed(2)}`, "Revenue"];
            return [value, "Orders"];
        }} cursor={{ fill: "rgba(0, 0, 0, 0.05)" }}/>
        <recharts_1.Bar dataKey="revenue" fill="#4ade80" radius={[4, 4, 0, 0]}/>
      </recharts_1.BarChart>
    </recharts_1.ResponsiveContainer>);
}
