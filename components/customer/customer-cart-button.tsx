import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ShoppingCart } from "lucide-react"

interface CustomerCartButtonProps {
  count: number
  tableNumber?: string
}

export function CustomerCartButton({ count, tableNumber }: CustomerCartButtonProps) {
  const tableParam = tableNumber ? `?table=${tableNumber}` : ""

  return (
    <div className="fixed bottom-20 right-4 z-20">
      <Button size="lg" className="rounded-full h-14 w-14 shadow-lg" asChild>
        <Link href={`/customer/cart${tableParam}`}>
          <ShoppingCart className="h-6 w-6" />
          <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-6 w-6 flex items-center justify-center">
            {count > 99 ? "99+" : count}
          </span>
        </Link>
      </Button>
    </div>
  )
}
