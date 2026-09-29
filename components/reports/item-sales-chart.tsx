"use client"

import { useMemo } from "react"
import type { Order, MenuItem } from "@/types"
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip, Legend } from "recharts"

interface ItemSalesChartProps {
  orders: Order[]
  menuItems: MenuItem[]
}

export function ItemSalesChart({ orders, menuItems }: ItemSalesChartProps) {
  const chartData = useMemo(() => {
    // Create a map to count item sales
    const itemSalesMap = new Map<string, { count: number; revenue: number }>()

    // Count occurrences of each menu item in orders
    orders.forEach((order) => {
      order.items.forEach((item) => {
        const currentCount = itemSalesMap.get(item.menuItemId)
        if (currentCount) {
          itemSalesMap.set(item.menuItemId, {
            count: currentCount.count + item.quantity,
            revenue: currentCount.revenue + item.totalPrice,
          })
        } else {
          itemSalesMap.set(item.menuItemId, {
            count: item.quantity,
            revenue: item.totalPrice,
          })
        }
      })
    })

    // Convert to array and sort by count
    const itemSalesArray = Array.from(itemSalesMap.entries()).map(([menuItemId, data]) => {
      const menuItem = menuItems.find((item) => item.id === menuItemId)
      return {
        name: menuItem?.title || "Unknown Item",
        count: data.count,
        revenue: data.revenue,
      }
    })

    // Sort by count and take top 10
    return itemSalesArray.sort((a, b) => b.count - a.count).slice(0, 10)
  }, [orders, menuItems])

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
  ]

  return (
    <ResponsiveContainer width="100%" height={400}>
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          labelLine={false}
          outerRadius={150}
          fill="#8884d8"
          dataKey="count"
          label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
        >
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        {/* Recharts passes the tooltip payload as the third formatter argument. */}
        <Tooltip
          formatter={(value: number, name: string, item: { payload?: { revenue: number; name: string } }) => {
            const payload = item?.payload
            const revenue = payload ? `$${payload.revenue.toFixed(2)}` : ""
            return [`${value} sold (${revenue})`, payload?.name ?? name]
          }}
        />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  )
}
