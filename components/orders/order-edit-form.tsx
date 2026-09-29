"use client"

import type React from "react"

import { useState } from "react"
import { useOrder } from "@/context/OrderContext"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/use-toast"
import { Loader2, Trash2 } from "lucide-react"
import type { Order, CartItem } from "@/types"

interface OrderEditFormProps {
  order: Order
  onCancel: () => void
}

export function OrderEditForm({ order, onCancel }: OrderEditFormProps) {
  const { updateOrderItems } = useOrder()
  const [items, setItems] = useState<CartItem[]>(order.items)
  const [notes, setNotes] = useState(order.notes || "")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (items.length === 0) {
      toast({
        title: "Error",
        description: "Order must contain at least one item",
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)

    try {
      await updateOrderItems(order.id, items)

      toast({
        title: "Success",
        description: "Order updated successfully",
      })

      onCancel()
    } catch (error) {
      console.error("Error updating order:", error)
      toast({
        title: "Error",
        description: "Failed to update order",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  // This is a simplified version - in a real app, you'd need more complex item editing
  const handleRemoveItem = (itemId: string) => {
    setItems(items.filter((item) => item.id !== itemId))
  }

  const handleUpdateQuantity = (itemId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      handleRemoveItem(itemId)
      return
    }

    setItems(
      items.map((item) => {
        if (item.id === itemId) {
          const unitPrice = item.price
          return {
            ...item,
            quantity: newQuantity,
            totalPrice: unitPrice * newQuantity,
          }
        }
        return item
      }),
    )
  }

  // Calculate totals
  const subtotal = items.reduce((sum, item) => sum + item.totalPrice, 0)
  const taxRate = 0.05 // 5% tax rate
  const tax = subtotal * taxRate
  const total = subtotal + tax - (order.discount || 0)

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Edit Order #{order.id.substring(0, 8)}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="notes">Order Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Enter any special instructions or notes"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Order Items</Label>
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
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => handleUpdateQuantity(item.id, item.quantity - 1)}
                    >
                      -
                    </Button>
                    <span className="w-5 text-center">{item.quantity}</span>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => handleUpdateQuantity(item.id, item.quantity + 1)}
                    >
                      +
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-red-500 hover:text-red-600"
                      onClick={() => handleRemoveItem(item.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2 border-t pt-4">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Tax ({(taxRate * 100).toFixed(0)}%):</span>
              <span>${tax.toFixed(2)}</span>
            </div>
            {order.discount > 0 && (
              <div className="flex justify-between text-red-500">
                <span>Discount:</span>
                <span>-${order.discount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold">
              <span>Total:</span>
              <span>${total.toFixed(2)}</span>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Updating...
              </>
            ) : (
              "Update Order"
            )}
          </Button>
        </CardFooter>
      </Card>
    </form>
  )
}
