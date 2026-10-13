"use client"

import type React from "react"

import { createContext, useContext, useMemo, useCallback } from "react"
import { useAuth } from "./AuthContext"
import { useCommand, useProjection } from "@/kernel/react/kernel-provider"
import type { WaitlistBoardState } from "@/kernel/modules/waitlist.module"
import { waitlistRowsToEntries } from "@/lib/kernel-mappers"
import type { WaitListEntry } from "@/types"
import { useFeedback, notifyWithActions, recoveryActionsFor } from "@/lib/feedback"
import { useAttentionOptional } from "@/context/AttentionContext"

// Define the state type
interface WaitListState {
  entries: WaitListEntry[]
  loading: boolean
  error: string | null
}

// Define the context type
interface WaitListContextType {
  state: WaitListState
  fetchEntries: () => Promise<void>
  addEntry: (entry: Omit<WaitListEntry, "id" | "createdAt" | "updatedAt" | "notified">) => Promise<void>
  removeEntry: (id: string) => Promise<void>
  notifyCustomer: (id: string) => Promise<void>
  seatCustomer: (id: string, tableId: string) => Promise<void>
}

// Create the context
const WaitListContext = createContext<WaitListContextType | undefined>(undefined)

/**
 * Waitlist, backed by the event store.
   *
   * The queue is the `waitlist.board` projection and every mutation is a kernel
   * command. Seating is a single compound command `waitlist.seatAtTable` that
   * atomically seats both the table aggregate and the waitlist entry under one
   * correlation id, eliminating the partial-failure window where a table could
   * be occupied while the guest remains queued.
   *
   * SMS stays behind the `/api/waitlist/[id]/sms` endpoint (Twilio credentials
   * must never reach the browser); the kernel marks the guest notified first so
   * a failed text never blocks the host.
   *
   * @deprecated `waitlist.seat` is retained for backwards compatibility with
   * the older two-step flow used by tests and edge integrations.
   */
export function WaitListProvider({ children }: { children: React.ReactNode }) {
  const { state: board } = useProjection<WaitlistBoardState>("waitlist.board", 2000)
  const { run } = useCommand()
  const { state: authState } = useAuth()
  const { notify } = useFeedback()
  const attention = useAttentionOptional()

  const reject = (title: string, err?: { message?: string; code?: string }) => {
    const actions = recoveryActionsFor(err?.code);
    attention?.push({ title, message: err?.message, code: err?.code, href: "/dashboard/tables" });
    if (actions.length > 0) notifyWithActions(title, err?.message, actions);
    else notify("error", title, err?.message);
  };

  const entries = useMemo(() => waitlistRowsToEntries(board?.queue ?? []), [board])

  const state = useMemo<WaitListState>(
    () => ({
      entries,
      loading: board === null,
      error: null,
    }),
    [entries, board],
  )

  const fail = (result: { error?: { message?: string; code?: string } }, fallback: string): never => {
    reject(fallback, result.error);
    throw new Error(result.error?.message ?? fallback)
  }

  // Fetch wait list entries
  const fetchEntries = useCallback(async () => {
    // Retained for call-site compatibility; the projection refreshes itself.
  }, [])

  // Add entry to wait list
  const addEntry = useCallback(
    async (entry: Omit<WaitListEntry, "id" | "createdAt" | "updatedAt" | "notified">) => {
      if (!entry.customerName?.trim()) throw new Error("Customer name is required")
      if (!Number.isInteger(entry.partySize) || entry.partySize < 1) {
        throw new Error("Party size must be at least 1")
      }
      const result = await run("waitlist.join", {
        customerName: entry.customerName.trim(),
        partySize: entry.partySize,
        ...(entry.phoneNumber ? { phone: entry.phoneNumber } : {}),
        ...(entry.notes ? { notes: entry.notes } : {}),
      })
      if (!result.success) fail(result, "Failed to add entry to wait list")
    },
    [run],
  )

  // Remove entry from wait list
  const removeEntry = useCallback(
    async (id: string) => {
      const result = await run("waitlist.remove", { entryId: id })
      if (!result.success) fail(result, "Failed to remove entry from wait list")
    },
    [run],
  )

  // Notify customer (kernel waitlist.notify holds the notified state; there is
  // no SMS route — texts go out manually until a provider is wired).
  const notifyCustomer = useCallback(
    async (id: string) => {
      const result = await run("waitlist.notify", { entryId: id })
      if (!result.success) fail(result, "Failed to notify customer")
    },
    [run],
  )

  // Seat customer
  const seatCustomer = useCallback(
    async (id: string, tableId: string) => {
      const result = await run("waitlist.seatAtTable", {
        entryId: id,
        tableId,
        serverId: authState.user?.id ?? "host",
        orderId: `waitlist-${id}`,
      })
      if (!result.success) fail(result, "Failed to seat customer")
    },
    [run, authState.user?.id],
  )

  const value = useMemo(
    () => ({
      state,
      fetchEntries,
      addEntry,
      removeEntry,
      notifyCustomer,
      seatCustomer,
    }),
    [state, fetchEntries, addEntry, removeEntry, notifyCustomer, seatCustomer],
  )

  return <WaitListContext.Provider value={value}>{children}</WaitListContext.Provider>
}

// Custom hook
export function useWaitList() {
  const context = useContext(WaitListContext)
  if (context === undefined) {
    throw new Error("useWaitList must be used within a WaitListProvider")
  }
  return context
}
