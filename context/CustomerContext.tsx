"use client"

import type React from "react"

import { createContext, useContext, useMemo, useCallback, useEffect, useRef, useState } from "react"
import { useCommand, useKernel, useProjection } from "@/kernel/react/kernel-provider"
import type { CustomersBoardState, CustomerBoardRow } from "@/kernel/modules/customers.module"
import { customerRowsToCustomers, customerRowToCustomer } from "@/lib/kernel-mappers"
import type { Customer } from "@/types"
import { useFeedback, notifyWithActions, recoveryActionsFor } from "@/lib/feedback"
import { useAttentionOptional } from "@/context/AttentionContext"

// Define the state type
interface CustomerState {
  customers: Customer[]
  loading: boolean
  error: string | null
}

// Define the context type
interface CustomerContextType {
  state: CustomerState
  fetchCustomers: () => Promise<void>
  searchCustomers: (query: string) => Promise<void>
  addCustomer: (customer: Omit<Customer, "id">) => Promise<void>
  updateCustomer: (customer: Customer) => Promise<void>
  deleteCustomer: (id: string) => Promise<void>
  /** Full profile incl. PII (email/phone/notes/preferences) for the edit dialog. */
  getCustomer: (id: string) => Promise<Customer>
}

// Create the context
const CustomerContext = createContext<CustomerContextType | undefined>(undefined)

const csvToList = (v: string): string[] =>
  v.split(",").map((s) => s.trim()).filter(Boolean)

/**
 * Customers, backed by the event store.
 *
 * The list is the `customers.board` projection (loyalty totals, tiers, visit
 * counts — recomputed from the stream, so points can never drift from their
 * ledger). Contact detail lives behind the permission-gated `get.customer`
 * query and is merged over the row only when a screen needs it, which keeps
 * phone numbers and allergies out of the list payload entirely.
 *
 * Two deliberate mappings: enrolment requires an email (the loyalty identity —
 * the form now says so instead of failing silently), and there is no delete:
 * a member record is history, so `deleteCustomer` refuses with a message
 * rather than vanishing the ledger.
 */
interface CustomerDetails {
  email?: string
  phone?: string
  notes?: string
  dietaryRestrictions?: string[]
  allergies?: string[]
  favoriteItems?: string[]
  seatingPreferences?: string[]
}

