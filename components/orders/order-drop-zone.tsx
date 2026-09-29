"use client"

import type React from "react"

import { useState } from "react"
import { useDragDrop, type DragItem } from "@/context/DragDropContext"
import { cn } from "@/lib/utils"

type OrderDropZoneProps = {
  id: string
  className?: string
  children?: React.ReactNode
  /**
   * Receives the dragged item's payload. Typed as `unknown` because that is what
   * `DragItem["data"]` is -- narrow it inside your handler.
   */
  onDrop: (item: DragItem["data"]) => void
  acceptTypes?: string[]
}

export function OrderDropZone({ id, className, children, onDrop, acceptTypes = ["orderItem"] }: OrderDropZoneProps) {
  const { isDragging, dragItem } = useDragDrop()
  const [isOver, setIsOver] = useState(false)

  // Check if this drop zone can accept the current drag item
  const canAccept = isDragging && dragItem && acceptTypes.includes(dragItem.type)

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    if (!canAccept) return

    e.preventDefault()
    setIsOver(true)
  }

  const handleDragLeave = () => {
    setIsOver(false)
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsOver(false)

    if (canAccept && dragItem) {
      onDrop(dragItem.data)
    }
  }

  return (
    <div
      className={cn(
        "transition-colors",
        isOver && canAccept && "bg-primary/10 border-primary",
        canAccept && !isOver && "border-dashed",
        className,
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      data-drop-zone-id={id}
    >
      {children}
    </div>
  )
}
