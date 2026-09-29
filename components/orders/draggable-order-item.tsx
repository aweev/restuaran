"use client"

import type React from "react"

import { useState, useRef } from "react"
import { useDragDrop } from "@/context/DragDropContext"
import { cn } from "@/lib/utils"
import { GripVertical, X } from "lucide-react"
import { Button } from "@/components/ui/button"

type DraggableOrderItemProps = {
  id: string
  name: string
  price: number
  quantity: number
  onRemove: (id: string) => void
  onQuantityChange: (id: string, quantity: number) => void
  index: number
}

export function DraggableOrderItem({
  id,
  name,
  price,
  quantity,
  onRemove,
  onQuantityChange,
  index,
}: DraggableOrderItemProps) {
  const { setIsDragging, setDragItem } = useDragDrop()
  const [isDraggingThis, setIsDraggingThis] = useState(false)
  const dragRef = useRef<HTMLDivElement>(null)
  const dragStartPosRef = useRef<{ x: number; y: number } | null>(null)
  const dragCurrentPosRef = useRef<{ x: number; y: number } | null>(null)

  const handleDragStart = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault()

    // Set initial position
    dragStartPosRef.current = { x: e.clientX, y: e.clientY }
    dragCurrentPosRef.current = { x: e.clientX, y: e.clientY }

    // Set dragging state
    setIsDraggingThis(true)
    setIsDragging(true)
    setDragItem({
      id,
      type: "orderItem",
      data: { id, name, price, quantity, index },
    })

    // Add event listeners for drag movement and end
    document.addEventListener("mousemove", handleDragMove)
    document.addEventListener("mouseup", handleDragEnd)
  }

  const handleDragMove = (e: MouseEvent) => {
    if (!dragStartPosRef.current || !dragRef.current) return

    dragCurrentPosRef.current = { x: e.clientX, y: e.clientY }

    // Calculate the difference from the start position
    const dx = dragCurrentPosRef.current.x - dragStartPosRef.current.x
    const dy = dragCurrentPosRef.current.y - dragStartPosRef.current.y

    // Apply transform to the element
    dragRef.current.style.transform = `translate(${dx}px, ${dy}px)`
    dragRef.current.style.zIndex = "50"
  }

  const handleDragEnd = () => {
    // Reset position and state
    if (dragRef.current) {
      dragRef.current.style.transform = ""
      dragRef.current.style.zIndex = ""
    }

    setIsDraggingThis(false)
    setIsDragging(false)
    setDragItem(null)

    // Remove event listeners
    document.removeEventListener("mousemove", handleDragMove)
    document.removeEventListener("mouseup", handleDragEnd)
  }

  return (
    <div
      ref={dragRef}
      className={cn(
        "flex items-center justify-between rounded-md border p-3 mb-2 bg-background",
        isDraggingThis && "opacity-50 cursor-grabbing",
        !isDraggingThis && "cursor-grab",
      )}
      data-order-item-id={id}
      data-index={index}
    >
      <div className="flex items-center gap-2">
        <div className="p-1 cursor-grab touch-none" onMouseDown={handleDragStart} aria-label="Drag to reorder">
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="flex-1">
          <div className="font-medium">{name}</div>
          <div className="text-sm text-muted-foreground">${price.toFixed(2)}</div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex items-center border rounded-md">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-r-none"
            onClick={() => onQuantityChange(id, Math.max(1, quantity - 1))}
            aria-label="Decrease quantity"
          >
            -
          </Button>
          <div className="w-8 text-center">{quantity}</div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-l-none"
            onClick={() => onQuantityChange(id, quantity + 1)}
            aria-label="Increase quantity"
          >
            +
          </Button>
        </div>
        <div className="w-20 text-right font-medium">${(price * quantity).toFixed(2)}</div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-destructive"
          onClick={() => onRemove(id)}
          aria-label="Remove item"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
