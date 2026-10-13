import { randomUUID } from "crypto"
import { AttributeBag, Id, kernelError, StoredEvent, TenantContext } from "@/kernel/types"
import { EventStore } from "@/kernel/event-store/event-store"
import { Projection, defineProjection } from "./projection"

export interface CashBoardSession {
  sessionId: Id
  openedAt: string
  openedBy: string | null
  startingFloat: number
  cashSales: number
  payouts: number
  expected: number
  status: "open" | "closed"
  closedAt: string | null
  countedCash: number | null
  variance: number | null
  varianceReason: string | null
}

export interface CashBoardState extends AttributeBag {
  sessions: CashBoardSession[]
  currentId: Id | null
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function toSession(sessionId: string, p: Record<string, unknown>): CashBoardSession {
  const startingFloat = Number(p.startingFloat ?? 0)
  const cashSales = Number(p.cashSales ?? 0)
  const payouts = Number(p.payouts ?? 0)
  return {
    sessionId,
    openedAt: String(p.openedAt ?? ""),
    openedBy: (p.openedBy as string | null) ?? null,
    startingFloat,
    cashSales,
    payouts,
    expected: round2(startingFloat + cashSales - payouts),
    status: "open",
    closedAt: null,
    countedCash: null,
    variance: null,
    varianceReason: null,
  }
}

export function cashBoardProjection(store: EventStore, tenant: TenantContext): Projection<CashBoardState> {
  return defineProjection<CashBoardState>(
    {
      name: "cash.board",
      initial: { sessions: [], currentId: null },
      watchedEventTypes: ["cash.opened", "cash.saleNoted", "cash.payout", "cash.closed"],
      reduce: (state: CashBoardState, event: StoredEvent): CashBoardState => {
        const p = event.payload as Record<string, unknown>
        const sessions = state.sessions.map((s) => ({ ...s }))
        const idx = sessions.findIndex((s) => s.sessionId === event.aggregateId)
        switch (event.eventType) {
          case "cash.opened": {
            if (idx >= 0) return state
            sessions.push(toSession(event.aggregateId, p))
            return { sessions, currentId: event.aggregateId }
          }
          case "cash.saleNoted": {
            if (idx < 0) return state
            sessions[idx] = { ...sessions[idx], cashSales: Number(p.cashSales ?? sessions[idx].cashSales) }
            sessions[idx].expected = round2(sessions[idx].startingFloat + sessions[idx].cashSales - sessions[idx].payouts)
            return { sessions, currentId: state.currentId }
          }
          case "cash.payout": {
            if (idx < 0) return state
            sessions[idx] = { ...sessions[idx], payouts: Number(p.payouts ?? sessions[idx].payouts) }
            sessions[idx].expected = round2(sessions[idx].startingFloat + sessions[idx].cashSales - sessions[idx].payouts)
            return { sessions, currentId: state.currentId }
          }
          case "cash.closed": {
            if (idx < 0) return state
            sessions[idx] = {
              ...sessions[idx],
              status: "closed",
              closedAt: String(p.closedAt ?? event.occurredAt),
              countedCash: Number(p.countedCash ?? 0),
              expected: Number(p.expectedCash ?? sessions[idx].expected),
              variance: Number(p.variance ?? 0),
              varianceReason: (p.varianceReason as string | null) ?? null,
            }
            return {
              sessions,
              currentId: state.currentId === event.aggregateId ? null : state.currentId,
            }
          }
          default:
            return state
        }
      },
    },
    store,
    tenant,
  )
}

/** Deterministic id for the cash.noteSale hook: one payment → one sale note. */
export function cashSaleIdempotencyKey(paymentId: string): string {
  return `cash-sale:${paymentId}`
}

export { randomUUID }
