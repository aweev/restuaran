"use client"

import type { Ingredient } from "@/types/inventory"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"

interface LowStockAlertProps {
  ingredients: Ingredient[]
}

export function LowStockAlert({ ingredients }: LowStockAlertProps) {
  if (ingredients.length === 0) return null

  return (
    <Alert variant="destructive">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Low Stock Alert</AlertTitle>
      <AlertDescription className="flex flex-col gap-2">
        <p>
          {ingredients.length} ingredient{ingredients.length > 1 ? "s" : ""} need to be reordered:
        </p>
        <ul className="list-disc pl-5">
          {ingredients.slice(0, 3).map((ingredient) => (
            <li key={ingredient.id}>
              {ingredient.name}: {ingredient.currentStock} {ingredient.unit} remaining (below reorder level of{" "}
              {ingredient.reorderLevel})
            </li>
          ))}
          {ingredients.length > 3 && <li>And {ingredients.length - 3} more...</li>}
        </ul>
        <div className="mt-2">
          <Button size="sm" variant="outline">
            Generate Purchase Order
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  )
}
