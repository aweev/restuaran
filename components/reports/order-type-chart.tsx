"use client"

import { useMemo } from "react"
import type { Order } from "@/types"
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip, Legend } from "recharts"

interface OrderTypeChartProps {
  orders: Order[]
}

export function OrderTypeChart({ orders }: OrderTypeChartProps) {
  const chartData = useMemo(() => {
    // Count orders by dining mode
    const dineIn = orders.filter((order) => order.diningMode === "Dine in").length
    const takeAway = orders.filter((order) => order.diningMode === "Take Away").length
    const delivery = orders.filter((order) => order.diningMode === "Delivery").length

    return [
      { name: "Dine In", value: dineIn },
      { name: "Take Away", value: takeAway },
      { name: "Delivery", value: delivery },
    ]
  }, [orders])

  const COLORS = ["#4ade80", "#22c55e", "#16a34a"]

  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          labelLine={false}
          outerRadius={100}
          fill="#8884d8"
          dataKey="value"
          label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
        >
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip formatter={(value: number) => [`${value} orders`, "Count"]} />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  )
}
