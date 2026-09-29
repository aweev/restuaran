"use client"

import { useState } from "react"
import type { MenuItem } from "@/types"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Edit, Trash2 } from "lucide-react"
import { useMenu } from "@/context/MenuContext"

interface MenuItemCardProps {
  menuItem: MenuItem
}

export function MenuItemCard({ menuItem }: MenuItemCardProps) {
  const { updateItemAvailability } = useMenu()
  const [isUpdating, setIsUpdating] = useState(false)

  const handleAvailabilityChange = async (available: boolean) => {
    setIsUpdating(true)
    try {
      await updateItemAvailability(menuItem.id, available)
    } catch (error) {
      console.error("Error updating item availability:", error)
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <Card>
      <div className="relative">
        {/* Menu item images come from user uploads / arbitrary CDN hosts. `next/image`
            would require an open-ended `remotePatterns` allowlist and would throw at
            runtime for any host not listed there, so a plain `img` is correct here. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={menuItem.image || "/placeholder.svg?height=200&width=400"}
          alt={menuItem.title}
          className="h-48 w-full object-cover"
        />
        {menuItem.discount && <Badge className="absolute right-2 top-2 bg-yellow-500">{menuItem.discount}% Off</Badge>}
        {menuItem.popular && <Badge className="absolute left-2 top-2 bg-red-500">Popular</Badge>}
      </div>
      <CardHeader className="p-4 pb-0">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">{menuItem.title}</h3>
          <div className="flex items-center gap-1">
            <span className={`h-2 w-2 rounded-full ${menuItem.type === "Veg" ? "bg-green-500" : "bg-red-500"}`}></span>
            <span className="text-xs text-muted-foreground">{menuItem.type}</span>
          </div>
        </div>
        <p className="text-sm text-muted-foreground line-clamp-2">{menuItem.description}</p>
      </CardHeader>
      <CardContent className="p-4 pt-2">
        <div className="flex items-center justify-between">
          <span className="font-bold text-green-600">${menuItem.price.toFixed(2)}</span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Available</span>
            <Switch checked={menuItem.available} onCheckedChange={handleAvailabilityChange} disabled={isUpdating} />
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between p-4 pt-0">
        <Button variant="outline" size="sm">
          <Edit className="mr-2 h-4 w-4" /> Edit
        </Button>
        <Button variant="outline" size="sm" className="text-red-500 hover:text-red-600">
          <Trash2 className="mr-2 h-4 w-4" /> Delete
        </Button>
      </CardFooter>
    </Card>
  )
}
