"use client"

import { useMemo } from "react"
import type { Ingredient } from "@/types/inventory"
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

interface IngredientUsageChartProps {
  ingredients: Ingredient[]
}

export function IngredientUsageChart({ ingredients }: IngredientUsageChartProps) {
  const chartData = useMemo(() => {
    return ingredients.map((ingredient) => ({
      name: ingredient.name,
      usage: ingredient.usageLastMonth,
      value: ingredient.usageLastMonth * ingredient.unitCost,
    }))
  }, [ingredients])

  return (
    <ResponsiveContainer width="100%" height={400}>
      <BarChart data={chartData}>
        <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
        <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
        <Tooltip
          formatter={(value: number, name: string) => {
            if (name === "usage") return [value, "Usage"]
            return [`$${value.toFixed(2)}`, "Value"]
          }}
          cursor={{ fill: "rgba(0, 0, 0, 0.05)" }}
        />
        <Bar dataKey="usage" fill="#4ade80" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
