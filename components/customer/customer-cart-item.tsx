"use client"

import Image from "next/image"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Minus, Plus, Trash2 } from "lucide-react"
import type { CartItem } from "@/types"

interface CustomerCartItemProps {
  item: CartItem
  onRemove: () => void
  onUpdateQuantity: (quantity: number) => void
}

export function CustomerCartItem({ item, onRemove, onUpdateQuantity }: CustomerCartItemProps) {
  const handleQuantityChange = (increment: boolean) => {
    const newQuantity = increment ? item.quantity + 1 : item.quantity - 1
    onUpdateQuantity(newQuantity)
  }

  // Format modifiers for display
  const formatModifiers = () => {
    if (!item.modifiers || item.modifiers.length === 0) {
      return null
    }

    return (
      <ul className="text-xs text-muted-foreground mt-1">
        {item.modifiers.map((modifier, index) => (
          <li key={index}>
            {/* In a real app, you'd fetch the modifier names from the menu context */}
            {/* For now, we'll just show the IDs */}
            Modifier: {modifier.optionIds.join(", ")}
          </li>
        ))}
      </ul>
    )
  }

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex gap-3">
          <div className="relative h-16 w-16 flex-shrink-0 rounded-md overflow-hidden">
            <Image
              src={item.image || "/placeholder.svg?height=64&width=64"}
              alt={item.title}
              fill
              className="object-cover"
            />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex justify-between">
              <h3 className="font-medium truncate">{item.title}</h3>
              <Button variant="ghost" size="icon" className="h-6 w-6 -mr-2" onClick={onRemove}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>

            {formatModifiers()}

            {item.specialInstructions && (
              <p className="text-xs text-muted-foreground mt-1">Note: {item.specialInstructions}</p>
            )}

            <div className="flex justify-between items-center mt-2">
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => handleQuantityChange(false)}
                  disabled={item.quantity <= 1}
                >
                  <Minus className="h-3 w-3" />
                </Button>
                <span className="w-6 text-center text-sm">{item.quantity}</span>
                <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => handleQuantityChange(true)}>
                  <Plus className="h-3 w-3" />
                </Button>
              </div>

              <div className="font-medium">${item.totalPrice.toFixed(2)}</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
