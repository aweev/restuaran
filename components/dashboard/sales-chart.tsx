"use client"

import { useEffect, useState } from "react"
import type { Order } from "@/types"
import { format, subDays, eachDayOfInterval } from "date-fns"
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

interface SalesChartProps {
  orders: Order[]
}

export function SalesChart({ orders }: SalesChartProps) {
  // Chart rows are derived from `orders`; each entry is { name, total, orders }.
  const [chartData, setChartData] = useState<{ name: string; total: number; orders: number }[]>([])

  useEffect(() => {
    // Generate data for the last 7 days
    const today = new Date()
    const last7Days = eachDayOfInterval({
      start: subDays(today, 6),
      end: today,
    })

    const data = last7Days.map((date) => {
      // Filter orders for this date
      const dayOrders = orders.filter((order) => {
        const orderDate = new Date(order.createdAt)
        return (
          orderDate.getDate() === date.getDate() &&
          orderDate.getMonth() === date.getMonth() &&
          orderDate.getFullYear() === date.getFullYear()
        )
      })

      // Calculate total sales for this date
      const totalSales = dayOrders.reduce((sum, order) => sum + order.total, 0)
      const orderCount = dayOrders.length

      return {
        name: format(date, "EEE"),
        total: totalSales,
        orders: orderCount,
      }
    })

    setChartData(data)
  }, [orders])

  return (
    <ResponsiveContainer width="100%" height={350}>
      <BarChart data={chartData}>
        <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
        <YAxis
          stroke="#888888"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          tickFormatter={(value) => `$${value}`}
        />
        <Tooltip
          formatter={(value: number) => [`$${value.toFixed(2)}`, "Sales"]}
          cursor={{ fill: "rgba(0, 0, 0, 0.05)" }}
        />
        <Bar dataKey="total" fill="#4ade80" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
