"use client"

import type React from "react"
import { createContext, useContext, useState } from "react"

type DragItem = {
  id: string
  type: string
  /**
   * Arbitrary payload attached to the dragged element. Typed as `unknown` so callers
   * must narrow it before use rather than silently inheriting `any`.
   */
  data: unknown
}

export type DragDropResult = {
  source: {
    id: string
    index: number
  }
  destination: {
    id: string
    index: number
  } | null
  draggableId: string
}

type DropResult = DragDropResult

export type { DragItem }

type DragDropContextType = {
  isDragging: boolean
  dragItem: DragItem | null
  setDragItem: (item: DragItem | null) => void
  setIsDragging: (isDragging: boolean) => void
  handleDragEnd: (result: DropResult, callback?: (result: DropResult) => void) => void
}

const DragDropContext = createContext<DragDropContextType | undefined>(undefined)

export function DragDropProvider({ children }: { children: React.ReactNode }) {
  const [isDragging, setIsDragging] = useState(false)
  const [dragItem, setDragItem] = useState<DragItem | null>(null)

  const handleDragEnd = (result: DropResult, callback?: (result: DropResult) => void) => {
    setIsDragging(false)
    setDragItem(null)

    // If no destination or dropped in the same place, do nothing
    if (
      !result.destination ||
      (result.source.id === result.destination.id && result.source.index === result.destination.index)
    ) {
      return
    }

    // Call the callback with the result
    if (callback) {
      callback(result)
    }
  }

  return (
    <DragDropContext.Provider
      value={{
        isDragging,
        dragItem,
        setDragItem,
        setIsDragging,
        handleDragEnd,
      }}
    >
      {children}
    </DragDropContext.Provider>
  )
}

export function useDragDrop() {
  const context = useContext(DragDropContext)
  if (context === undefined) {
    throw new Error("useDragDrop must be used within a DragDropProvider")
  }
  return context
}
