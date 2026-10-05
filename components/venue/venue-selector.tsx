"use client"

import { useVenue } from "@/context/VenueContext"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Building2, Loader2 } from "lucide-react"

export function VenueSelector({ className }: { className?: string }) {
  const { venues, currentVenue, loading, setCurrentVenue } = useVenue()

  if (loading || venues.length === 0) {
    return (
      <div className={className}>
        <Select disabled>
          <SelectTrigger className="w-[200px]">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            <SelectValue placeholder="Loading venues..." />
          </SelectTrigger>
        </Select>
      </div>
    )
  }

  if (venues.length <= 1) {
    return (
      <div className={className}>
        <Select disabled>
          <SelectTrigger className="w-[200px]">
            <Building2 className="mr-2 h-4 w-4" />
            <SelectValue placeholder={venues[0]?.name || "No venues"} />
          </SelectTrigger>
        </Select>
      </div>
    )
  }

  return (
    <div className={className}>
      <Select
        value={currentVenue?.id || ""}
        onValueChange={(venueId) => {
          const venue = venues.find((v) => v.id === venueId)
          if (venue) setCurrentVenue(venue)
        }}
      >
        <SelectTrigger className="w-[200px]">
          <Building2 className="mr-2 h-4 w-4" />
          <SelectValue placeholder="Select venue" />
        </SelectTrigger>
        <SelectContent>
          {venues.map((venue) => (
            <SelectItem key={venue.id} value={venue.id}>
              {venue.name} {venue.isActive ? "" : "(inactive)"}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}