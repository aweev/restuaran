"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import type { AttributeBag, CommandResult, QueryResult } from "@/kernel/types"
import { conflictVersions } from "@/components/pos/conflict-dialog"

interface ProjectionEnvelope<T> {
  name: string
  position: number
  state: T
}

/** Transport health, surfaced so a POS never silently shows stale data. */
export type KernelConnection = "live" | "connecting" | "offline"

interface QueuedCommand {
  requestId: string
  commandType: string
  payload: AttributeBag
  enqueuedAt: string
  attempts: number
}

export type { QueuedCommand }

interface KernelClient {
  execute: (commandType: string, payload: AttributeBag, requestId?: string) => Promise<CommandResult>
  ask: <T = unknown>(queryType: string, params: AttributeBag) => Promise<QueryResult<T>>
  readProjection: <T>(name: string) => Promise<ProjectionEnvelope<T>>
  subscribeProjection: <T>(name: string, intervalMs: number, cb: (envelope: ProjectionEnvelope<T>) => void) => () => void
  connection: KernelConnection
  /** Commands accepted locally while offline and not yet acknowledged. */
  pendingCount: number
  /** Full offline queue for inspection panels. */
  queue: QueuedCommand[]
  /** Drop a queued command without replaying it. */
  discardQueued: (requestId: string) => void
  /** Re-attempt a single queued command immediately. */
  retryQueued: (requestId: string) => Promise<CommandResult | null>
}

const KernelContext = createContext<KernelClient | null>(null)

const QUEUE_KEY = "pos.kernel.offlineQueue"
const QUEUE_FLUSH_INTERVAL_MS = 5000
const QUEUE_MAX_ITEMS = 200
const QUEUE_MAX_ATTEMPTS = 25
const QUEUE_TTL_MS = 7 * 24 * 60 * 60 * 1000
const IDB_DB = "pos-kernel"
const IDB_STORE = "offlineQueue"

function idb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      if (typeof window === "undefined" || !("indexedDB" in window)) return resolve(null)
      const req = window.indexedDB.open(IDB_DB, 1)
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(IDB_STORE)) req.result.createObjectStore(IDB_STORE)
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
}

async function idbGet(): Promise<QueuedCommand[] | null> {
  const db = await idb()
  if (!db) return null
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, "readonly")
      const req = tx.objectStore(IDB_STORE).get(QUEUE_KEY)
      req.onsuccess = () => resolve(Array.isArray(req.result) ? (req.result as QueuedCommand[]) : [])
      req.onerror = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
}

async function idbSet(queue: QueuedCommand[]): Promise<boolean> {
  const db = await idb()
  if (!db) return false
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, "readwrite")
      const store = tx.objectStore(IDB_STORE)
      if (queue.length === 0) store.delete(QUEUE_KEY)
      else store.put(queue, QUEUE_KEY)
      tx.oncomplete = () => resolve(true)
      tx.onerror = () => resolve(false)
    } catch {
      resolve(false)
    }
  })
}

export function newRequestId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `req-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

/**
 * Persist a replay rejection where the Needs-Attention drawer reads it.
 * The kernel transport cannot import the Attention React context (wrong
 * layer), so it writes the same `pos.attention` shape directly and emits
 * `pos:attention` for live providers to re-hydrate.
 */
export function recordReplayRejection(cmd: QueuedCommand, err?: { code?: string; message?: string }): void {
  try {
    if (typeof window === "undefined") return
    const key = "pos.attention"
    const raw = window.localStorage.getItem(key)
    const items = raw ? (JSON.parse(raw) as Array<Record<string, unknown>>) : []
    const entry = {
      id:
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `att-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      at: new Date().toISOString(),
      title: `Offline change rejected: ${cmd.commandType}`,
      message: err?.message ?? "The server rejected this queued change on reconnect.",
      code: err?.code,
      href: "/dashboard/orders",
    }
    const next = [...(Array.isArray(items) ? items : []), entry].slice(-50)
    window.localStorage.setItem(key, JSON.stringify(next))
    window.dispatchEvent(new Event("pos:attention"))
  } catch {
    /* storage unavailable: rejection stays visible in the queue panel */
  }
}

/**
 * Reads the durable offline queue. Deliberately defensive: a malformed entry
 * (older build, hand-edited storage) is dropped rather than crashing boot, and
 * a storage read failure degrades to "no queue" instead of a white screen.
 */
function sanitizeQueue(input: unknown): QueuedCommand[] {
  if (!Array.isArray(input)) return []
  const now = Date.now()
  return (input as QueuedCommand[]).filter(
    (c): c is QueuedCommand =>
      !!c &&
      typeof c === "object" &&
      typeof (c as QueuedCommand).requestId === "string" &&
      typeof (c as QueuedCommand).commandType === "string" &&
      (c as QueuedCommand).attempts < QUEUE_MAX_ATTEMPTS &&
      now - Date.parse((c as QueuedCommand).enqueuedAt || "") < QUEUE_TTL_MS,
  ).slice(-QUEUE_MAX_ITEMS)
}

