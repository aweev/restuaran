"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"
import type { AttributeBag, CommandResult, QueryResult } from "@/kernel/types"

interface ProjectionEnvelope<T> {
  name: string
  position: number
  state: T
}

interface KernelClient {
  execute: (commandType: string, payload: AttributeBag, requestId?: string) => Promise<CommandResult>
  ask: <T = unknown>(queryType: string, params: AttributeBag) => Promise<QueryResult<T>>
  readProjection: <T>(name: string) => Promise<ProjectionEnvelope<T>>
  subscribeProjection: <T>(name: string, intervalMs: number, cb: (envelope: ProjectionEnvelope<T>) => void) => () => void
}

const KernelContext = createContext<KernelClient | null>(null)

async function postCommand(body: { commandType: string; payload: AttributeBag; requestId?: string }): Promise<CommandResult> {
  const res = await fetch("/api/kernel", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    credentials: "include",
  })
  return (await res.json()) as CommandResult
}

function qs(params: AttributeBag, extra: Record<string, string>): string {
  const sp = new URLSearchParams(extra)
  for (const [k, v] of Object.entries(params)) sp.set(k, String(v))
  return sp.toString()
}

export function KernelProvider({ children }: { children: React.ReactNode }) {
  const execute = useCallback(
    (commandType: string, payload: AttributeBag, requestId?: string) => postCommand({ commandType, payload, requestId }),
    []
  )

  const ask = useCallback(
    async <T,>(queryType: string, params: AttributeBag): Promise<QueryResult<T>> => {
      const res = await fetch(`/api/kernel?${qs(params, { query: queryType })}`, { credentials: "include" })
      return (await res.json()) as QueryResult<T>
    },
    []
  )

  const readProjection = useCallback(async <T,>(name: string): Promise<ProjectionEnvelope<T>> => {
    const res = await fetch(`/api/kernel?projection=${encodeURIComponent(name)}`, { credentials: "include" })
    if (!res.ok) throw new Error(`Unknown projection: ${name}`)
    return (await res.json()) as ProjectionEnvelope<T>
  }, [])

  const subscribeProjection = useCallback(
    <T,>(name: string, intervalMs: number, cb: (envelope: ProjectionEnvelope<T>) => void) => {
      let active = true
      let lastPosition = -1
      const tick = async () => {
        try {
          const envelope = await readProjection<T>(name)
          if (active && envelope.position !== lastPosition) {
            lastPosition = envelope.position
            cb(envelope)
          }
        } catch {
          // transient server error; next tick retries
        }
      }
      void tick()
      const id = setInterval(tick, intervalMs)
      return () => {
        active = false
        clearInterval(id)
      }
    },
    [readProjection]
  )

  const value = useMemo<KernelClient>(
    () => ({ execute, ask, readProjection, subscribeProjection }),
    [execute, ask, readProjection, subscribeProjection]
  )

  return <KernelContext.Provider value={value}>{children}</KernelContext.Provider>
}

export function useKernel(): KernelClient {
  const ctx = useContext(KernelContext)
  if (!ctx) throw new Error("useKernel must be used within <KernelProvider>")
  return ctx
}

export function useCommand() {
  const { execute } = useKernel()
  const [pending, setPending] = useState(false)
  const run = useCallback(
    async (commandType: string, payload: AttributeBag): Promise<CommandResult> => {
      setPending(true)
      try {
        return await execute(commandType, payload)
      } finally {
        setPending(false)
      }
    },
    [execute]
  )
  return { run, pending }
}

export function useProjection<T>(name: string, intervalMs = 1000): { state: T | null; position: number; error: string | null } {
  const { subscribeProjection } = useKernel()
  const [envelope, setEnvelope] = useState<ProjectionEnvelope<T> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const subRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    subRef.current = subscribeProjection<T>(name, intervalMs, (env) => {
      setEnvelope(env)
      setError(null)
    })
    return () => subRef.current?.()
  }, [subscribeProjection, name, intervalMs])

  return { state: envelope?.state ?? null, position: envelope?.position ?? -1, error }
}
