"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DateRangePicker } from "@/components/date-range-picker"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend, ResponsiveContainer, LineChart, Line } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { addDays, format, startOfDay, endOfDay } from "date-fns"
import { useOrder } from "@/context/OrderContext"

export function KitchenPerformanceMetrics() {
  const { state } = useOrder()
  const [dateRange, setDateRange] = useState({
    from: startOfDay(addDays(new Date(), -7)),
    to: endOfDay(new Date()),
  })

  const [prepTimeData, setPrepTimeData] = useState<{ day: string; avgPrepTime: number }[]>([])
  const [volumeData, setVolumeData] = useState<{ day: string; total: number; completed: number }[]>([])
  const [efficiencyData, setEfficiencyData] = useState<{ day: string; efficiency: number }[]>([])

  // Calculate metrics when orders or date range changes
  useEffect(() => {
    // Filter orders by date range
    const filteredOrders = state.orders.filter((order) => {
      const orderDate = new Date(order.createdAt)
      return orderDate >= dateRange.from && orderDate <= dateRange.to
    })

    // Calculate preparation time data (average time by day)
    const prepTimeByDay = filteredOrders.reduce(
      (acc, order) => {
        const day = format(new Date(order.createdAt), "MMM d")
        const createdTime = new Date(order.createdAt).getTime()
        const updatedTime = new Date(order.updatedAt).getTime()
        const prepTime = Math.round((updatedTime - createdTime) / 60000) // in minutes

        if (!acc[day]) {
          acc[day] = { total: 0, count: 0 }
        }

        acc[day].total += prepTime
        acc[day].count += 1

        return acc
      },
      {} as Record<string, { total: number; count: number }>,
    )

    const prepTimeDataArray = Object.entries(prepTimeByDay).map(([day, data]) => ({
      day,
      avgPrepTime: Math.round(data.total / data.count),
    }))

    setPrepTimeData(prepTimeDataArray)

    // Calculate order volume by day
    const volumeByDay = filteredOrders.reduce(
      (acc, order) => {
        const day = format(new Date(order.createdAt), "MMM d")

        if (!acc[day]) {
          acc[day] = { total: 0, completed: 0 }
        }

        acc[day].total += 1

        if (order.status === "completed" || order.status === "delivered") {
          acc[day].completed += 1
        }

        return acc
      },
      {} as Record<string, { total: number; completed: number }>,
    )

    const volumeDataArray = Object.entries(volumeByDay).map(([day, data]) => ({
      day,
      total: data.total,
      completed: data.completed,
    }))

    setVolumeData(volumeDataArray)

    // Calculate efficiency data (orders completed on time)
    const efficiencyByDay = filteredOrders.reduce(
      (acc, order) => {
        if (order.status !== "completed" && order.status !== "delivered") return acc

        const day = format(new Date(order.createdAt), "MMM d")
        const createdTime = new Date(order.createdAt).getTime()
        const updatedTime = new Date(order.updatedAt).getTime()
        const prepTime = Math.round((updatedTime - createdTime) / 60000) // in minutes

        // Assume target prep time is 15 minutes
        const targetPrepTime = 15
        const onTime = prepTime <= targetPrepTime

        if (!acc[day]) {
          acc[day] = { total: 0, onTime: 0 }
        }

        acc[day].total += 1
        if (onTime) acc[day].onTime += 1

        return acc
      },
      {} as Record<string, { total: number; onTime: number }>,
    )

    const efficiencyDataArray = Object.entries(efficiencyByDay).map(([day, data]) => ({
      day,
      efficiency: Math.round((data.onTime / data.total) * 100),
    }))

    setEfficiencyData(efficiencyDataArray)
  }, [state.orders, dateRange])

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-xl">Kitchen Performance Metrics</CardTitle>
        <DateRangePicker
          from={dateRange.from}
          to={dateRange.to}
          onFromChange={(date) => setDateRange((prev) => ({ ...prev, from: startOfDay(date) }))}
          onToChange={(date) => setDateRange((prev) => ({ ...prev, to: endOfDay(date) }))}
        />
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="prepTime">
          <TabsList className="mb-4">
            <TabsTrigger value="prepTime">Preparation Time</TabsTrigger>
            <TabsTrigger value="volume">Order Volume</TabsTrigger>
            <TabsTrigger value="efficiency">Efficiency</TabsTrigger>
          </TabsList>

          <TabsContent value="prepTime">
            <div className="h-[400px]">
              <ChartContainer
                config={{
                  avgPrepTime: {
                    label: "Average Preparation Time (minutes)",
                    color: "hsl(var(--chart-1))",
                  },
                }}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={prepTimeData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="day" />
                    <YAxis />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="avgPrepTime"
                      stroke="var(--color-avgPrepTime)"
                      name="Avg Prep Time (min)"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </ChartContainer>
            </div>
          </TabsContent>

          <TabsContent value="volume">
            <div className="h-[400px]">
              <ChartContainer
                config={{
                  total: {
                    label: "Total Orders",
                    color: "hsl(var(--chart-1))",
                  },
                  completed: {
                    label: "Completed Orders",
                    color: "hsl(var(--chart-2))",
                  },
                }}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={volumeData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="day" />
                    <YAxis />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Legend />
                    <Bar dataKey="total" fill="var(--color-total)" name="Total Orders" />
                    <Bar dataKey="completed" fill="var(--color-completed)" name="Completed Orders" />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            </div>
          </TabsContent>

          <TabsContent value="efficiency">
            <div className="h-[400px]">
              <ChartContainer
                config={{
                  efficiency: {
                    label: "On-Time Completion Rate (%)",
                    color: "hsl(var(--chart-3))",
                  },
                }}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={efficiencyData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="day" />
                    <YAxis domain={[0, 100]} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="efficiency"
                      stroke="var(--color-efficiency)"
                      name="On-Time Rate (%)"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </ChartContainer>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