async function loadQueue(): Promise<QueuedCommand[]> {
  // Try IndexedDB first (primary)
  const fromIdb = await idbGet().catch(() => null)
  if (fromIdb && fromIdb.length > 0) {
    return sanitizeQueue(fromIdb)
  }
  // Fallback to localStorage
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(QUEUE_KEY)
    if (!raw) return []
    return sanitizeQueue(JSON.parse(raw))
  } catch {
    return []
  }
}

function saveQueue(queue: QueuedCommand[]): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve()
  const capped = sanitizeQueue(queue)
  // Write to IndexedDB (primary)
  const idbPromise = idbSet(capped).catch(() => undefined)
  // Mirror to localStorage as fallback
  const lsPromise = new Promise<void>((resolve) => {
    try {
      if (capped.length === 0) window.localStorage.removeItem(QUEUE_KEY)
      else window.localStorage.setItem(QUEUE_KEY, JSON.stringify(capped))
      resolve()
    } catch {
      /* private mode / quota exceeded: IndexedDB is the primary store */
      resolve()
    }
  })
  return Promise.all([idbPromise, lsPromise]).then(() => undefined)
}

async function hydrateQueue(): Promise<QueuedCommand[]> {
  // Try IndexedDB first (primary)
  const fromIdb = await idbGet().catch(() => null)
  if (fromIdb && fromIdb.length > 0) {
    return sanitizeQueue(fromIdb)
  }
  // Fallback to localStorage
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(QUEUE_KEY)
    if (!raw) return []
    return sanitizeQueue(JSON.parse(raw))
  } catch {
    return []
  }
}

function isNetworkFailure(err: unknown): boolean {
  // A rejected fetch means the request never reached the server, so the write
  // is safe to retry later. A 4xx/5xx came back from the server and must not
  // be replayed: it would either fail identically or duplicate a partial write.
  return err instanceof TypeError
}

async function postCommand(body: {
  commandType: string
  payload: AttributeBag
  requestId?: string
}): Promise<CommandResult> {
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
  const [connection, setConnection] = useState<KernelConnection>("connecting")
  const [queue, setQueue] = useState<QueuedCommand[]>([])
  const flushing = useRef(false)

  // Hydrate the queue once on the client; the server render must match the
  // empty state or React will report a hydration mismatch.
  useEffect(() => {
    void hydrateQueue().then((q) => setQueue(q))
    setConnection(typeof navigator !== "undefined" && navigator.onLine ? "connecting" : "offline")
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    const goOnline = () => setConnection((c) => (c === "offline" ? "connecting" : c))
    const goOffline = () => setConnection("offline")
    window.addEventListener("online", goOnline)
    window.addEventListener("offline", goOffline)
    return () => {
      window.removeEventListener("online", goOnline)
      window.removeEventListener("offline", goOffline)
    }
  }, [])

  const execute = useCallback(
    async (
      commandType: string,
      payload: AttributeBag,
      requestId?: string,
    ): Promise<CommandResult> => {
      const id = requestId ?? newRequestId()
      try {
        const result = await postCommand({ commandType, payload, requestId: id })
        setConnection("live")
        return result
      } catch (err) {
        if (!isNetworkFailure(err)) throw err
        // Offline: durably queue under a stable requestId so a later flush
        // replays exactly this intent rather than inventing a second one.
        setConnection("offline")
        setQueue((prev) => {
          if (prev.some((c) => c.requestId === id)) return prev
          const next = [
            ...prev,
            { requestId: id, commandType, payload, enqueuedAt: new Date().toISOString(), attempts: 0 },
          ]
          saveQueue(next)
          return next
        })
        return {
          success: true,
          commandId: id,
          queued: true,
          events: [],
          error: {
            code: "OFFLINE_QUEUED",
            message: "No connection — change queued and will sync automatically.",
          },
        } as CommandResult
      }
    },
    [],
  )

  const ask = useCallback(async <T,>(queryType: string, params: AttributeBag): Promise<QueryResult<T>> => {
    const res = await fetch(`/api/kernel?${qs(params, { query: queryType })}`, { credentials: "include" })
    return (await res.json()) as QueryResult<T>
  }, [])

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
          if (!active) return
          // Only a successful read proves the connection is live.
          setConnection("live")
          if (envelope.position !== lastPosition) {
            lastPosition = envelope.position
            cb(envelope)
          }
        } catch (err) {
          if (active && isNetworkFailure(err)) setConnection("offline")
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
    [readProjection],
  )

  // Drain the offline queue in order. Ordering matters: commands routinely depend
  // on the state their predecessor produced.
  useEffect(() => {
    if (typeof window === "undefined") return
    const flush = async () => {
      if (flushing.current || queue.length === 0) return
      if (typeof navigator !== "undefined" && !navigator.onLine) return
      flushing.current = true
      try {
        for (const cmd of queue) {
          try {
            const res = await postCommand(cmd)
            // A rejection from the server (bad state, forbidden) must not block
            // every later command, so it is dropped rather than retried forever —
            // but it is recorded in Needs Attention so staff see what didn't land.
            if (!res.success) {
              recordReplayRejection(cmd, res.error)
            }
            setQueue((prev) => {
              const next = prev.filter((c) => c.requestId !== cmd.requestId)
              saveQueue(next)
              return next
            })
            if (res.success) setConnection("live")
          } catch (err) {
            if (isNetworkFailure(err)) {
              setConnection("offline")
              setQueue((prev) => {
                const next = prev.map((c) =>
                  c.requestId === cmd.requestId ? { ...c, attempts: c.attempts + 1 } : c,
                )
                saveQueue(next)
                return next
              })
              return // still offline; stop and retry on the next tick
            }
            setConnection("offline")
            return
          }
        }
      } finally {
        flushing.current = false
      }
    }
    void flush()
    const id = setInterval(flush, QUEUE_FLUSH_INTERVAL_MS)
    return () => clearInterval(id)
  }, [queue])

  const value = useMemo<KernelClient>(
    () => ({
      execute,
      ask,
      readProjection,
      subscribeProjection,
      connection,
      pendingCount: queue.length,
      queue,
      discardQueued: (requestId: string) => {
        setQueue((prev) => {
          const next = prev.filter((c) => c.requestId !== requestId)
          saveQueue(next)
          return next
        })
      },
      retryQueued: async (requestId: string) => {
        const cmd = queue.find((c) => c.requestId === requestId)
        if (!cmd) return null
        try {
          const res = await postCommand(cmd)
          // Server answered (even a rejection is final): drop it, but record
          // rejections so a manual retry that fails stays visible.
          if (!res.success) recordReplayRejection(cmd, res.error)
          setQueue((prev) => {
            const next = prev.filter((c) => c.requestId !== requestId)
            saveQueue(next)
            return next
          })
          if (res.success) setConnection("live")
          return res
        } catch (err) {
          if (isNetworkFailure(err)) setConnection("offline")
          return null
        }
      },
    }),
    [execute, ask, readProjection, subscribeProjection, connection, queue],
  )

  return <KernelContext.Provider value={value}>{children}</KernelContext.Provider>
}

