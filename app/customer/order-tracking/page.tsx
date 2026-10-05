"use client"

import Link from "next/link"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { toast } from "@/components/ui/use-toast"
import { CustomerHeader } from "@/components/customer/customer-header"
import { CustomerFooter } from "@/components/customer/customer-footer"
import { Loader2, Clock, CheckCircle2, Bell, X } from "lucide-react"
import type { Order, OrderStatus } from "@/types"

export default function OrderTrackingPage() {
  const searchParams = useSearchParams()
  const orderId = searchParams.get("orderId")
  const tableNumber = searchParams.get("table")
  
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  useEffect(() => {
    const fetchOrder = async () => {
      if (!orderId) {
        setError("No order ID provided")
        setLoading(false)
        return
      }
      
      try {
        const response = await fetch(`/api/customer/orders/${orderId}`)
        
        if (!response.ok) {
          throw new Error("Failed to fetch order")
        }
        
        const data = await response.json()
        setOrder(data)
      } catch (error) {
        console.error("Error fetching order:", error)
        setError("Failed to load order details")
      } finally {
        setLoading(false)
      }
    }
    
    fetchOrder()
    
    // Set up polling for order updates
    const intervalId = setInterval(() => {
      fetchOrder()
    }, 30000) // Poll every 30 seconds
    
    return () => clearInterval(intervalId)
  }, [orderId])
  
  const getStatusStep = (status: OrderStatus) => {
    switch (status) {
      case "pending":
        return 1
      case "preparing":
        return 2
      case "ready":
        return 3
      case "delivered":
      case "completed":
        return 4
      case "cancelled":
        return -1
      default:
        return 0
    }
  }
  
  const getEstimatedTime = (status: OrderStatus) => {
    switch (status) {
      case "pending":
        return "10-15 minutes"
      case "preparing":
        return "5-10 minutes"
      case "ready":
        return "Ready now"
      case "delivered":
      case "completed":
        return "Completed"
      case "cancelled":
        return "Cancelled"
      default:
        return "Unknown"
    }
  }
  
  const getStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case "pending":
        return <Badge className="bg-yellow-500">Pending</Badge>
      case "preparing":
        return <Badge className="bg-blue-500">Preparing</Badge>
      case "ready":
        return <Badge className="bg-green-500">Ready</Badge>
      case "delivered":
        return <Badge className="bg-purple-500">Delivered</Badge>
      case "completed":
        return <Badge className="bg-green-700">Completed</Badge>
      case "cancelled":
        return <Badge variant="destructive">Cancelled</Badge>
      default:
        return <Badge variant="outline">Unknown</Badge>
    }
  }
  
  const handleCallServer = () => {
    toast({
      title: "Server notified",
      description: "A server has been notified and will assist you shortly",
    })
  }
  
  if (loading) {
    return (
      <div className="flex flex-col min-h-screen">
        <CustomerHeader tableNumber={tableNumber} showBackButton title="Order Tracking" />
        
        <main className="flex-1 container max-w-lg mx-auto px-4 py-6 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p>Loading order details...</p>
          </div>
        </main>
        
        <CustomerFooter />
      </div>
    )
  }
  
  if (error || !order) {
    return (
      <div className="flex flex-col min-h-screen">
        <CustomerHeader tableNumber={tableNumber} showBackButton title="Order Tracking" />

        <main className="flex-1 container max-w-lg mx-auto px-4 py-6">
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-8">
              <p className="text-center text-muted-foreground mb-4">{error || "Order not found"}</p>
              <form
                className="flex w-full gap-2"
                onSubmit={(e) => {
                  e.preventDefault()
                  const id = (new FormData(e.currentTarget).get("orderId") as string)?.trim()
                  if (id) window.location.href = `/customer/order-tracking?orderId=${encodeURIComponent(id)}${tableNumber ? `&table=${tableNumber}` : ""}`
                }}
              >
                <input name="orderId" placeholder="Enter order code" aria-label="Order code" className="h-11 flex-1 rounded-md border px-3" />
                <Button type="submit">Track</Button>
              </form>
              <Button asChild variant="outline" className="mt-4">
                <Link href={`/customer/menu${tableNumber ? `?table=${tableNumber}` : ""}`}>
                  Return to Menu
                </Link>
              </Button>
            </CardContent>
          </Card>
        </main>

        <CustomerFooter />
      </div>
    )
  }
  
  const statusStep = getStatusStep(order.status)
  
  return (
    <div className="flex flex-col min-h-screen">
      <CustomerHeader tableNumber={tableNumber} showBackButton title="Order Tracking" />
      
      <main className="flex-1 container max-w-lg mx-auto px-4 py-6">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle>Order #{order.id.slice(0, 8)}</CardTitle>
                  <CardDescription>
                    {new Date(order.createdAt).toLocaleString()}
                  </CardDescription>
                </div>
                {getStatusBadge(order.status)}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {order.status !== "cancelled" ? (
                  <div className="relative">
                    <div className="flex justify-between mb-2">
                      <div className="text-center">
                        <div className={`rounded-full w-8 h-8 mx-auto mb-1 flex items-center justify-center ${
                          statusStep >= 1 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                        }`}>
                          1
                        </div>
                        <p className="text-xs">Received</p>
                      </div>
                      <div className="text-center">
                        <div className={`rounded-full w-8 h-8 mx-auto mb-1 flex items-center justify-center ${
                          statusStep >= 2 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                        }`}>
                          2
                        </div>
                        <p className="text-xs">Preparing</p>
                      </div>
                      <div className="text-center">
                        <div className={`rounded-full w-8 h-8 mx-auto mb-1 flex items-center justify-center ${
                          statusStep >= 3 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                        }`}>
                          3
                        </div>
                        <p className="text-xs">Ready</p>
                      </div>
                      <div className="text-center">
                        <div className={`rounded-full w-8 h-8 mx-auto mb-1 flex items-center justify-center ${
                          statusStep >= 4 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                        }`}>
                          4
                        </div>
                        <p className="text-xs">Completed</p>
                      </div>
                    </div>
                    <div className="absolute top-4 left-8 right-8 h-1 bg-muted -z-10">
                      <div 
                        className="h-full bg-primary" 
                        style={{ 
                          width: statusStep === -1 
                            ? "0%" 
                            : `${Math.min(100, (statusStep / 4) * 100)}%` 
                        }}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="bg-red-50 p-4 rounded-md">
                    <p className="text-red-700 text-center">This order has been cancelled</p>
                  </div>
                )}
                
                <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
                  {order.status === "cancelled" ? (
                    <div className="rounded-full bg-red-100 p-2">
                      <X className="h-5 w-5 text-red-600" />
                    </div>
                  ) : order.status === "completed" || order.status === "delivered" ? (
                    <div className="rounded-full bg-green-100 p-2">
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    </div>
                  ) : (
                    <div className="rounded-full bg-blue-100 p-2">
                      <Clock className="h-5 w-5 text-blue-600" />
                    </div>
                  )}
                  
                  <div>
                    <p className="font-medium">
                      {order.status === "cancelled" 
                        ? "Order Cancelled" 
                        : order.status === "completed" || order.status === "delivered"
                        ? "Order Completed"
                        : "Estimated Time"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {order.status === "cancelled" 
                        ? "This order has been cancelled" 
                        : order.status === "completed" || order.status === "delivered"
                        ? "Your order has been completed"
                        : getEstimatedTime(order.status)}
                    </p>
                  </div>
                
                <Separator />
                
                <div>
                  <h3 className="font-medium mb-2">Order Summary</h3>
                  <ul className="space-y-2">
                    {order.items.map((item) => (
                      <li key={item.id} className="flex justify-between">
                        <span>
                          {item.quantity} × {item.title}
                        </span>
                        <span>${item.totalPrice.toFixed(2)}</span>
                      </li>
                    ))}
                  </ul>
                  
                  <Separator className="my-4" />
                  
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span>Subtotal</span>
                      <span>${order.subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Tax</span>
                      <span>${order.tax.toFixed(2)}</span>
                    </div>
                    {order.discount > 0 && (
                      <div className="flex justify-between text-green-600">
                        <span>Discount</span>
                        <span>-${order.discount.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold pt-2">
                      <span>Total</span>
                      <span>${order.total.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
                
                {order.diningMode === "Dine in" && order.status !== "cancelled" && (
                  <Button onClick={handleCallServer} className="w-full">
                    <Bell className="mr-2 h-4 w-4" />
                    Call Server
                  </Button>
                )}
                </div>
              </div>
            </CardContent>
          </Card>
          
          {order.status === "completed" || order.status === "delivered" ? (
            <Card>
              <CardHeader>
                <CardTitle>How was your experience?</CardTitle>
                <CardDescription>
                  We&apos;d love to hear your feedback about your order
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild className="w-full">
                  <Link href={`/customer/feedback?orderId=${order.id}${tableNumber ? `&table=${tableNumber}` : ""}`}>
                    Leave Feedback
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </main>
      
      <CustomerFooter />
    </div>
  )
}
