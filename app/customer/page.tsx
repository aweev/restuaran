"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { CustomerHeader } from "@/components/customer/customer-header"
import { CustomerFooter } from "@/components/customer/customer-footer"
import { PersonalizedRecommendations } from "@/components/customer/personalized-recommendations"
import { Separator } from "@/components/ui/separator"
import { Utensils, QrCode, ShoppingCart, Clock, MessageSquare, Heart } from "lucide-react"

export default function CustomerLandingPage() {
  const searchParams = useSearchParams()
  const tableNumber = searchParams.get("table")
  const [loyaltyId, setLoyaltyId] = useState<string | null>(null)
  const [lastOrderId, setLastOrderId] = useState<string | null>(null)

  useEffect(() => {
    // Check if user is logged into loyalty program
    const storedLoyaltyId = localStorage.getItem("loyaltyCustomerId")
    if (storedLoyaltyId) {
      setLoyaltyId(storedLoyaltyId)
    }

    // Check if user has a recent order
    const storedOrderId = localStorage.getItem("lastOrderId")
    if (storedOrderId) {
      setLastOrderId(storedOrderId)
    }
  }, [])

  return (
    <div className="flex flex-col min-h-screen">
      <CustomerHeader tableNumber={tableNumber} title="Welcome" />

      <main className="flex-1 container max-w-lg mx-auto px-4 py-6">
        <div className="space-y-6">
          {tableNumber && (
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold">Table {tableNumber}</h2>
                    <p className="text-sm text-muted-foreground">You&apos;re seated at table {tableNumber}</p>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <Utensils className="h-6 w-6" />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-2 gap-4">
            <Card className="col-span-2">
              <CardContent className="pt-6">
                <Link href={`/customer/menu${tableNumber ? `?table=${tableNumber}` : ""}`} className="block">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium">View Menu</h3>
                      <p className="text-sm text-muted-foreground">Browse our delicious offerings</p>
                    </div>
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <QrCode className="h-5 w-5" />
                    </div>
                  </div>
                </Link>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <Link href={`/customer/cart${tableNumber ? `?table=${tableNumber}` : ""}`} className="block">
                  <div className="flex flex-col items-center text-center gap-2">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <ShoppingCart className="h-5 w-5" />
                    </div>
                    <h3 className="font-medium">Your Cart</h3>
                  </div>
                </Link>
              </CardContent>
            </Card>

            {lastOrderId && (
              <Card>
                <CardContent className="pt-6">
                  <Link
                    href={`/customer/order-tracking?orderId=${lastOrderId}${tableNumber ? `&table=${tableNumber}` : ""}`}
                    className="block"
                  >
                    <div className="flex flex-col items-center text-center gap-2">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Clock className="h-5 w-5" />
                      </div>
                      <h3 className="font-medium">Track Order</h3>
                    </div>
                  </Link>
                </CardContent>
              </Card>
            )}

            <Card className={!lastOrderId ? "col-span-2" : ""}>
              <CardContent className="pt-6">
                <Link href={`/customer/feedback${tableNumber ? `?table=${tableNumber}` : ""}`} className="block">
                  <div className="flex flex-col items-center text-center gap-2">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <MessageSquare className="h-5 w-5" />
                    </div>
                    <h3 className="font-medium">Feedback</h3>
                  </div>
                </Link>
              </CardContent>
            </Card>

            <Card className="col-span-2">
              <CardContent className="pt-6">
                <Link href={`/customer/loyalty${tableNumber ? `?table=${tableNumber}` : ""}`} className="block">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium">Loyalty Program</h3>
                      <p className="text-sm text-muted-foreground">
                        {loyaltyId ? "View your rewards" : "Join and earn points"}
                      </p>
                    </div>
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Heart className="h-5 w-5" />
                    </div>
                  </div>
                </Link>
              </CardContent>
            </Card>
          </div>

          <Separator />

          <PersonalizedRecommendations customerId={loyaltyId || undefined} tableNumber={tableNumber || undefined} />
        </div>
      </main>

      <CustomerFooter />
    </div>
  )
}
