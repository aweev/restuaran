"use client"

import { useEffect } from "react"
import { toast } from "sonner"

export function SWRegistration() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      const registerSW = async () => {
        try {
          const registration = await navigator.serviceWorker.register("/sw.js", {
            scope: "/",
          })

          registration.addEventListener("updatefound", () => {
            const newWorker = registration.installing
            if (newWorker) {
              newWorker.addEventListener("statechange", () => {
                if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                  toast("A new version is available", {
                    description: "Reload to get the latest POS build.",
                    action: { label: "Reload", onClick: () => window.location.reload() },
                    duration: 15000,
                  })
                }
              })
            }
          })
        } catch {
          // Offline-first is best-effort; a failed SW registration must not break boot.
        }
      }

      if (document.readyState === "complete") {
        void registerSW()
      } else {
        window.addEventListener("load", () => void registerSW(), { once: true })
      }
    }
  }, [])

  return null
}