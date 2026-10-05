import type React from "react"
import { UiProvider } from "@/components/ui-preferences"

/**
 * The kitchen display is its own product surface, not a page inside the POS.
 *
 * A cook works in gloves, at arm's length, glancing for a couple of seconds
 * at a time. That justifies a permanently dark, higher-contrast theme with
 * oversized hit targets — and pinning it here means a cook can never inherit
 * someone's light "front of house" preference mid-service.
 *
 * See globals.css `[data-surface="kds"]` for the token overrides.
 */
export default function KitchenDisplayLayout({ children }: { children: React.ReactNode }) {
  return (
    <UiProvider defaultSurface="kds" lockSurface>
      {children}
    </UiProvider>
  )
}
