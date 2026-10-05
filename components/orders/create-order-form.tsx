"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useCart } from "@/context/CartContext"
import { useOrder } from "@/context/OrderContext"
import { useAuth } from "@/context/AuthContext"
import { useTable } from "@/context/TableContext"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { toast } from "@/components/ui/use-toast"
import { Loader2 } from "lucide-react"
import { OrderItemList } from "./order-item-list"
import { ItemCustomizationModal } from "./item-customization-modal"
import type { MenuItem, DiningMode } from "@/types"

export function CreateOrderForm() {
  const router = useRouter()
  const { state: cartState, clearCart, setDiningMode, setTable } = useCart()
  const { createOrder } = useOrder()
  const { state: authState } = useAuth()
  const { state: tableState } = useTable()
  const [customerName, setCustomerName] = useState("")
  const [notes, setNotes] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null)
  const [isCustomizationModalOpen, setIsCustomizationModalOpen] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (cartState.items.length === 0) {
      toast({
        title: "Error",
        description: "Please add items to the order",
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)

    try {
      const order = await createOrder(
        cartState.items,
        cartState.tableId,
        customerName || cartState.customerName,
        cartState.diningMode,
        authState.user?.id || "",
        cartState.subtotal,
        cartState.discount,
        cartState.total,
        notes,
      )

      clearCart()
      toast({
        title: "Success",
        description: "Order created successfully",
      })

      // Redirect to the order details page
      router.push(`/dashboard/orders/${order.id}`)
    } catch (error) {
      console.error("Error creating order:", error)
      toast({
        title: "Error",
        description: "Failed to create order",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleItemClick = (item: MenuItem) => {
    setSelectedItem(item)
    setIsCustomizationModalOpen(true)
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Create New Order</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="diningMode">Dining Mode</Label>
              <RadioGroup
                value={cartState.diningMode}
                className="flex space-x-4"
                onValueChange={(value) => {
                  void setDiningMode(value as DiningMode)
                }}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="Dine in" id="dineIn" />
                  <Label htmlFor="dineIn">Dine In</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="Take Away" id="takeAway" />
                  <Label htmlFor="takeAway">Take Away</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="Delivery" id="delivery" />
                  <Label htmlFor="delivery">Delivery</Label>
                </div>
              </RadioGroup>
            </div>

            {cartState.diningMode === "Dine in" && (
              <div className="space-y-2">
                <Label htmlFor="table">Table</Label>
                <select
                  id="table"
                  className="w-full rounded-md border border-input bg-background px-3 py-2"
                  value={cartState.tableId || ""}
                  onChange={(e) => {
                    void setTable(e.target.value)
                  }}
                >
                  <option value="">Select a table</option>
                  {tableState.tables
                    .filter((table) => table.status === "available")
                    .map((table) => (
                      <option key={table.id} value={table.id}>
                        Table {table.number} (Capacity: {table.capacity})
                      </option>
                    ))}
                </select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="customerName">Customer Name</Label>
              <Input
                id="customerName"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Enter customer name"
              />
            </div>

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
              <OrderItemList items={cartState.items} onItemClick={handleItemClick} />
            </div>

            <div className="space-y-2 border-t pt-4">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>${cartState.subtotal.toFixed(2)}</span>
              </div>
              {cartState.discount > 0 && (
                <div className="flex justify-between text-red-500">
                  <span>Discount:</span>
                  <span>-${cartState.discount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold">
                <span>Total:</span>
                <span>${cartState.total.toFixed(2)}</span>
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                "Create Order"
              )}
            </Button>
          </CardFooter>
        </Card>
      </form>

      {selectedItem && (
        <ItemCustomizationModal
          item={selectedItem}
          isOpen={isCustomizationModalOpen}
          onClose={() => setIsCustomizationModalOpen(false)}
        />
      )}
    </>
  )
}
