"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react"

export type Surface = "foh" | "kds" | "qr"
export type Density = "compact" | "comfortable" | "spacious"

interface UiPrefs {
  surface: Surface
  density: Density
  setSurface: (s: Surface) => void
  setDensity: (d: Density) => void
}

const UiContext = createContext<UiPrefs | undefined>(undefined)

const SURFACE_KEY = "pos.surface"
const DENSITY_KEY = "pos.density"

/**
 * Owns the `data-surface` and `data-density` attributes that globals.css keys
 * off, so the three visual modes are a single switch rather than three
 * hand-maintained themes.
 *
 * The KDS pins itself: a cook must never land on a light screen mid-service,
 * so a cook's saved preference wins but defaults to the dark kitchen surface.
 */
export function UiProvider({
  children,
  defaultSurface = "foh",
  lockSurface = false,
}: {
  children: ReactNode
  defaultSurface?: Surface
  /** When true the surface cannot be changed by the user (e.g. a KDS terminal). */
  lockSurface?: boolean
}) {
  const [surface, setSurfaceState] = useState<Surface>(defaultSurface)
  const [density, setDensityState] = useState<Density>("comfortable")

  useEffect(() => {
    if (lockSurface) return
    const stored = window.localStorage.getItem(SURFACE_KEY) as Surface | null
    if (stored === "foh" || stored === "kds" || stored === "qr") {
      setSurfaceState(stored)
    }
  }, [lockSurface])

  useEffect(() => {
    const stored = window.localStorage.getItem(DENSITY_KEY) as Density | null
    if (stored === "compact" || stored === "comfortable" || stored === "spacious") {
      setDensityState(stored)
    }
  }, [])

  useEffect(() => {
    const root = document.documentElement
    root.setAttribute("data-surface", surface)
    if (lockSurface) return
    window.localStorage.setItem(SURFACE_KEY, surface)
  }, [surface, lockSurface])

  useEffect(() => {
    document.documentElement.setAttribute("data-density", density)
    window.localStorage.setItem(DENSITY_KEY, density)
  }, [density])

  const setSurface = useCallback((s: Surface) => {
    if (lockSurface) return
    setSurfaceState(s)
  }, [lockSurface])

  const value = useMemo<UiPrefs>(
    () => ({ surface, density, setSurface, setDensity: setDensityState }),
    [surface, density, setSurface],
  )

  return <UiContext.Provider value={value}>{children}</UiContext.Provider>
}

export function useUiPrefs(): UiPrefs {
  const ctx = useContext(UiContext)
  if (!ctx) throw new Error("useUiPrefs must be used within <UiProvider>")
  return ctx
}
