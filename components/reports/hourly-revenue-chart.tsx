"use client"

import { useMemo } from "react"
import type { Order } from "@/types"
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

interface HourlyRevenueChartProps {
  orders: Order[]
}

export function HourlyRevenueChart({ orders }: HourlyRevenueChartProps) {
  const chartData = useMemo(() => {
    // Initialize array for 24 hours
    const hourlyData = Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      revenue: 0,
      orders: 0,
    }))

    // Aggregate data by hour
    orders.forEach((order) => {
      const orderDate = new Date(order.createdAt)
      const hour = orderDate.getHours()

      hourlyData[hour].revenue += order.total
      hourlyData[hour].orders += 1
    })

    // Format hour labels
    return hourlyData.map((data) => ({
      ...data,
      hourLabel: `${data.hour}:00`,
    }))
  }, [orders])

  return (
    <ResponsiveContainer width="100%" height={400}>
      <BarChart data={chartData}>
        <XAxis dataKey="hourLabel" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
        <YAxis
          stroke="#888888"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          tickFormatter={(value) => `$${value}`}
        />
        <Tooltip
          formatter={(value: number, name: string) => {
            if (name === "revenue") return [`$${value.toFixed(2)}`, "Revenue"]
            return [value, "Orders"]
          }}
          cursor={{ fill: "rgba(0, 0, 0, 0.05)" }}
        />
        <Bar dataKey="revenue" fill="#4ade80" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
