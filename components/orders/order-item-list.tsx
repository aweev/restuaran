"use client"

import { useCart } from "@/context/CartContext"
import { Button } from "@/components/ui/button"
import { Minus, Plus, Trash2, Edit } from "lucide-react"
import type { CartItem, MenuItem } from "@/types"

interface OrderItemListProps {
  items: CartItem[]
  onItemClick?: (item: MenuItem) => void
  editable?: boolean
}

export function OrderItemList({ items, onItemClick, editable = true }: OrderItemListProps) {
  const { removeItem, updateQuantity } = useCart()

  const handleQuantityChange = (id: string, change: number, currentQuantity: number) => {
    const newQuantity = currentQuantity + change
    if (newQuantity <= 0) {
      removeItem(id)
    } else {
      updateQuantity(id, newQuantity)
    }
  }

  if (items.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center rounded-md border border-dashed">
        <p className="text-sm text-muted-foreground">No items added to the order</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.id} className="flex items-center justify-between rounded-md border p-3">
          <div className="flex flex-1 items-center gap-3">
            <div
              className="h-10 w-10 rounded-md bg-cover bg-center bg-no-repeat"
              style={{ backgroundImage: `url(${item.image})` }}
            />
            <div className="flex-1">
              <h4 className="text-sm font-medium">{item.title}</h4>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  ${item.price.toFixed(2)} × {item.quantity}
                </span>
                <span className="font-medium">${item.totalPrice.toFixed(2)}</span>
              </div>
              {item.specialInstructions && (
                <p className="mt-1 text-xs text-muted-foreground">Note: {item.specialInstructions}</p>
              )}
              {item.modifiers && item.modifiers.length > 0 && (
                <div className="mt-1">
                  {item.modifiers.map((mod, index) => (
                    <span key={index} className="mr-1 text-xs text-muted-foreground">
                      +{mod.modifierId.split("-")[0]}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {editable && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7"
                onClick={() => handleQuantityChange(item.id, -1, item.quantity)}
              >
                <Minus className="h-3 w-3" />
              </Button>
              <span className="w-5 text-center">{item.quantity}</span>
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7"
                onClick={() => handleQuantityChange(item.id, 1, item.quantity)}
              >
                <Plus className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-red-500 hover:text-red-600"
                onClick={() => removeItem(item.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
              {onItemClick && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => {
                    // This is a placeholder since we don't have the full MenuItem object
                    // In a real implementation, you'd need to fetch the full item or store it
                    const menuItem: MenuItem = {
                      id: item.menuItemId,
                      title: item.title,
                      description: "",
                      price: item.price,
                      image: item.image || "",
                      category: "all",
                      type: item.type,
                      available: true,
                    }
                    onItemClick(menuItem)
                  }}
                >
                  <Edit className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
