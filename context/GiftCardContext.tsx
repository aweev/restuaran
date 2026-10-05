"use client"

import { createContext, useContext, useState, useCallback, useEffect, useMemo, type ReactNode } from "react"
import { useCommand, useProjection } from "@/kernel/react/kernel-provider"
import type { GiftCardsBoardState } from "@/kernel/modules/gift-cards.module"
import type { GiftCardRow as KernelGiftCardRow } from "@/kernel/modules/gift-cards.module"
import { useFeedback } from "@/lib/feedback"

export type GiftCardRow = KernelGiftCardRow

interface GiftCardContextType {
  giftCards: GiftCardRow[]
  loading: boolean
  error: string | null
  issueGiftCard: (data: IssueGiftCardData) => Promise<void>
  loadGiftCard: (cardId: string, amount: number) => Promise<void>
  redeemGiftCard: (cardId: string, orderId: string, amount: number) => Promise<void>
  refundGiftCard: (cardId: string, orderId: string, amount: number, reason?: string) => Promise<void>
  voidGiftCard: (cardId: string, reason?: string) => Promise<void>
  getGiftCard: (cardNumber: string) => Promise<GiftCardRow | null>
  refresh: () => Promise<void>
}

interface IssueGiftCardData {
  cardNumber: string
  initialBalance: number
  currency?: string
  purchaserCustomerId?: string
  recipientEmail?: string
}

const GiftCardContext = createContext<GiftCardContextType | undefined>(undefined)

export function GiftCardProvider({ children }: { children: ReactNode }) {
  const { run } = useCommand()
  const { state: board } = useProjection<GiftCardsBoardState>("giftcards.board", 10000)
  const { notify } = useFeedback()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const giftCards = board?.rows ?? []

  const refresh = useCallback(async () => {
    // Projection auto-refreshes
  }, [])

  const issueGiftCard = useCallback(async (data: IssueGiftCardData) => {
    setLoading(true)
    setError(null)
    try {
      const id = typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `gc-${Date.now()}`
      const result = await run("giftcard.issue", {
        id,
        cardNumber: data.cardNumber,
        initialBalance: data.initialBalance,
        currency: data.currency ?? "USD",
        purchaserCustomerId: data.purchaserCustomerId,
        recipientEmail: data.recipientEmail,
      })
      if (!result.success) throw new Error(result.error?.message ?? "Failed to issue gift card")
      notify("success", "Gift card issued", `Card ${data.cardNumber} created with $${data.initialBalance.toFixed(2)}`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to issue gift card"
      setError(msg)
      notify("error", "Issue failed", msg)
      throw err
    } finally {
      setLoading(false)
    }
  }, [run, notify])

  const loadGiftCard = useCallback(async (cardId: string, amount: number) => {
    setLoading(true)
    setError(null)
    try {
      const result = await run("giftcard.load", { id: cardId, amount })
      if (!result.success) throw new Error(result.error?.message ?? "Failed to load gift card")
      notify("success", "Gift card loaded", `$${amount.toFixed(2)} added`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load gift card"
      setError(msg)
      notify("error", "Load failed", msg)
      throw err
    } finally {
      setLoading(false)
    }
  }, [run, notify])

  const redeemGiftCard = useCallback(async (cardId: string, orderId: string, amount: number) => {
    setLoading(true)
    setError(null)
    try {
      const result = await run("giftcard.redeem", { id: cardId, orderId, amount })
      if (!result.success) throw new Error(result.error?.message ?? "Failed to redeem gift card")
      notify("success", "Gift card redeemed", `$${amount.toFixed(2)} applied to order`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to redeem gift card"
      setError(msg)
      notify("error", "Redeem failed", msg)
      throw err
    } finally {
      setLoading(false)
    }
  }, [run, notify])

  const refundGiftCard = useCallback(async (cardId: string, orderId: string, amount: number, reason?: string) => {
    setLoading(true)
    setError(null)
    try {
      const result = await run("giftcard.refund", { id: cardId, orderId, amount, reason })
      if (!result.success) throw new Error(result.error?.message ?? "Failed to refund gift card")
      notify("success", "Gift card refunded", `$${amount.toFixed(2)} returned to card`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to refund gift card"
      setError(msg)
      notify("error", "Refund failed", msg)
      throw err
    } finally {
      setLoading(false)
    }
  }, [run, notify])

  const voidGiftCard = useCallback(async (cardId: string, reason?: string) => {
    setLoading(true)
    setError(null)
    try {
      const result = await run("giftcard.void", { id: cardId, reason })
      if (!result.success) throw new Error(result.error?.message ?? "Failed to void gift card")
      notify("success", "Gift card voided")
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to void gift card"
      setError(msg)
      notify("error", "Void failed", msg)
      throw err
    } finally {
      setLoading(false)
    }
  }, [run, notify])

  const getGiftCard = useCallback(async (cardNumber: string): Promise<GiftCardRow | null> => {
    try {
      // Query by card number through the projection
      const card = giftCards.find((c) => c.cardNumber.toUpperCase() === cardNumber.toUpperCase())
      return card || null
    } catch {
      return null
    }
  }, [giftCards])

  const value = useMemo(
    () => ({
      giftCards,
      loading,
      error,
      issueGiftCard,
      loadGiftCard,
      redeemGiftCard,
      refundGiftCard,
      voidGiftCard,
      getGiftCard,
      refresh,
    }),
    [giftCards, loading, error, issueGiftCard, loadGiftCard, redeemGiftCard, refundGiftCard, voidGiftCard, getGiftCard, refresh],
  )

  return <GiftCardContext.Provider value={value}>{children}</GiftCardContext.Provider>
}

export function useGiftCard() {
  const context = useContext(GiftCardContext)
  if (!context) {
    throw new Error("useGiftCard must be used within a GiftCardProvider")
  }
  return context
}