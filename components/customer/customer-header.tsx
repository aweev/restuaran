import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Home } from "lucide-react"

interface CustomerHeaderProps {
  tableNumber?: string | null
  showBackButton?: boolean
  title?: string
}

export function CustomerHeader({ tableNumber, showBackButton = false, title }: CustomerHeaderProps) {
  const tableParam = tableNumber ? `?table=${tableNumber}` : ""

  return (
    <header className="sticky top-0 z-10 bg-background border-b">
      <div className="container max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {showBackButton ? (
            <Button variant="ghost" size="icon" asChild>
              <Link href={`/customer/menu${tableParam}`}>
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
          ) : (
            <Button variant="ghost" size="icon" asChild>
              <Link href={`/customer${tableParam}`}>
                <Home className="h-5 w-5" />
              </Link>
            </Button>
          )}

          <div>
            <h1 className="text-lg font-medium">{title || "Restaurant Name"}</h1>
            {tableNumber && <p className="text-xs text-muted-foreground">Table {tableNumber}</p>}
          </div>
        </div>

        <div>{/* Additional header elements can go here */}</div>
      </div>
    </header>
  )
}
