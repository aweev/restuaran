"use client"

import { useState } from "react"
import type { MenuItem } from "@/types"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Edit, Trash2, Check, X } from "lucide-react"
import { useMenu } from "@/context/MenuContext"

interface MenuItemCardProps {
  menuItem: MenuItem
}

export function MenuItemCard({ menuItem }: MenuItemCardProps) {
  const { updateItemAvailability, updateItem } = useMenu()
  const [isUpdating, setIsUpdating] = useState(false)
  const [editingPrice, setEditingPrice] = useState(false)
  const [price, setPrice] = useState(menuItem.price.toFixed(2))

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

  const savePrice = async () => {
    const v = Number(price)
    if (!Number.isFinite(v) || v < 0) return
    setIsUpdating(true)
    try {
      await updateItem({ ...menuItem, price: Math.round(v * 100) / 100 })
      setEditingPrice(false)
    } catch (error) {
      console.error("Error updating price:", error)
    } finally {
      setIsUpdating(false)
    }
  }

  // No hard delete from the floor: removing an item 86's it (reversible,
  // audited) instead of destroying history the reports still need.
  const remove = async () => {
    if (!window.confirm(`Remove "${menuItem.title}" from sale? (86'd — reversible)`)) return
    setIsUpdating(true)
    try {
      await updateItemAvailability(menuItem.id, false)
    } catch (error) {
      console.error("Error removing item:", error)
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
          {editingPrice ? (
            <span className="flex items-center gap-1">
              <span className="font-bold">$</span>
              <Input type="number" min={0} step={0.01} value={price} onChange={(e) => setPrice(e.target.value)} className="h-8 w-24" aria-label={`Price for ${menuItem.title}`} />
              <Button variant="ghost" size="sm" disabled={isUpdating} onClick={() => void savePrice()} aria-label="Save price"><Check className="h-4 w-4" /></Button>
              <Button variant="ghost" size="sm" onClick={() => { setEditingPrice(false); setPrice(menuItem.price.toFixed(2)) }} aria-label="Cancel price edit"><X className="h-4 w-4" /></Button>
            </span>
          ) : (
            <span className="font-bold text-green-600">${menuItem.price.toFixed(2)}</span>
          )}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Available</span>
            <Switch checked={menuItem.available} onCheckedChange={handleAvailabilityChange} disabled={isUpdating} />
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between p-4 pt-0">
        <Button variant="outline" size="sm" onClick={() => setEditingPrice((e) => !e)}>
          <Edit className="mr-2 h-4 w-4" /> {editingPrice ? "Close" : "Price"}
        </Button>
        <Button variant="outline" size="sm" className="text-red-500 hover:text-red-600" disabled={isUpdating} onClick={() => void remove()}>
          <Trash2 className="mr-2 h-4 w-4" /> Remove
        </Button>
      </CardFooter>
    </Card>
  )
}
