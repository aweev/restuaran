"use client"

import { useState } from "react"
import Image from "next/image"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/use-toast"
import { Minus, Plus, AlertCircle } from "lucide-react"
import type { MenuItem, CartItem, CartModifierSelection } from "@/types"

interface CustomerMenuItemCardProps {
  item: MenuItem
  tableNumber?: string
  onCartUpdate?: (count: number) => void
  compact?: boolean
}

export function CustomerMenuItemCard({ item, tableNumber, onCartUpdate, compact = false }: CustomerMenuItemCardProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [quantity, setQuantity] = useState(1)
  const [selectedModifiers, setSelectedModifiers] = useState<CartModifierSelection[]>([])
  const [specialInstructions, setSpecialInstructions] = useState("")

  const handleOpenDialog = () => {
    setIsDialogOpen(true)
    setQuantity(1)
    setSelectedModifiers([])
    setSpecialInstructions("")
  }

  const handleCloseDialog = () => {
    setIsDialogOpen(false)
  }

  const handleQuantityChange = (increment: boolean) => {
    setQuantity((prev) => {
      if (increment) {
        return prev + 1
      } else {
        return prev > 1 ? prev - 1 : 1
      }
    })
  }

  const handleModifierChange = (modifierId: string, optionId: string, checked: boolean) => {
    setSelectedModifiers((prev) => {
      const existingModifierIndex = prev.findIndex((m) => m.modifierId === modifierId)

      if (existingModifierIndex >= 0) {
        const updatedModifiers = [...prev]
        const modifier = updatedModifiers[existingModifierIndex]

        if (checked) {
          // Add option
          updatedModifiers[existingModifierIndex] = {
            ...modifier,
            optionIds: [...modifier.optionIds, optionId],
          }
        } else {
          // Remove option
          updatedModifiers[existingModifierIndex] = {
            ...modifier,
            optionIds: modifier.optionIds.filter((id) => id !== optionId),
          }

          // If no options left, remove the modifier
          if (updatedModifiers[existingModifierIndex].optionIds.length === 0) {
            updatedModifiers.splice(existingModifierIndex, 1)
          }
        }

        return updatedModifiers
      } else if (checked) {
        // Add new modifier with option
        return [...prev, { modifierId, optionIds: [optionId] }]
      }

      return prev
    })
  }

  const handleRadioModifierChange = (modifierId: string, optionId: string) => {
    setSelectedModifiers((prev) => {
      const existingModifierIndex = prev.findIndex((m) => m.modifierId === modifierId)

      if (existingModifierIndex >= 0) {
        const updatedModifiers = [...prev]
        updatedModifiers[existingModifierIndex] = {
          modifierId,
          optionIds: [optionId],
        }
        return updatedModifiers
      } else {
        return [...prev, { modifierId, optionIds: [optionId] }]
      }
    })
  }

  const calculateTotalPrice = () => {
    let basePrice = item.price

    // Apply discount if available
    if (item.discount) {
      basePrice = basePrice * (1 - item.discount / 100)
    }

    // Add modifier prices
    let modifierPrice = 0
    if (item.modifiers && selectedModifiers.length > 0) {
      selectedModifiers.forEach((selection) => {
        const modifier = item.modifiers?.find((m) => m.id === selection.modifierId)
        if (modifier) {
          selection.optionIds.forEach((optionId) => {
            const option = modifier.options.find((o) => o.id === optionId)
            if (option) {
              modifierPrice += option.price
            }
          })
        }
      })
    }

    return (basePrice + modifierPrice) * quantity
  }

  const addToCart = () => {
    try {
      // Check if required modifiers are selected
      if (item.modifiers) {
        const requiredModifiers = item.modifiers.filter((m) => m.required)
        for (const requiredModifier of requiredModifiers) {
          const isSelected = selectedModifiers.some((m) => m.modifierId === requiredModifier.id)
          if (!isSelected) {
            toast({
              title: "Required selection",
              description: `Please select an option for ${requiredModifier.name}`,
              variant: "destructive",
            })
            return
          }
        }
      }

      // Create cart item
      const cartItem: CartItem = {
        id: `${item.id}-${Date.now()}`,
        menuItemId: item.id,
        title: item.title,
        price: item.price,
        quantity,
        image: item.image,
        type: item.type,
        modifiers: selectedModifiers,
        specialInstructions: specialInstructions || undefined,
        totalPrice: calculateTotalPrice(),
      }

      // Get existing cart from localStorage
      const existingCartJson = localStorage.getItem("customerCart")
      const cart = existingCartJson
        ? JSON.parse(existingCartJson)
        : { items: [], tableNumber, subtotal: 0, tax: 0, total: 0 }

      // Add item to cart
      cart.items.push(cartItem)

      // Recalculate totals
      cart.subtotal = cart.items.reduce((sum: number, item: CartItem) => sum + item.totalPrice, 0)
      cart.tax = cart.subtotal * 0.05 // 5% tax
      cart.total = cart.subtotal + cart.tax

      // Save cart to localStorage
      localStorage.setItem("customerCart", JSON.stringify(cart))

      // Update cart count
      if (onCartUpdate) {
        onCartUpdate(cart.items.length)
      }

      toast({
        title: "Added to cart",
        description: `${quantity} × ${item.title} added to your cart`,
      })

      handleCloseDialog()
    } catch (error) {
      console.error("Error adding item to cart:", error)
      toast({
        title: "Error",
        description: "Failed to add item to cart",
        variant: "destructive",
      })
    }
  }

  if (compact) {
    return (
      <>
        <div className="flex gap-3 cursor-pointer hover:bg-muted/50 p-2 rounded-md" onClick={handleOpenDialog}>
          <div className="relative h-16 w-16 flex-shrink-0 rounded-md overflow-hidden">
            <Image
              src={item.image || "/placeholder.svg?height=64&width=64"}
              alt={item.title}
              fill
              className="object-cover"
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex justify-between">
              <h3 className="font-medium truncate">{item.title}</h3>
              {item.type && (
                <Badge
                  variant="outline"
                  className={`
                    ${
                      item.type === "Veg"
                        ? "bg-green-50 text-green-700 hover:bg-green-50"
                        : "bg-red-50 text-red-700 hover:bg-red-50"
                    }
                  `}
                >
                  {item.type}
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground line-clamp-1">{item.description}</p>
            <div className="flex justify-between items-center mt-1">
              <div className="font-medium">
                ${item.discount ? (item.price * (1 - item.discount / 100)).toFixed(2) : item.price.toFixed(2)}
                {item.discount && (
                  <span className="text-xs text-muted-foreground line-through ml-1">${item.price.toFixed(2)}</span>
                )}
              </div>
              <Button size="sm" variant="secondary" className="h-7 px-2 text-xs">
                Add
              </Button>
            </div>
          </div>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="sm:max-w-md">
            {/* Dialog content remains the same as the original component */}
            <DialogHeader>
              <DialogTitle>{item.title}</DialogTitle>
              <DialogDescription>{item.description}</DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="relative h-48 w-full">
                <Image
                  src={item.image || "/placeholder.svg?height=192&width=384"}
                  alt={item.title}
                  fill
                  className="object-cover rounded-md"
                />
              </div>

              <div className="flex justify-between items-center">
                <div className="font-bold text-lg">
                  ${item.discount ? (item.price * (1 - item.discount / 100)).toFixed(2) : item.price.toFixed(2)}
                  {item.discount && (
                    <span className="text-sm text-muted-foreground line-through ml-2">${item.price.toFixed(2)}</span>
                  )}
                </div>
                <Badge
                  variant="outline"
                  className={`
                  ${
                    item.type === "Veg"
                      ? "bg-green-50 text-green-700 hover:bg-green-50"
                      : "bg-red-50 text-red-700 hover:bg-red-50"
                  }
                `}
                >
                  {item.type}
                </Badge>
              </div>

              {item.allergens && item.allergens.length > 0 && (
                <div className="flex items-start gap-2 p-2 bg-amber-50 rounded-md">
                  <AlertCircle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-amber-800">Allergens</p>
                    <p className="text-xs text-amber-700">{item.allergens.join(", ")}</p>
                  </div>
                </div>
              )}

              {item.nutritionalInfo && (
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div className="p-2 bg-gray-50 rounded-md">
                    <p className="text-xs text-muted-foreground">Calories</p>
                    <p className="font-medium">{item.nutritionalInfo.calories}</p>
                  </div>
                  <div className="p-2 bg-gray-50 rounded-md">
                    <p className="text-xs text-muted-foreground">Protein</p>
                    <p className="font-medium">{item.nutritionalInfo.protein}g</p>
                  </div>
                  <div className="p-2 bg-gray-50 rounded-md">
                    <p className="text-xs text-muted-foreground">Carbs</p>
                    <p className="font-medium">{item.nutritionalInfo.carbs}g</p>
                  </div>
                  <div className="p-2 bg-gray-50 rounded-md">
                    <p className="text-xs text-muted-foreground">Fat</p>
                    <p className="font-medium">{item.nutritionalInfo.fat}g</p>
                  </div>
                </div>
              )}

              <Separator />

              {item.modifiers && item.modifiers.length > 0 && (
                <div className="space-y-4">
                  {item.modifiers.map((modifier) => (
                    <div key={modifier.id} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-base font-medium">
                          {modifier.name}
                          {modifier.required && <span className="text-red-500 ml-1">*</span>}
                        </Label>
                        {modifier.multiple ? (
                          <Badge variant="outline">Select multiple</Badge>
                        ) : (
                          <Badge variant="outline">Select one</Badge>
                        )}
                      </div>

                      {modifier.multiple ? (
                        <div className="space-y-2">
                          {modifier.options.map((option) => (
                            <div key={option.id} className="flex items-center justify-between space-x-2">
                              <div className="flex items-center space-x-2">
                                <Checkbox
                                  id={`option-${option.id}`}
                                  checked={selectedModifiers.some(
                                    (m) => m.modifierId === modifier.id && m.optionIds.includes(option.id),
                                  )}
                                  onCheckedChange={(checked) =>
                                    handleModifierChange(modifier.id, option.id, checked === true)
                                  }
                                />
                                <Label htmlFor={`option-${option.id}`} className="text-sm">
                                  {option.name}
                                </Label>
                              </div>
                              {option.price > 0 && <span className="text-sm">+${option.price.toFixed(2)}</span>}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <RadioGroup
                          value={selectedModifiers.find((m) => m.modifierId === modifier.id)?.optionIds[0] || ""}
                          onValueChange={(value) => handleRadioModifierChange(modifier.id, value)}
                        >
                          {modifier.options.map((option) => (
                            <div key={option.id} className="flex items-center justify-between space-x-2">
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value={option.id} id={`option-${option.id}`} />
                                <Label htmlFor={`option-${option.id}`} className="text-sm">
                                  {option.name}
                                </Label>
                              </div>
                              {option.price > 0 && <span className="text-sm">+${option.price.toFixed(2)}</span>}
                            </div>
                          ))}
                        </RadioGroup>
                      )}
                    </div>
                  ))}

                  <Separator />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="special-instructions">Special Instructions (Optional)</Label>
                <Textarea
                  id="special-instructions"
                  placeholder="Any special requests or allergies?"
                  value={specialInstructions}
                  onChange={(e) => setSpecialInstructions(e.target.value)}
                  className="resize-none"
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleQuantityChange(false)}
                    disabled={quantity <= 1}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="w-8 text-center">{quantity}</span>
                  <Button variant="outline" size="icon" onClick={() => handleQuantityChange(true)}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="font-bold">${calculateTotalPrice().toFixed(2)}</div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleCloseDialog}>
                Cancel
              </Button>
              <Button onClick={addToCart}>Add to Cart</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    )
  }

  return (
    <>
      <Card className="overflow-hidden cursor-pointer hover:shadow-md transition-shadow" onClick={handleOpenDialog}>
        <CardContent className="p-0">
          <div className="relative">
            <div className="h-40 w-full relative">
              <Image
                src={item.image || "/placeholder.svg?height=160&width=320"}
                alt={item.title}
                fill
                className="object-cover"
              />
            </div>
            <div className="absolute top-2 left-2 flex flex-col gap-1">
              {item.discount && <Badge className="bg-yellow-500 hover:bg-yellow-600">{item.discount}% OFF</Badge>}
              {item.popular && <Badge className="bg-red-500 hover:bg-red-600">Popular</Badge>}
            </div>
            <div className="absolute top-2 right-2">
              <Badge
                variant="outline"
                className={`
                ${
                  item.type === "Veg"
                    ? "bg-green-50 text-green-700 hover:bg-green-50"
                    : "bg-red-50 text-red-700 hover:bg-red-50"
                }
              `}
              >
                {item.type}
              </Badge>
            </div>
          </div>
          <div className="p-4">
            <h3 className="font-medium">{item.title}</h3>
            <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{item.description}</p>
            <div className="flex justify-between items-center mt-2">
              <div className="font-bold">
                ${item.discount ? (item.price * (1 - item.discount / 100)).toFixed(2) : item.price.toFixed(2)}
                {item.discount && (
                  <span className="text-sm text-muted-foreground line-through ml-2">${item.price.toFixed(2)}</span>
                )}
              </div>
              <Button size="sm" variant="secondary">
                Add
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          {/* Same dialog content as in the compact version */}
          <DialogHeader>
            <DialogTitle>{item.title}</DialogTitle>
            <DialogDescription>{item.description}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="relative h-48 w-full">
              <Image
                src={item.image || "/placeholder.svg?height=192&width=384"}
                alt={item.title}
                fill
                className="object-cover rounded-md"
              />
            </div>

            <div className="flex justify-between items-center">
              <div className="font-bold text-lg">
                ${item.discount ? (item.price * (1 - item.discount / 100)).toFixed(2) : item.price.toFixed(2)}
                {item.discount && (
                  <span className="text-sm text-muted-foreground line-through ml-2">${item.price.toFixed(2)}</span>
                )}
              </div>
              <Badge
                variant="outline"
                className={`
                ${
                  item.type === "Veg"
                    ? "bg-green-50 text-green-700 hover:bg-green-50"
                    : "bg-red-50 text-red-700 hover:bg-red-50"
                }
              `}
              >
                {item.type}
              </Badge>
            </div>

            {item.allergens && item.allergens.length > 0 && (
              <div className="flex items-start gap-2 p-2 bg-amber-50 rounded-md">
                <AlertCircle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-amber-800">Allergens</p>
                  <p className="text-xs text-amber-700">{item.allergens.join(", ")}</p>
                </div>
              </div>
            )}

            {item.nutritionalInfo && (
              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="p-2 bg-gray-50 rounded-md">
                  <p className="text-xs text-muted-foreground">Calories</p>
                  <p className="font-medium">{item.nutritionalInfo.calories}</p>
                </div>
                <div className="p-2 bg-gray-50 rounded-md">
                  <p className="text-xs text-muted-foreground">Protein</p>
                  <p className="font-medium">{item.nutritionalInfo.protein}g</p>
                </div>
                <div className="p-2 bg-gray-50 rounded-md">
                  <p className="text-xs text-muted-foreground">Carbs</p>
                  <p className="font-medium">{item.nutritionalInfo.carbs}g</p>
                </div>
                <div className="p-2 bg-gray-50 rounded-md">
                  <p className="text-xs text-muted-foreground">Fat</p>
                  <p className="font-medium">{item.nutritionalInfo.fat}g</p>
                </div>
              </div>
            )}

            <Separator />

            {item.modifiers && item.modifiers.length > 0 && (
              <div className="space-y-4">
                {item.modifiers.map((modifier) => (
                  <div key={modifier.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-base font-medium">
                        {modifier.name}
                        {modifier.required && <span className="text-red-500 ml-1">*</span>}
                      </Label>
                      {modifier.multiple ? (
                        <Badge variant="outline">Select multiple</Badge>
                      ) : (
                        <Badge variant="outline">Select one</Badge>
                      )}
                    </div>

                    {modifier.multiple ? (
                      <div className="space-y-2">
                        {modifier.options.map((option) => (
                          <div key={option.id} className="flex items-center justify-between space-x-2">
                            <div className="flex items-center space-x-2">
                              <Checkbox
                                id={`option-${option.id}`}
                                checked={selectedModifiers.some(
                                  (m) => m.modifierId === modifier.id && m.optionIds.includes(option.id),
                                )}
                                onCheckedChange={(checked) =>
                                  handleModifierChange(modifier.id, option.id, checked === true)
                                }
                              />
                              <Label htmlFor={`option-${option.id}`} className="text-sm">
                                {option.name}
                              </Label>
                            </div>
                            {option.price > 0 && <span className="text-sm">+${option.price.toFixed(2)}</span>}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <RadioGroup
                        value={selectedModifiers.find((m) => m.modifierId === modifier.id)?.optionIds[0] || ""}
                        onValueChange={(value) => handleRadioModifierChange(modifier.id, value)}
                      >
                        {modifier.options.map((option) => (
                          <div key={option.id} className="flex items-center justify-between space-x-2">
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value={option.id} id={`option-${option.id}`} />
                              <Label htmlFor={`option-${option.id}`} className="text-sm">
                                {option.name}
                              </Label>
                            </div>
                            {option.price > 0 && <span className="text-sm">+${option.price.toFixed(2)}</span>}
                          </div>
                        ))}
                      </RadioGroup>
                    )}
                  </div>
                ))}

                <Separator />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="special-instructions">Special Instructions (Optional)</Label>
              <Textarea
                id="special-instructions"
                placeholder="Any special requests or allergies?"
                value={specialInstructions}
                onChange={(e) => setSpecialInstructions(e.target.value)}
                className="resize-none"
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => handleQuantityChange(false)}
                  disabled={quantity <= 1}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <span className="w-8 text-center">{quantity}</span>
                <Button variant="outline" size="icon" onClick={() => handleQuantityChange(true)}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="font-bold">${calculateTotalPrice().toFixed(2)}</div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>
              Cancel
            </Button>
            <Button onClick={addToCart}>Add to Cart</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
