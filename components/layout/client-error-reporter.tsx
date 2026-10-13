"use client"

import { useEffect } from "react"

const BUILD = process.env.NEXT_PUBLIC_APP_VERSION || "dev"
const MAX_PER_MIN = 5
let sent = 0
let windowStart = Date.now()

function hasSession(): boolean {
  try {
    return document.cookie.includes("posAccessToken")
  } catch {
    return false
  }
}

/**
 * Crash telemetry: uncaught errors + unhandled rejections → POST /api/errors.
 * Signed-in devices only, 5/min cap, fire-and-forget. A reporting failure
 * must never cause a second error loop.
 */
export function ClientErrorReporter() {
  useEffect(() => {
    const report = (message: string, stack?: string) => {
      try {
        const now = Date.now()
        if (now - windowStart > 60_000) {
          windowStart = now
          sent = 0
        }
        if (sent >= MAX_PER_MIN || !hasSession()) return
        sent += 1
        fetch("/api/errors", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ message: message.slice(0, 2000), stack: stack?.slice(0, 8000), url: window.location.href.slice(0, 500), build: BUILD }),
        }).catch(() => null)
      } catch {
        /* never throw from telemetry */
      }
    }

    const onError = (e: ErrorEvent) => report(e.message || "window.onerror", e.error?.stack)
    const onRejection = (e: PromiseRejectionEvent) =>
      report(e.reason instanceof Error ? e.reason.message : String(e.reason ?? "unhandled rejection"), e.reason instanceof Error ? e.reason.stack : undefined)

    window.addEventListener("error", onError)
    window.addEventListener("unhandledrejection", onRejection)
    return () => {
      window.removeEventListener("error", onError)
      window.removeEventListener("unhandledrejection", onRejection)
    }
  }, [])

  return null
}
