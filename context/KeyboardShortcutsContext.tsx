"use client"

import type React from "react"
import { createContext, useContext, useState, useEffect } from "react"

export type Shortcut = {
  id: string
  key: string
  ctrlKey?: boolean
  altKey?: boolean
  shiftKey?: boolean
  description: string
  category: string
  callback: () => void
}

type KeyboardShortcutsContextType = {
  shortcuts: Shortcut[]
  registerShortcut: (shortcut: Shortcut) => void
  unregisterShortcut: (id: string) => void
  isHelpDialogOpen: boolean
  openHelpDialog: () => void
  closeHelpDialog: () => void
}

const KeyboardShortcutsContext = createContext<KeyboardShortcutsContextType | undefined>(undefined)

export function KeyboardShortcutsProvider({ children }: { children: React.ReactNode }) {
  const [shortcuts, setShortcuts] = useState<Shortcut[]>([])
  const [isHelpDialogOpen, setIsHelpDialogOpen] = useState(false)

  const registerShortcut = (shortcut: Shortcut) => {
    setShortcuts((prev) => {
      // Replace if exists, otherwise add
      const exists = prev.some((s) => s.id === shortcut.id)
      if (exists) {
        return prev.map((s) => (s.id === shortcut.id ? shortcut : s))
      }
      return [...prev, shortcut]
    })
  }

  const unregisterShortcut = (id: string) => {
    setShortcuts((prev) => prev.filter((s) => s.id !== id))
  }

  const openHelpDialog = () => setIsHelpDialogOpen(true)
  const closeHelpDialog = () => setIsHelpDialogOpen(false)

  useEffect(() => {
    // Register global keyboard shortcut handler
    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if user is typing in an input, textarea, or select
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return
      }

      // Check for help dialog shortcut (?)
      if (e.key === "?" && !e.ctrlKey && !e.altKey && !e.metaKey) {
        e.preventDefault()
        openHelpDialog()
        return
      }

      // Check for registered shortcuts
      shortcuts.forEach((shortcut) => {
        const keyMatch = e.key.toLowerCase() === shortcut.key.toLowerCase()
        const ctrlMatch = !!shortcut.ctrlKey === e.ctrlKey
        const altMatch = !!shortcut.altKey === e.altKey
        const shiftMatch = !!shortcut.shiftKey === e.shiftKey

        if (keyMatch && ctrlMatch && altMatch && shiftMatch) {
          e.preventDefault()
          shortcut.callback()
        }
      })
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [shortcuts])

  // Register default shortcuts
  useEffect(() => {
    registerShortcut({
      id: "help-dialog",
      key: "?",
      description: "Show keyboard shortcuts",
      category: "General",
      callback: openHelpDialog,
    })

    registerShortcut({
      id: "dashboard",
      key: "d",
      description: "Go to dashboard",
      category: "Navigation",
      callback: () => {
        window.location.href = "/dashboard"
      },
    })

    registerShortcut({
      id: "orders",
      key: "o",
      description: "Go to orders",
      category: "Navigation",
      callback: () => {
        window.location.href = "/dashboard/orders"
      },
    })

    registerShortcut({
      id: "menu",
      key: "m",
      description: "Go to menu",
      category: "Navigation",
      callback: () => {
        window.location.href = "/dashboard/menu"
      },
    })

    registerShortcut({
      id: "tables",
      key: "t",
      description: "Go to tables",
      category: "Navigation",
      callback: () => {
        window.location.href = "/dashboard/tables"
      },
    })

    registerShortcut({
      id: "new-order",
      key: "n",
      description: "Create new order",
      category: "Orders",
      callback: () => {
        window.location.href = "/dashboard/orders/new"
      },
    })
  }, [])

  return (
    <KeyboardShortcutsContext.Provider
      value={{
        shortcuts,
        registerShortcut,
        unregisterShortcut,
        isHelpDialogOpen,
        openHelpDialog,
        closeHelpDialog,
      }}
    >
      {children}
    </KeyboardShortcutsContext.Provider>
  )
}

export function useKeyboardShortcutsContext() {
  const context = useContext(KeyboardShortcutsContext)
  if (context === undefined) {
    throw new Error("useKeyboardShortcutsContext must be used within a KeyboardShortcutsProvider")
  }
  return context
}
