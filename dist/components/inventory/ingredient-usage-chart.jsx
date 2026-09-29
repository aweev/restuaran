"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IngredientUsageChart = IngredientUsageChart;
const react_1 = require("react");
const recharts_1 = require("recharts");
function IngredientUsageChart({ ingredients }) {
    const chartData = (0, react_1.useMemo)(() => {
        return ingredients.map((ingredient) => ({
            name: ingredient.name,
            usage: ingredient.usageLastMonth,
            value: ingredient.usageLastMonth * ingredient.unitCost,
        }));
    }, [ingredients]);
    return (<recharts_1.ResponsiveContainer width="100%" height={400}>
      <recharts_1.BarChart data={chartData}>
        <recharts_1.XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false}/>
        <recharts_1.YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false}/>
        <recharts_1.Tooltip formatter={(value, name) => {
            if (name === "usage")
                return [value, "Usage"];
            return [`$${value.toFixed(2)}`, "Value"];
        }} cursor={{ fill: "rgba(0, 0, 0, 0.05)" }}/>
        <recharts_1.Bar dataKey="usage" fill="#4ade80" radius={[4, 4, 0, 0]}/>
      </recharts_1.BarChart>
    </recharts_1.ResponsiveContainer>);
}
