"use client"

import { useState } from "react"
import { useCart } from "@/context/CartContext"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { toast } from "@/components/ui/use-toast"
import type { MenuItem, CartModifierSelection } from "@/types"

interface ItemCustomizationModalProps {
  item: MenuItem
  isOpen: boolean
  onClose: () => void
  existingItem?: {
    id: string
    quantity: number
    modifiers: CartModifierSelection[]
    specialInstructions?: string
  }
}

export function ItemCustomizationModal({ item, isOpen, onClose, existingItem }: ItemCustomizationModalProps) {
  const { addItem, updateItemModifiers, updateSpecialInstructions, updateQuantity } = useCart()

  const [quantity, setQuantity] = useState(existingItem?.quantity || 1)
  const [specialInstructions, setSpecialInstructions] = useState(existingItem?.specialInstructions || "")
  const [selectedModifiers, setSelectedModifiers] = useState<CartModifierSelection[]>(existingItem?.modifiers || [])

  const handleQuantityChange = (change: number) => {
    const newQuantity = quantity + change
    if (newQuantity > 0) {
      setQuantity(newQuantity)
    }
  }

  const handleModifierChange = (modifierId: string, optionId: string, multiple: boolean) => {
    setSelectedModifiers((prev) => {
      // Find if this modifier already exists in selections
      const existingModifierIndex = prev.findIndex((mod) => mod.modifierId === modifierId)

      if (existingModifierIndex >= 0) {
        // Modifier exists, update its options
        const updatedModifiers = [...prev]
        const currentMod = updatedModifiers[existingModifierIndex]

        if (multiple) {
          // For checkboxes (multiple selections allowed)
          const optionIndex = currentMod.optionIds.indexOf(optionId)
          if (optionIndex >= 0) {
            // Remove option if already selected
            currentMod.optionIds = currentMod.optionIds.filter((id) => id !== optionId)
          } else {
            // Add option if not selected
            currentMod.optionIds = [...currentMod.optionIds, optionId]
          }

          // If no options left, remove the modifier
          if (currentMod.optionIds.length === 0) {
            return updatedModifiers.filter((mod) => mod.modifierId !== modifierId)
          }

          return updatedModifiers
        } else {
          // For radio buttons (single selection)
          currentMod.optionIds = [optionId]
          return updatedModifiers
        }
      } else {
        // Modifier doesn't exist, add it
        return [...prev, { modifierId, optionIds: [optionId] }]
      }
    })
  }

  const isOptionSelected = (modifierId: string, optionId: string) => {
    const modifier = selectedModifiers.find((mod) => mod.modifierId === modifierId)
    return modifier ? modifier.optionIds.includes(optionId) : false
  }

  const handleSubmit = () => {
    if (existingItem) {
      // Update existing item
      updateQuantity(existingItem.id, quantity)
      updateItemModifiers(existingItem.id, selectedModifiers)
      updateSpecialInstructions(existingItem.id, specialInstructions)
    } else {
      // Add new item
      addItem(item, quantity, selectedModifiers, specialInstructions)
    }

    toast({
      title: existingItem ? "Item updated" : "Item added",
      description: `${quantity}x ${item.title} ${existingItem ? "updated in" : "added to"} order`,
    })

    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{existingItem ? "Edit Item" : "Customize Item"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex items-center gap-4">
            <div
              className="h-16 w-16 rounded-md bg-cover bg-center bg-no-repeat"
              style={{ backgroundImage: `url(${item.image})` }}
            />
            <div>
              <h3 className="font-medium">{item.title}</h3>
              <p className="text-sm text-muted-foreground">${item.price.toFixed(2)}</p>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <Label>Quantity</Label>
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => handleQuantityChange(-1)}
                disabled={quantity <= 1}
              >
                -
              </Button>
              <span className="w-8 text-center">{quantity}</span>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => handleQuantityChange(1)}
              >
                +
              </Button>
            </div>
          </div>

          {item.modifiers && item.modifiers.length > 0 && (
            <div className="space-y-4">
              <Label className="text-base">Options</Label>

              {item.modifiers.map((modifier) => (
                <div key={modifier.id} className="space-y-2">
                  <Label className="flex items-center justify-between">
                    <span>{modifier.name}</span>
                    {modifier.required && <span className="text-xs text-red-500">Required</span>}
                  </Label>

                  {modifier.multiple ? (
                    // Checkbox group for multiple selections
                    <div className="space-y-2">
                      {modifier.options.map((option) => (
                        <div key={option.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={option.id}
                            checked={isOptionSelected(modifier.id, option.id)}
                            onCheckedChange={() => handleModifierChange(modifier.id, option.id, true)}
                          />
                          <Label htmlFor={option.id} className="flex-1">
                            {option.name}
                          </Label>
                          {option.price > 0 && <span className="text-sm">+${option.price.toFixed(2)}</span>}
                        </div>
                      ))}
                    </div>
                  ) : (
                    // Radio group for single selection
                    <RadioGroup
                      value={selectedModifiers.find((mod) => mod.modifierId === modifier.id)?.optionIds[0] || ""}
                      onValueChange={(value) => handleModifierChange(modifier.id, value, false)}
                    >
                      {modifier.options.map((option) => (
                        <div key={option.id} className="flex items-center space-x-2">
                          <RadioGroupItem value={option.id} id={`${modifier.id}-${option.id}`} />
                          <Label htmlFor={`${modifier.id}-${option.id}`} className="flex-1">
                            {option.name}
                          </Label>
                          {option.price > 0 && <span className="text-sm">+${option.price.toFixed(2)}</span>}
                        </div>
                      ))}
                    </RadioGroup>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="specialInstructions">Special Instructions</Label>
            <Textarea
              id="specialInstructions"
              placeholder="Any special requests or instructions"
              value={specialInstructions}
              onChange={(e) => setSpecialInstructions(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>{existingItem ? "Update Item" : "Add to Order"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
