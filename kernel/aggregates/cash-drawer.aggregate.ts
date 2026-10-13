import { ActorContext, AttributeBag, Id, kernelError, TenantContext } from "@/kernel/types"
import { Aggregate, AggregateEvent } from "./aggregate"

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * Cash-drawer session. Money truth lives here, not in localStorage.
 *
 * - `startingFloat` + observed cash sales − payouts = expected. The expected
 *   figure is computed server-side on close from this stream; the client only
 *   supplies the counted cash + a variance reason.
 * - Cash sales are recorded via `noteSale` (one per kernel paymentId,
 *   idempotent) by the cash module's hook on `order.paymentRecorded`, so a
 *   drawer can never disagree with the order ledger about cash taken.
 * - Closed sessions are immutable: any mutation after close is rejected.
 */
export interface CashDrawerState extends AttributeBag {
  openedAt: string | null
  openedBy: string | null
  startingFloat: number
  cashSales: number
  payouts: number
  saleIds: string[]
  closedAt: string | null
  countedCash: number | null
  expectedCash: number | null
  variance: number | null
  varianceReason: string | null
}

export class CashDrawerAggregate extends Aggregate<CashDrawerState> {
  static readonly TYPE = "CashDrawer"

  constructor(tenant: TenantContext) {
    super(CashDrawerAggregate.TYPE, tenant, {
      openedAt: null,
      openedBy: null,
      startingFloat: 0,
      cashSales: 0,
      payouts: 0,
      saleIds: [],
      closedAt: null,
      countedCash: null,
      expectedCash: null,
      variance: null,
      varianceReason: null,
    })
  }

  static open(tenant: TenantContext, opts: {
    id: Id
    startingFloat: number
    openedBy: string | null
    actor: ActorContext
  }): CashDrawerAggregate {
    const agg = new CashDrawerAggregate(tenant)
    agg.initialize(opts.id)
    const float = round2(opts.startingFloat)
    if (!Number.isFinite(float) || float < 0) throw kernelError("INVALID_FLOAT", "Starting float must be >= 0")
    agg.raise("cash.opened", {
      startingFloat: float,
      openedBy: opts.openedBy ?? null,
      openedAt: new Date().toISOString(),
    }, opts.actor)
    return agg
  }

  private assertOpen(): void {
    if (!this.state.openedAt) throw kernelError("DRAWER_NOT_OPEN", "Drawer session was never opened")
    if (this.state.closedAt) throw kernelError("DRAWER_CLOSED", "Drawer session is closed and immutable")
  }

  /** Idempotent: the same paymentId twice records once. */
  noteSale(actor: ActorContext, paymentId: string, amount: number): boolean {
    this.assertOpen()
    if (this.state.saleIds.includes(paymentId)) return false
    const value = round2(amount)
    if (!Number.isFinite(value) || value <= 0) throw kernelError("INVALID_SALE", "Sale amount must be positive")
    this.raise("cash.saleNoted", {
      paymentId,
      delta: value,
      cashSales: round2(this.state.cashSales + value),
    }, actor)
    return true
  }

  payout(actor: ActorContext, amount: number, reason: string): void {
    this.assertOpen()
    const value = round2(amount)
    if (!Number.isFinite(value) || value <= 0) throw kernelError("INVALID_PAYOUT", "Payout amount must be positive")
    if (!reason?.trim()) throw kernelError("PAYOUT_REASON_REQUIRED", "Payouts require a reason")
    this.raise("cash.payout", {
      delta: value,
      reason: reason.trim(),
      payouts: round2(this.state.payouts + value),
    }, actor)
  }

  expected(): number {
    return round2(this.state.startingFloat + this.state.cashSales - this.state.payouts)
  }

  close(actor: ActorContext, countedCash: number, varianceReason?: string): { expected: number; variance: number } {
    this.assertOpen()
    const counted = round2(countedCash)
    if (!Number.isFinite(counted) || counted < 0) throw kernelError("INVALID_COUNT", "Counted cash must be >= 0")
    const expected = this.expected()
    const variance = round2(counted - expected)
    if (variance !== 0 && !varianceReason?.trim()) {
      throw kernelError("VARIANCE_REASON_REQUIRED", `Variance is ${variance}: a reason is required`)
    }
    this.raise("cash.closed", {
      countedCash: counted,
      expectedCash: expected,
      variance,
      varianceReason: variance !== 0 ? varianceReason!.trim() : null,
      closedAt: new Date().toISOString(),
    }, actor)
    return { expected, variance }
  }

  protected applyEvent(event: AggregateEvent): CashDrawerState {
    const s = this.state
    switch (event.eventType) {
      case "cash.opened":
        return {
          ...s,
          openedAt: String(event.payload.openedAt ?? new Date().toISOString()),
          openedBy: (event.payload.openedBy as string | null) ?? null,
          startingFloat: Number(event.payload.startingFloat ?? 0),
        }
      case "cash.saleNoted": {
        const paymentId = String(event.payload.paymentId ?? "")
        if (s.saleIds.includes(paymentId)) return s
        return {
          ...s,
          cashSales: Number(event.payload.cashSales ?? s.cashSales),
          saleIds: [...s.saleIds, paymentId],
        }
      }
      case "cash.payout":
        return { ...s, payouts: Number(event.payload.payouts ?? s.payouts) }
      case "cash.closed":
        return {
          ...s,
          closedAt: String(event.payload.closedAt ?? new Date().toISOString()),
          countedCash: Number(event.payload.countedCash ?? 0),
          expectedCash: Number(event.payload.expectedCash ?? 0),
          variance: Number(event.payload.variance ?? 0),
          varianceReason: (event.payload.varianceReason as string | null) ?? null,
        }
      default:
        return s
    }
  }
}