export function useKernel(): KernelClient {
  const ctx = useContext(KernelContext)
  if (!ctx) throw new Error("useKernel must be used within <KernelProvider>")
  return ctx
}


/**
 * Dispatch a command.
 *
 * `onOptimistic` runs immediately so the UI can respond without waiting for the
 * round trip; if the command is rejected, `onRollback` restores the prior state.
 * That pairing is what stops a cashier seeing a ghost item on a failed add.
 */
export function useCommand() {
  const { execute, pendingCount } = useKernel()
  const [pending, setPending] = useState(false)

    const run = useCallback(
    async (
      commandType: string,
      payload: AttributeBag,
      opts?: {
        onOptimistic?: () => void
        onRollback?: () => void
        onSuccess?: (r: CommandResult) => void
        onQueued?: (r: CommandResult) => void
        onConflict?: (error: { code: string; message: string; currentVersion: number; expectedVersion?: number; details?: Record<string, unknown> }) => Promise<"retry" | "abort">
      },
    ): Promise<CommandResult> => {
      opts?.onOptimistic?.()
      setPending(true)
      try {
        const result = await execute(commandType, payload)
        if (result.success) {
          if ("queued" in result && result.queued) {
            opts?.onQueued?.(result)
          } else {
            opts?.onSuccess?.(result)
          }
        } else if (result.error?.code === "VERSION_CONFLICT") {
          // Structured details first (server sends details.currentVersion);
          // message regex is a legacy fallback for older servers.
          const { expectedVersion, currentVersion } = conflictVersions(result.error)
          if (result.error && result.error.details?.currentVersion == null) {
            result.error = { ...result.error, details: { ...result.error.details, expectedVersion, currentVersion } };
          }

          const shouldRetry = await opts?.onConflict?.({
            code: "VERSION_CONFLICT",
            message: result.error.message,
            currentVersion,
            expectedVersion,
            details: result.error.details as Record<string, unknown> | undefined,
          })
          
          if (shouldRetry === "retry") {
            // Retry the command once
            const retryResult = await execute(commandType, payload)
            if (retryResult.success) opts?.onSuccess?.(retryResult)
            else opts?.onRollback?.()
            return retryResult
          }
          opts?.onRollback?.()
        } else {
          opts?.onRollback?.()
        }
        return result
      } catch (err) {
        opts?.onRollback?.()
        throw err
      } finally {
        setPending(false)
      }
    },
    [execute],
  )

  return { run, pending, pendingCount }
}

export function useProjection<T>(
  name: string,
  intervalMs = 1000,
): { state: T | null; position: number; error: string | null; connection: KernelConnection } {
  const { subscribeProjection, connection } = useKernel()
  const [envelope, setEnvelope] = useState<ProjectionEnvelope<T> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const subRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    // Reset on projection change so a screen switching boards never shows the
    // previous board's rows under the new board's heading.
    setEnvelope(null)
    setError(null)
    subRef.current = subscribeProjection<T>(name, intervalMs, (env) => {
      setEnvelope(env)
      setError(null)
    })
    return () => subRef.current?.()
  }, [subscribeProjection, name, intervalMs])

  return { state: envelope?.state ?? null, position: envelope?.position ?? -1, error, connection }
}
