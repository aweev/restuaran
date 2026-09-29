"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { CustomerMenuItemCard } from "@/components/customer/customer-menu-item-card"
import type { MenuItem } from "@/types"

interface PersonalizedRecommendationsProps {
  customerId?: string
  tableNumber?: string
  onCartUpdate?: (count: number) => void
}

export function PersonalizedRecommendations({
  customerId,
  tableNumber,
  onCartUpdate,
}: PersonalizedRecommendationsProps) {
  const [recommendations, setRecommendations] = useState<MenuItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchRecommendations = async () => {
      try {
        // If we have a customer ID, fetch personalized recommendations
        // Otherwise, fetch popular items
        const url = customerId
          ? `/api/customer/recommendations?customerId=${customerId}`
          : "/api/customer/recommendations/popular"

        const response = await fetch(url)

        if (!response.ok) {
          throw new Error("Failed to fetch recommendations")
        }

        const data = await response.json()
        setRecommendations(data)
      } catch (error) {
        console.error("Error fetching recommendations:", error)
        setError("Failed to load recommendations")
      } finally {
        setLoading(false)
      }
    }

    fetchRecommendations()
  }, [customerId])

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>
            <Skeleton className="h-6 w-3/4" />
          </CardTitle>
          <CardDescription>
            <Skeleton className="h-4 w-1/2" />
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="h-16 w-16 rounded-md" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-4 w-1/4" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recommendations</CardTitle>
          <CardDescription>Based on your preferences</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground">{error}</p>
        </CardContent>
      </Card>
    )
  }

  if (recommendations.length === 0) {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{customerId ? "Recommended for You" : "Popular Items"}</CardTitle>
        <CardDescription>
          {customerId ? "Based on your order history and preferences" : "Our most ordered items"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {recommendations.slice(0, 3).map((item) => (
            <CustomerMenuItemCard
              key={item.id}
              item={item}
              tableNumber={tableNumber}
              onCartUpdate={onCartUpdate}
              compact
            />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
