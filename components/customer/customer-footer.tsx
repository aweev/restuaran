"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Menu, ShoppingCart, MessageSquare, Heart } from "lucide-react"

export function CustomerFooter() {
  const searchParams = useSearchParams()
  const tableNumber = searchParams.get("table")
  const tableParam = tableNumber ? `?table=${tableNumber}` : ""

  return (
    <footer className="sticky bottom-0 z-10 bg-background border-t">
      <div className="container max-w-lg mx-auto px-4">
        <div className="grid grid-cols-4 py-2">
          <Button variant="ghost" className="flex flex-col h-auto py-2" asChild>
            <Link href={`/customer/menu${tableParam}`}>
              <Menu className="h-5 w-5 mb-1" />
              <span className="text-xs">Menu</span>
            </Link>
          </Button>

          <Button variant="ghost" className="flex flex-col h-auto py-2" asChild>
            <Link href={`/customer/cart${tableParam}`}>
              <ShoppingCart className="h-5 w-5 mb-1" />
              <span className="text-xs">Cart</span>
            </Link>
          </Button>

          <Button variant="ghost" className="flex flex-col h-auto py-2" asChild>
            <Link href={`/customer/feedback${tableParam}`}>
              <MessageSquare className="h-5 w-5 mb-1" />
              <span className="text-xs">Feedback</span>
            </Link>
          </Button>

          <Button variant="ghost" className="flex flex-col h-auto py-2" asChild>
            <Link href={`/customer/loyalty${tableParam}`}>
              <Heart className="h-5 w-5 mb-1" />
              <span className="text-xs">Loyalty</span>
            </Link>
          </Button>
        </div>
      </div>
    </footer>
  )
}
