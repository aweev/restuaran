"use client"

import { useEffect, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/use-toast"
import { CustomerHeader } from "@/components/customer/customer-header"
import { CustomerFooter } from "@/components/customer/customer-footer"
import { CustomerCartItem } from "@/components/customer/customer-cart-item"
import { Loader2, Trash2, ShoppingCart } from "lucide-react"
import type { CartItem, DiningMode } from "@/types"
import Link from "next/link"

interface CustomerCart {
  items: CartItem[]
  tableNumber?: string
  customerName?: string
  diningMode: DiningMode
  subtotal: number
  tax: number
  total: number
  notes?: string
}

export default function CustomerCartPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const tableNumber = searchParams.get("table")

  const [cart, setCart] = useState<CustomerCart>({
    items: [],
    tableNumber: tableNumber || undefined,
    diningMode: "Dine in",
    subtotal: 0,
    tax: 0,
    total: 0,
  })

  const [customerName, setCustomerName] = useState("")
  const [notes, setNotes] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    // Load cart from localStorage
    const storedCart = localStorage.getItem("customerCart")
    if (storedCart) {
      try {
        const parsedCart = JSON.parse(storedCart)
        setCart(parsedCart)

        if (parsedCart.customerName) {
          setCustomerName(parsedCart.customerName)
        }

        if (parsedCart.notes) {
          setNotes(parsedCart.notes)
        }
      } catch (error) {
        console.error("Error parsing cart from localStorage", error)
      }
    }
  }, [])

  const updateCart = (updatedCart: CustomerCart) => {
    setCart(updatedCart)
    localStorage.setItem("customerCart", JSON.stringify(updatedCart))
  }

  const handleRemoveItem = (itemId: string) => {
    const updatedItems = cart.items.filter((item) => item.id !== itemId)

    // Recalculate totals
    const subtotal = updatedItems.reduce((sum, item) => sum + item.totalPrice, 0)
    const tax = subtotal * 0.05 // 5% tax
    const total = subtotal + tax

    const updatedCart = {
      ...cart,
      items: updatedItems,
      subtotal,
      tax,
      total,
    }

    updateCart(updatedCart)

    toast({
      title: "Item removed",
      description: "The item has been removed from your cart",
    })
  }

  const handleUpdateQuantity = (itemId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      handleRemoveItem(itemId)
      return
    }

    const updatedItems = cart.items.map((item) => {
      if (item.id === itemId) {
        const unitPrice = item.totalPrice / item.quantity
        return {
          ...item,
          quantity: newQuantity,
          totalPrice: unitPrice * newQuantity,
        }
      }
      return item
    })

    // Recalculate totals
    const subtotal = updatedItems.reduce((sum, item) => sum + item.totalPrice, 0)
    const tax = subtotal * 0.05 // 5% tax
    const total = subtotal + tax

    const updatedCart = {
      ...cart,
      items: updatedItems,
      subtotal,
      tax,
      total,
    }

    updateCart(updatedCart)
  }

  const handleDiningModeChange = (value: string) => {
    updateCart({
      ...cart,
      diningMode: value as DiningMode,
    })
  }

  const handleClearCart = () => {
    updateCart({
      items: [],
      tableNumber: cart.tableNumber,
      diningMode: cart.diningMode,
      subtotal: 0,
      tax: 0,
      total: 0,
    })

    setNotes("")

    toast({
      title: "Cart cleared",
      description: "All items have been removed from your cart",
    })
  }

  const handleSubmitOrder = async () => {
    if (cart.items.length === 0) {
      toast({
        title: "Empty cart",
        description: "Please add items to your cart before placing an order",
        variant: "destructive",
      })
      return
    }

    if (!cart.tableNumber && cart.diningMode === "Dine in") {
      toast({
        title: "Table number required",
        description: "Please provide a table number for dine-in orders",
        variant: "destructive",
      })
      return
    }

    if (!customerName) {
      toast({
        title: "Name required",
        description: "Please provide your name for the order",
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)

    try {
      // Prepare order data
      const orderData = {
        items: cart.items,
        tableId: cart.tableNumber,
        customerName,
        diningMode: cart.diningMode,
        subtotal: cart.subtotal,
        tax: cart.tax,
        total: cart.total,
        notes: notes || undefined,
        status: "pending",
      }

      // Submit order to API
      const response = await fetch("/api/customer/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(orderData),
      })

      if (!response.ok) {
        throw new Error("Failed to place order")
      }

      const data = await response.json()

      // Clear cart
      localStorage.removeItem("customerCart")

      // Store order ID for tracking
      localStorage.setItem("lastOrderId", data.id)

      toast({
        title: "Order placed successfully",
        description: "Your order has been received and is being processed",
      })

      // Redirect to order tracking page
      router.push(`/customer/order-tracking?orderId=${data.id}${cart.tableNumber ? `&table=${cart.tableNumber}` : ""}`)
    } catch (error) {
      console.error("Error submitting order:", error)
      toast({
        title: "Error",
        description: "Failed to place your order. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col min-h-screen">
      <CustomerHeader tableNumber={tableNumber} showBackButton title="Your Cart" />

      <main className="flex-1 container max-w-lg mx-auto px-4 py-6">
        <div className="space-y-6">
          {cart.items.length > 0 ? (
            <>
              <div className="space-y-4">
                {cart.items.map((item) => (
                  <CustomerCartItem
                    key={item.id}
                    item={item}
                    onRemove={() => handleRemoveItem(item.id)}
                    onUpdateQuantity={(quantity) => handleUpdateQuantity(item.id, quantity)}
                  />
                ))}
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Order Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="customer-name">Your Name</Label>
                    <Input
                      id="customer-name"
                      placeholder="Enter your name"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Dining Option</Label>
                    <RadioGroup value={cart.diningMode} onValueChange={handleDiningModeChange}>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="Dine in" id="dine-in" />
                        <Label htmlFor="dine-in">Dine in</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="Take Away" id="take-away" />
                        <Label htmlFor="take-away">Take Away</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="Delivery" id="delivery" />
                        <Label htmlFor="delivery">Delivery</Label>
                      </div>
                    </RadioGroup>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="order-notes">Special Instructions (Optional)</Label>
                    <Textarea
                      id="order-notes"
                      placeholder="Any special requests for your order?"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="resize-none"
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Subtotal</span>
                      <span>${cart.subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Tax (5%)</span>
                      <span>${cart.tax.toFixed(2)}</span>
                    </div>
                    <Separator className="my-2" />
                    <div className="flex justify-between font-bold">
                      <span>Total</span>
                      <span>${cart.total.toFixed(2)}</span>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex justify-between">
                  <Button variant="outline" onClick={handleClearCart}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Clear Cart
                  </Button>
                  <Button onClick={handleSubmitOrder} disabled={isSubmitting}>
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      "Place Order"
                    )}
                  </Button>
                </CardFooter>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <div className="rounded-full bg-muted p-3 mb-4">
                  <ShoppingCart className="h-6 w-6 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium mb-2">Your cart is empty</h3>
                <p className="text-muted-foreground text-center mb-6">
                  Add items from the menu to get started with your order
                </p>
                <Button asChild>
                  <Link href={`/customer/menu${tableNumber ? `?table=${tableNumber}` : ""}`}>Browse Menu</Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </main>

      <CustomerFooter />
    </div>
  )
}