export function CustomerProvider({ children }: { children: React.ReactNode }) {
  const { state: board } = useProjection<CustomersBoardState>("customers.board", 2000)
  const { run } = useCommand()
  const { ask } = useKernel()
  const { notify } = useFeedback()
  const attention = useAttentionOptional()
  const [search, setSearch] = useState("")
  const [details, setDetails] = useState<Record<string, CustomerDetails>>({})
  const hydratedRef = useRef<Set<string>>(new Set())

  const reject = (title: string, err?: { message?: string; code?: string }) => {
    const actions = recoveryActionsFor(err?.code);
    attention?.push({ title, message: err?.message, code: err?.code, href: "/dashboard/customers" });
    if (actions.length > 0) notifyWithActions(title, err?.message, actions);
    else notify("error", title, err?.message);
  };

  // Hydrate contact detail per listed member (bounded, cached). The board
  // deliberately omits PII so list payloads stay lean; the cards below need
  // it, and `get.customer` carries the same `customer:view` gate the old
  // SQL list had, so this is permission-equivalent to the previous read.
  useEffect(() => {
    const rows = board?.rows ?? []
    const missing = rows.map((r) => r.customerId).filter((id) => !hydratedRef.current.has(id)).slice(0, 100)
    if (missing.length === 0) return
    for (const id of missing) hydratedRef.current.add(id)
    let cancelled = false
    void (async () => {
      const got: Record<string, CustomerDetails> = {}
      for (const id of missing) {
        try {
          const res = await ask<{ state: CustomerDetails }>("get.customer", { customerId: id })
          if (cancelled) return
          if (res.success) got[id] = res.data.state
        } catch {
          /* a missing stream leaves the row with blank contact fields */
        }
      }
      if (!cancelled && Object.keys(got).length > 0) {
        setDetails((prev) => ({ ...prev, ...got }))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [board, ask])

  const customers = useMemo(() => {
    const rows = board?.rows ?? []
    const all = rows.map((r) => customerRowToCustomer(r, details[r.customerId]))
    const q = search.trim().toLowerCase()
    if (!q) return all
    return all.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q),
    )
  }, [board, details, search])

  const state = useMemo<CustomerState>(
    () => ({
      customers,
      loading: board === null,
      error: null,
    }),
    [customers, board],
  )

  // Fetch all customers
  const fetchCustomers = useCallback(async () => {
    // Retained for call-site compatibility; the projection refreshes itself.
  }, [])

  const toDetails = useCallback(
    async (customerId: string): Promise<CustomerDetails> => {
      const res = await ask<{ state: CustomerDetails }>("get.customer", { customerId })
      if (!res.success) throw new Error(res.error.message)
      return res.data.state
    },
    [ask],
  )

  // Search customers
  const searchCustomers = useCallback(async (query: string) => {
    setSearch(query)
  }, [])

  // Add customer
  const addCustomer = useCallback(
    async (customer: Omit<Customer, "id">) => {
      if (!customer.name?.trim()) throw new Error("Customer name is required")
      if (!customer.email?.trim()) {
        throw new Error("Email is required — it is the loyalty identity")
      }
      const id = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `c-${Date.now()}`
      const result = await run("customer.enrol", {
        customerId: id,
        displayName: customer.name.trim(),
        email: customer.email.trim(),
        ...(customer.phone ? { phone: customer.phone } : {}),
        ...(customer.notes ? { notes: customer.notes } : {}),
        ...(customer.dietaryRestrictions ? { dietaryRestrictions: csvToList(customer.dietaryRestrictions) } : {}),
        ...(customer.allergies ? { allergies: csvToList(customer.allergies) } : {}),
        ...(customer.favoriteItems ? { favoriteItems: csvToList(customer.favoriteItems) } : {}),
        ...(customer.seatingPreferences ? { seatingPreferences: csvToList(customer.seatingPreferences) } : {}),
      })
      if (!result.success) reject("Failed to add customer", result.error)
    },
    [run],
  )

  // Update customer
  const updateCustomer = useCallback(
    async (customer: Customer) => {
      if (!customer.name?.trim()) throw new Error("Customer name is required")
      const result = await run("customer.update", {
        customerId: customer.id,
        displayName: customer.name.trim(),
        phone: customer.phone ?? "",
        notes: customer.notes ?? "",
        dietaryRestrictions: csvToList(customer.dietaryRestrictions ?? ""),
        allergies: csvToList(customer.allergies ?? ""),
        favoriteItems: csvToList(customer.favoriteItems ?? ""),
        seatingPreferences: csvToList(customer.seatingPreferences ?? ""),
      })
      if (!result.success) reject("Failed to update customer", result.error)
    },
    [run],
  )

  // Delete customer
  const deleteCustomer = useCallback(async (_id: string) => {
    void _id
    // No hard delete by design: visits, points and redemptions form a ledger
    // the venue must keep for accounting. Deactivation lives on the roadmap;
    // until then this refuses loudly instead of pretending.
    throw new Error("Members cannot be deleted — their visit and points history must be kept. Contact a manager to anonymise the profile.")
  }, [])

  const getCustomer = useCallback(
    async (id: string): Promise<Customer> => {
      const row = board?.rows.find((r) => r.customerId === id)
      const base: CustomerBoardRow = row ?? {
        customerId: id,
        displayName: "",
        tier: "bronze",
        points: 0,
        visitCount: 0,
        lifetimeSpend: 0,
        averageRating: null,
        reviewCount: 0,
        lastVisitAt: null,
        lastOrderId: null,
        allergiesCount: 0,
        updatedAt: null,
      }
      const details = await toDetails(id)
      return customerRowToCustomer(base, details)
    },
    [board, toDetails],
  )

  const value = useMemo(
    () => ({
      state,
      fetchCustomers,
      searchCustomers,
      addCustomer,
      updateCustomer,
      deleteCustomer,
      getCustomer,
    }),
    [state, fetchCustomers, searchCustomers, addCustomer, updateCustomer, deleteCustomer, getCustomer],
  )

  return <CustomerContext.Provider value={value}>{children}</CustomerContext.Provider>
}

// Custom hook
export function useCustomer() {
  const context = useContext(CustomerContext)
  if (context === undefined) {
    throw new Error("useCustomer must be used within a CustomerProvider")
  }
  return context
}
