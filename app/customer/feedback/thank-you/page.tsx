"use client"

import { useEffect } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CustomerHeader } from "@/components/customer/customer-header"
import { CustomerFooter } from "@/components/customer/customer-footer"
import { CheckCircle2 } from "lucide-react"

export default function FeedbackThankYouPage() {
  const searchParams = useSearchParams()
  const tableNumber = searchParams.get("table")

  useEffect(() => {
    // Clear any stored order ID since feedback has been submitted
    localStorage.removeItem("lastOrderId")
  }, [])

  return (
    <div className="flex flex-col min-h-screen">
      <CustomerHeader tableNumber={tableNumber} showBackButton title="Thank You" />

      <main className="flex-1 container max-w-lg mx-auto px-4 py-6 flex items-center justify-center">
        <Card className="w-full">
          <CardContent className="pt-6 flex flex-col items-center text-center">
            <div className="rounded-full bg-green-100 p-3 mb-4">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Thank You!</h2>
            <p className="text-muted-foreground mb-4">
              We appreciate your feedback. It helps us improve our service and provide a better dining experience.
            </p>
          </CardContent>
          <CardFooter className="flex justify-center">
            <Button asChild>
              <Link href={`/customer${tableNumber ? `?table=${tableNumber}` : ""}`}>Return to Home</Link>
            </Button>
          </CardFooter>
        </Card>
      </main>

      <CustomerFooter />
    </div>
  )
}
