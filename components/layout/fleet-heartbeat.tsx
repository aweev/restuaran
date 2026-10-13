"use client"

import { useEffect } from "react"
import { useAuth } from "@/context/AuthContext"

const KEY = "pos.device.id"
const VERSION = process.env.NEXT_PUBLIC_APP_VERSION || "dev"
const BEAT_MS = 5 * 60 * 1000

function deviceId(): string {
  try {
    let id = window.localStorage.getItem(KEY)
    if (!id) {
      id = crypto.randomUUID()
      window.localStorage.setItem(KEY, id)
    }
    return id
  } catch {
    return "unknown"
  }
}

/**
 * Fleet heartbeat: while signed in, report build + role every 5 minutes so
 * Settings → Devices shows which tablets are stale. Fire-and-forget — a
 * failed beat must never interrupt service.
 */
export function FleetHeartbeat() {
  const { state } = useAuth()

  useEffect(() => {
    if (!state.isAuthenticated) return
    let alive = true
    const beat = () => {
      if (!alive) return
      fetch("/api/fleet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          deviceId: deviceId(),
          label: typeof navigator !== "undefined" ? `${navigator.platform}`.slice(0, 64) : undefined,
          appVersion: VERSION,
          role: state.user?.role,
        }),
      }).catch(() => null)
    }
    beat()
    const t = setInterval(beat, BEAT_MS)
    return () => {
      alive = false
      clearInterval(t)
    }
  }, [state.isAuthenticated, state.user?.role])

  return null
}
