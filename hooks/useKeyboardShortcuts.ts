"use client"

import { useEffect } from "react"

export interface ShortcutConfig {
  key: string
  ctrlKey?: boolean
  altKey?: boolean
  shiftKey?: boolean
  metaKey?: boolean
  callback: () => void
  description?: string
}

export function useKeyboardShortcuts(shortcuts: ShortcutConfig[]) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      shortcuts.forEach((shortcut) => {
        const matchesKey = event.key.toLowerCase() === shortcut.key.toLowerCase()
        const matchesCtrl = shortcut.ctrlKey ? (event.ctrlKey || event.metaKey) : true
        const matchesAlt = shortcut.altKey ? event.altKey : true
        const matchesShift = shortcut.shiftKey ? event.shiftKey : true

        if (matchesKey && matchesCtrl && matchesAlt && matchesShift) {
          event.preventDefault()
          shortcut.callback()
        }
      })
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [shortcuts])
}
