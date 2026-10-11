import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Minus, Plus } from "lucide-react"

interface FoodCardProps {
  image: string
  title: string
  price: number
  discount?: number
  type: "Veg" | "Non Veg"
  description?: string
  onClick?: () => void
  quantity?: number
  onIncrement?: () => void
  onDecrement?: () => void
}

export function FoodCard({ image, title, price, discount, type, description, onClick, quantity = 0, onIncrement, onDecrement }: FoodCardProps) {
  const stepper = onIncrement || onDecrement
  return (
    <Card className={`overflow-hidden ${onClick && !stepper ? "cursor-pointer transition-shadow hover:shadow-md" : ""}`} onClick={stepper ? undefined : onClick}>
      <div className="relative">
        {/* Menu item images come from user uploads / arbitrary CDN hosts; see the
            note in menu-item-card.tsx for why `next/image` is not used. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={image || "/placeholder.svg"} alt={title} className="w-full h-40 object-cover" />
        {discount && (
          <div className="absolute top-2 left-2 bg-yellow-400 text-black px-2 py-1 rounded-md text-xs font-medium">
            {discount}% Off
          </div>
        )}
      </div>
      <div className="p-3">
        <h3 className="text-sm font-medium mb-1">{title}</h3>
        {description && <p className="text-xs text-muted-foreground mb-2 line-clamp-2">{description}</p>}
        <div className="flex justify-between items-center mb-2">
          <span className="text-foreground font-bold">${price.toFixed(2)}</span>
          <div className="flex items-center gap-1.5">
            <span aria-hidden="true" className={`flex h-4 w-4 items-center justify-center rounded-sm border text-[10px] font-bold ${type === "Veg" ? "border-green-700 text-green-700" : "border-red-700 text-red-700"}`}>{type === "Veg" ? "V" : "N"}</span>
            <span className="text-xs text-foreground">{type}</span>
          </div>
        </div>
        {stepper ? (
          <div className="flex items-center justify-between">
            <Button variant="outline" size="icon-lg" className="rounded-full" onClick={onDecrement} disabled={quantity <= 0} aria-label={`Remove one ${title}`}>
              <Minus className="h-4 w-4" />
            </Button>
            <span className="font-medium tabular-nums" aria-live="polite">{quantity}</span>
            <Button variant="outline" size="icon-lg" className="rounded-full" onClick={onIncrement} aria-label={`Add one ${title}`}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <Button variant="outline" size="icon-lg" className="rounded-full" onClick={(e) => { e.stopPropagation(); (onDecrement ?? onClick)?.() }} aria-label={`Remove one ${title}`}>
              <Minus className="h-4 w-4" />
            </Button>
            <span className="font-medium tabular-nums">1</span>
            <Button variant="outline" size="icon-lg" className="rounded-full" onClick={(e) => { e.stopPropagation(); (onIncrement ?? onClick)?.() }} aria-label={`Add one ${title}`}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </Card>
  )
}
