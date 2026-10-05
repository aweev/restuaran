import type React from "react"
import { UiProvider } from "@/components/ui-preferences"

/**
 * The guest's phone, reached by QR code.
 *
 * A different product from the POS: thumb-first, one-handed, image-forward,
 * and never showing staff chrome. Larger radii and softer contrast than the
 * front-of-house surface, because photography has to lead here.
 */
export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  return (
    <UiProvider defaultSurface="qr" lockSurface>
      {children}
    </UiProvider>
  )
}
