"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderTypeChart = OrderTypeChart;
const react_1 = require("react");
const recharts_1 = require("recharts");
function OrderTypeChart({ orders }) {
    const chartData = (0, react_1.useMemo)(() => {
        // Count orders by dining mode
        const dineIn = orders.filter((order) => order.diningMode === "Dine in").length;
        const takeAway = orders.filter((order) => order.diningMode === "Take Away").length;
        const delivery = orders.filter((order) => order.diningMode === "Delivery").length;
        return [
            { name: "Dine In", value: dineIn },
            { name: "Take Away", value: takeAway },
            { name: "Delivery", value: delivery },
        ];
    }, [orders]);
    const COLORS = ["#4ade80", "#22c55e", "#16a34a"];
    return (<recharts_1.ResponsiveContainer width="100%" height={300}>
      <recharts_1.PieChart>
        <recharts_1.Pie data={chartData} cx="50%" cy="50%" labelLine={false} outerRadius={100} fill="#8884d8" dataKey="value" label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}>
          {chartData.map((entry, index) => (<recharts_1.Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]}/>))}
        </recharts_1.Pie>
        <recharts_1.Tooltip formatter={(value) => [`${value} orders`, "Count"]}/>
        <recharts_1.Legend />
      </recharts_1.PieChart>
    </recharts_1.ResponsiveContainer>);
}
