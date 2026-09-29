"use client"

import { useMemo } from "react"
import type { Order } from "@/types"
import { format, eachDayOfInterval, isSameDay } from "date-fns"
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

interface SalesReportChartProps {
  orders: Order[]
  dateRange: { from: Date; to: Date }
}

export function SalesReportChart({ orders, dateRange }: SalesReportChartProps) {
  const chartData = useMemo(() => {
    // Generate data for each day in the date range
    const days = eachDayOfInterval({
      start: dateRange.from,
      end: dateRange.to,
    })

    return days.map((day) => {
      // Filter orders for this day
      const dayOrders = orders.filter((order) => {
        const orderDate = new Date(order.createdAt)
        return isSameDay(orderDate, day)
      })

      // Calculate total sales and order count for this day
      const totalSales = dayOrders.reduce((sum, order) => sum + order.total, 0)
      const orderCount = dayOrders.length

      return {
        date: format(day, "MMM dd"),
        sales: totalSales,
        orders: orderCount,
      }
    })
  }, [orders, dateRange])

  return (
    <ResponsiveContainer width="100%" height={400}>
      <BarChart data={chartData}>
        <XAxis dataKey="date" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
        <YAxis
          stroke="#888888"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          tickFormatter={(value) => `$${value}`}
        />
        <Tooltip
          formatter={(value: number, name: string) => {
            if (name === "sales") return [`$${value.toFixed(2)}`, "Sales"]
            return [value, "Orders"]
          }}
          cursor={{ fill: "rgba(0, 0, 0, 0.05)" }}
        />
        <Bar dataKey="sales" fill="#4ade80" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
