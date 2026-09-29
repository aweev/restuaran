"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ItemSalesChart = ItemSalesChart;
const react_1 = require("react");
const recharts_1 = require("recharts");
function ItemSalesChart({ orders, menuItems }) {
    const chartData = (0, react_1.useMemo)(() => {
        // Create a map to count item sales
        const itemSalesMap = new Map();
        // Count occurrences of each menu item in orders
        orders.forEach((order) => {
            order.items.forEach((item) => {
                const currentCount = itemSalesMap.get(item.menuItemId);
                if (currentCount) {
                    itemSalesMap.set(item.menuItemId, {
                        count: currentCount.count + item.quantity,
                        revenue: currentCount.revenue + item.totalPrice,
                    });
                }
                else {
                    itemSalesMap.set(item.menuItemId, {
                        count: item.quantity,
                        revenue: item.totalPrice,
                    });
                }
            });
        });
        // Convert to array and sort by count
        const itemSalesArray = Array.from(itemSalesMap.entries()).map(([menuItemId, data]) => {
            const menuItem = menuItems.find((item) => item.id === menuItemId);
            return {
                name: (menuItem === null || menuItem === void 0 ? void 0 : menuItem.title) || "Unknown Item",
                count: data.count,
                revenue: data.revenue,
            };
        });
        // Sort by count and take top 10
        return itemSalesArray.sort((a, b) => b.count - a.count).slice(0, 10);
    }, [orders, menuItems]);
    const COLORS = [
        "#4ade80",
        "#22c55e",
        "#16a34a",
        "#15803d",
        "#166534",
        "#14532d",
        "#84cc16",
        "#65a30d",
        "#4d7c0f",
        "#3f6212",
    ];
    return (<recharts_1.ResponsiveContainer width="100%" height={400}>
      <recharts_1.PieChart>
        <recharts_1.Pie data={chartData} cx="50%" cy="50%" labelLine={false} outerRadius={150} fill="#8884d8" dataKey="count" label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}>
          {chartData.map((entry, index) => (<recharts_1.Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]}/>))}
        </recharts_1.Pie>
        <recharts_1.Tooltip formatter={(value, name, props) => {
            return [`${value} sold ($${props.payload.revenue.toFixed(2)})`, props.payload.name];
        }}/>
        <recharts_1.Legend />
      </recharts_1.PieChart>
    </recharts_1.ResponsiveContainer>);
}
