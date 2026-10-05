"use client"

import { createContext, useContext, useState, useEffect, useMemo, useCallback, type ReactNode } from "react"
import { useProjection } from "@/kernel/react/kernel-provider"
import type { VenuesBoardState } from "@/kernel/modules/venues.module"

export interface Venue {
  id: string
  name: string
  orgId: string
  timezone: string
  currency: string
  address?: string
  phone?: string
  isActive: boolean
}

interface VenueContextType {
  venues: Venue[]
  currentVenue: Venue | null
  loading: boolean
  error: string | null
  setCurrentVenue: (venue: Venue) => void
  refreshVenues: () => Promise<void>
}

const VenueContext = createContext<VenueContextType | undefined>(undefined)

export function VenueProvider({ children }: { children: ReactNode }) {
  // Venues come from the `venues.board` projection — a shared kernel read model,
  // not a per-client mock. Only the *selection* stays client-side (localStorage).
  const { state: board, error: boardError } = useProjection<VenuesBoardState>("venues.board", 30000)
  const [currentVenue, setCurrentVenueState] = useState<Venue | null>(null)

  const venues = useMemo<Venue[]>(
    () =>
      (board?.venues ?? []).map((v) => ({
        id: v.id,
        name: v.name,
        orgId: v.orgId,
        timezone: v.timezone,
        currency: v.currency,
        address: v.address ?? undefined,
        phone: v.phone ?? undefined,
        isActive: v.isActive,
      })),
    [board],
  )

  const loading = board === null
  const error = boardError ?? null

  // Keep the current venue in sync with the board and the stored selection.
  useEffect(() => {
    if (venues.length === 0) return
    const storedVenueId = localStorage.getItem("pos.currentVenueId")
    const stored = storedVenueId ? venues.find((v) => v.id === storedVenueId) : undefined
    setCurrentVenueState(stored ?? venues[0])
  }, [venues])

  const refreshVenues = useCallback(async () => {
    // Retained for call-site compatibility; the projection refreshes itself.
  }, [])

  const setCurrentVenue = useCallback((venue: Venue) => {
    setCurrentVenueState(venue)
    localStorage.setItem("pos.currentVenueId", venue.id)
    // Reload page to apply new venue context (or use a more sophisticated approach)
    window.location.reload()
  }, [])

  return (
    <VenueContext.Provider value={{ venues, currentVenue, loading, error, setCurrentVenue, refreshVenues }}>
      {children}
    </VenueContext.Provider>
  )
}

export function useVenue() {
  const context = useContext(VenueContext)
  if (!context) {
    throw new Error("useVenue must be used within a VenueProvider")
  }
  return context
}