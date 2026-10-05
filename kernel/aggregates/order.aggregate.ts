import { AttributeBag, ActorContext, Id, kernelError, TenantContext } from "@/kernel/types"
import { Aggregate, AggregateEvent } from "./aggregate"
import { fromCents, toCents } from "@/kernel/money"

export interface OrderLine extends AttributeBag {
  lineId: Id
  menuItemId: Id
  name: string
  unitPrice: number
  quantity: number
  modifiers?: Array<{ optionId: Id; name: string; price: number }>
  course?: number
  status: "open" | "sent" | "preparing" | "ready" | "served" | "voided"
  /**
   * A comped line keeps its place on the check but stops counting toward the
   * total. Deliberately distinct from `voided`: a comp is goodwill a manager must
   * still see, whereas a void is a removal.
   */
  comped?: boolean
}

export interface OrderDiscount {
  discountId: Id
  /** `percent` stores its resolved `amount` too, so totals never drift. */
  kind: "percent" | "amount"
  value: number
  amount: number
  label: string
  appliedBy: Id
}

export interface OrderTip {
  tipId: Id
  amount: number
  /** Only meaningful on a split check; otherwise null. */
  splitIndex: number | null
}

export interface OrderSplit {
  splitId: Id
  ways: number
  createdAt: string
}

export interface OrderState extends AttributeBag {
  tableId: Id | null
  customerId: Id | null
  dinerName: string | null
  serverId: Id | null
  channel: "pos" | "kiosk" | "platform" | "phone" | "takeaway" | "delivery" | "dine-in"
  status: "draft" | "open" | "closed" | "voided"
  /** Free-text ticket notes (allergies, timing). Set via `order.setNotes`. */
  notes: string | null
  lines: OrderLine[]
  /** Discounts and comps are a ledger, not a single running number. */
  discounts: OrderDiscount[]
  tips: OrderTip[]
  splits: OrderSplit[]
  /** Transfer ids already applied, so a replayed transfer cannot double-credit. */
  appliedTransfers: Id[]
  discountTotal: number
  taxTotal: number
  taxRate: number | null
  payments: Array<{
    paymentId: Id
    method: string
    amount: number
    gateway?: string
    splitIndex?: number | null
  }>
  /**
   * Courses the kitchen has parked (held) so they are deliberately not fired
   * yet. Persisted as a kernel fact so the hold survives a reload and is shared
   * across every KDS terminal, not just the one that pressed the button.
   */
  heldCourses: number[]
}

const emptyState: OrderState = {
  tableId: null,
  customerId: null,
  dinerName: null,
  serverId: null,
  channel: "pos",
  status: "draft",
  notes: null,
  lines: [],
  discounts: [],
  tips: [],
  splits: [],
  appliedTransfers: [],
  discountTotal: 0,
  taxTotal: 0,
  taxRate: null,
  payments: [],
  heldCourses: [],
}

export interface NewOrderLine {
  menuItemId: Id
  name: string
  unitPrice: number
  quantity: number
  modifiers?: Array<{ optionId: Id; name: string; price: number }>
  course?: number
}

export class OrderAggregate extends Aggregate<OrderState> {
  static readonly TYPE = "Order"

  constructor(tenant: TenantContext) {
    super(OrderAggregate.TYPE, tenant, { ...emptyState, lines: [], payments: [] })
  }

  static create(tenant: TenantContext, opts: {
    id: Id
    channel?: OrderState["channel"]
    tableId?: Id
    serverId?: Id
    customerId?: Id
    dinerName?: string
    actor?: { userId: Id; roles: string[]; permissions: string[] }
  }): OrderAggregate {
    const agg = new OrderAggregate(tenant)
    agg.initialize(opts.id)
    agg.raise(
      "order.created",
      {
        channel: opts.channel ?? "pos",
        tableId: opts.tableId ?? null,
        serverId: opts.serverId ?? null,
        customerId: opts.customerId ?? null,
        dinerName: opts.dinerName ?? null,
      },
      opts.actor
    )
    return agg
  }

  /**
   * Every order event carries routing context (server/table/customer) so the
   * socket bridge and projections never need to load the aggregate to fan out.
   */
  protected raise<TPayload extends AttributeBag>(
    eventType: string,
    payload: TPayload,
    actor?: ActorContext
  ): void {
    const stamped = {
      tableId: this.state.tableId,
      serverId: this.state.serverId,
      customerId: this.state.customerId,
      dinerName: this.state.dinerName,
      status: this.state.status,
      channel: this.state.channel,
      ...payload,
    } as TPayload
    super.raise(eventType, stamped, actor)
  }

  addLine(actor: ActorContext, line: NewOrderLine): void {
    if (this.state.status !== "open" && this.state.status !== "draft") {
      throw kernelError("ORDER_NOT_EDITABLE", `Order is ${this.state.status}`)
    }
    if (!Number.isFinite(line.unitPrice) || line.unitPrice < 0) {
      throw kernelError("INVALID_LINE_PRICE", "Unit price must be a non-negative number")
    }
    if (!Number.isInteger(line.quantity) || line.quantity <= 0) {
      throw kernelError("INVALID_LINE_QUANTITY", "Quantity must be a positive integer")
    }
    this.raise("order.lineAdded", { line: { ...line, lineId: crypto.randomUUID(), status: "open" } }, actor)
  }

  sendToKitchen(actor: ActorContext, lineIds?: Id[]): void {
    const open = this.state.lines.filter((l) => l.status === "open")
    const ids = lineIds ?? open.map((l) => l.lineId)
    if (ids.length === 0) throw kernelError("NOTHING_TO_SEND", "No open lines to send")
    const sent = this.state.lines.filter((l) => ids.includes(l.lineId))
    if (sent.length !== ids.length) throw kernelError("UNKNOWN_LINE", "lineIds reference lines not on this order")
    // Payload embeds full line details so kitchen tickets are self-contained
    // (menuItemId included so recipe auto-depletion can map lines to stock).
    this.raise("order.sentToKitchen", { lineIds: ids, lines: sent.map((l) => ({
      lineId: l.lineId,
      menuItemId: l.menuItemId,
      name: l.name,
      quantity: l.quantity,
      modifiers: (l.modifiers ?? []).map((m) => m.name),
      course: l.course,
    })) }, actor)
  }

  markLinePreparing(actor: ActorContext, lineId: Id): void {
    this.assertLineStatus(lineId, "sent", "preparing")
    this.raise("kitchen.lineBegan", { lineId }, actor)
  }

  markLineReady(actor: ActorContext, lineId: Id): void {
    this.assertLineStatus(lineId, "preparing", "ready")
    this.raise("kitchen.lineReady", { lineId }, actor)
  }

  serveLine(actor: ActorContext, lineId: Id): void {
    this.assertLineStatus(lineId, "ready", "served")
    this.raise("kitchen.lineServed", { lineId }, actor)
  }

  voidLine(actor: ActorContext, lineId: Id, reason: string): void {
    if (this.state.status === "closed") throw kernelError("ORDER_CLOSED", "Order is closed")
    const line = this.state.lines.find((l) => l.lineId === lineId)
    if (!line) throw kernelError("UNKNOWN_LINE", `No line ${lineId} on this order`)
    if (line.status === "served" || line.status === "voided") {
      throw kernelError("BAD_LINE_STATE", `Line is ${line.status}; cannot void`)
    }
    this.raise("order.lineVoided", { lineId, reason }, actor)
  }

  /**
   * Comp a line. Distinct from voidLine: the line stays on the check and keeps
   * its identity but stops counting toward the total. That distinction is what
   * lets a manager review giveaways after the fact.
   */
  compLine(actor: ActorContext, lineId: Id, reason?: string): void {
    if (this.state.status === "closed" || this.state.status === "voided") {
      throw kernelError("ORDER_NOT_EDITABLE", `Order is ${this.state.status}`)
    }
    const line = this.state.lines.find((l) => l.lineId === lineId)
    if (!line) throw kernelError("UNKNOWN_LINE", `No line ${lineId} on this order`)
    if (line.status === "voided") throw kernelError("BAD_LINE_STATE", "Line is voided; cannot comp")
    if (line.comped) throw kernelError("ALREADY_COMPPED", "Line is already comped")
    this.raise("order.lineComped", { lineId, reason: reason ?? "comped" }, actor)
  }

  /** Comp the whole check without touching individual lines. */
  compOrder(actor: ActorContext, reason?: string): void {
    if (this.state.status === "closed" || this.state.status === "voided") {
      throw kernelError("ORDER_NOT_EDITABLE", `Order is ${this.state.status}`)
    }
    if (this.subtotal() <= 0) throw kernelError("NOTHING_TO_COMP", "Order has no chargeable lines")
    this.raise("order.comped", { reason: reason ?? "comped" }, actor)
  }

  /**
   * Set tax from a rate (0-1) or a fixed amount. Explicit rather than derived on
   * read so the figure on a printed receipt cannot change if the rate is later
   * reconfigured.
   */
  applyTax(actor: ActorContext, input: { rate?: number; amount?: number }): void {
    if (this.state.status === "closed" || this.state.status === "voided") {
      throw kernelError("ORDER_NOT_EDITABLE", `Order is ${this.state.status}`)
    }
    if (input.rate == null && input.amount == null) {
      throw kernelError("INVALID_TAX", "Provide a tax rate or amount")
    }
    if (input.rate != null && (!Number.isFinite(input.rate) || input.rate < 0 || input.rate > 1)) {
      throw kernelError("INVALID_TAX", "Tax rate must be between 0 and 1")
    }
    if (input.amount != null && (!Number.isFinite(input.amount) || input.amount < 0)) {
      throw kernelError("INVALID_TAX", "Tax amount must be a non-negative number")
    }
    const taxableCents = Math.max(0, toCents(this.subtotal()) - toCents(this.state.discountTotal))
    const taxTotal = input.rate != null ? fromCents(Math.round((taxableCents * input.rate))) : round2(input.amount as number)
    this.raise("order.taxApplied", { taxTotal, taxRate: input.rate ?? null }, actor)
  }

  addTip(actor: ActorContext, amount: number, splitIndex: number | null = null): void {
    if (this.state.status === "closed" || this.state.status === "voided") {
      throw kernelError("ORDER_NOT_EDITABLE", `Order is ${this.state.status}`)
    }
    if (!Number.isFinite(amount) || amount < 0) {
      throw kernelError("INVALID_TIP", "Tip must be a non-negative number")
    }
    // A tip beyond the balance is almost always a decimal-keying slip; refuse
    // rather than quietly producing a negative refund.
    if (amount > round2(this.balanceDue() + this.tipTotal())) {
      throw kernelError("INVALID_TIP", "Tip exceeds the outstanding balance")
    }
    if (splitIndex != null) this.assertSplitIndex(splitIndex)
    this.raise("order.tipAdded", { tip: { tipId: crypto.randomUUID(), amount, splitIndex } }, actor)
  }

  /** Split a check into equal ways. Idempotent per split id. */
  splitCheck(actor: ActorContext, ways: number, splitId?: Id): void {
    if (this.state.status !== "open" && this.state.status !== "draft") {
      throw kernelError("ORDER_NOT_EDITABLE", `Order is ${this.state.status}`)
    }
    if (!Number.isInteger(ways) || ways < 2 || ways > 20) {
      throw kernelError("INVALID_SPLIT", "Split must be between 2 and 20 ways")
    }
    const id = splitId ?? crypto.randomUUID()
    if (this.state.splits.some((s) => s.splitId === id)) return
    this.raise("order.splitCreated", { split: { splitId: id, ways, createdAt: new Date().toISOString() } }, actor)
  }

  private assertSplitIndex(index: number): void {
    if (!Number.isInteger(index) || index < 0) {
      throw kernelError("INVALID_SPLIT", "Split index must be a non-negative integer")
    }
    const active = this.state.splits[this.state.splits.length - 1]
    if (!active) throw kernelError("NO_ACTIVE_SPLIT", "Check has not been split")
    if (index >= active.ways) throw kernelError("INVALID_SPLIT_INDEX", `Split ${index} exceeds ${active.ways} ways`)
  }

  /** Fire a course: send every open line in that course to the kitchen. */
  fireCourse(actor: ActorContext, course: number): void {
    if (!Number.isInteger(course) || course < 1) {
      throw kernelError("INVALID_COURSE", "Course must be a positive integer")
    }
    const lines = this.state.lines.filter((l) => (l.course ?? 1) === course && l.status === "open")
    if (lines.length === 0) throw kernelError("NOTHING_TO_SEND", `No open lines in course ${course}`)
    this.raise(
      "order.sentToKitchen",
      {
        lineIds: lines.map((l) => l.lineId),
        course,
        lines: lines.map((l) => ({
          lineId: l.lineId,
          menuItemId: l.menuItemId,
          name: l.name,
          quantity: l.quantity,
          modifiers: (l.modifiers ?? []).map((m) => m.name),
          course: l.course,
        })),
      },
      actor,
    )
  }

  /** Park a course so the kitchen does not fire it yet. Idempotent per course. */
  holdCourse(actor: ActorContext, course: number): void {
    if (this.state.status === "closed" || this.state.status === "voided") {
      throw kernelError("ORDER_NOT_EDITABLE", `Order is ${this.state.status}`)
    }
    if (!Number.isInteger(course) || course < 1) {
      throw kernelError("INVALID_COURSE", "Course must be a positive integer")
    }
    if (this.state.heldCourses.includes(course)) return
    this.raise("order.courseHeld", { course }, actor)
  }

  /** Release a parked course so it can be fired. */
  releaseCourse(actor: ActorContext, course: number): void {
    if (!this.state.heldCourses.includes(course)) {
      throw kernelError("COURSE_NOT_HELD", `Course ${course} is not held`)
    }
    this.raise("order.courseReleased", { course }, actor)
  }

  private assertLineStatus(lineId: Id, from: OrderLine["status"], to: OrderLine["status"]): void {
    const line = this.state.lines.find((l) => l.lineId === lineId)
    if (!line) throw kernelError("UNKNOWN_LINE", `No line ${lineId} on this order`)
    if (line.status !== from) {
      throw kernelError("BAD_LINE_STATE", `Line is ${line.status}; cannot move ${from} -> ${to}`)
    }
  }

  recordPayment(
    actor: ActorContext,
    payment: { method: string; amount: number; gateway?: string; splitIndex?: number | null },
  ): void {
    if (payment.amount <= 0) throw kernelError("INVALID_PAYMENT", "Payment amount must be positive")
    if (payment.splitIndex != null) this.assertSplitIndex(payment.splitIndex)
    this.raise(
      "order.paymentRecorded",
      { payment: { ...payment, splitIndex: payment.splitIndex ?? null, paymentId: crypto.randomUUID() } },
      actor,
    )
  }

  /**
   * Percentage or fixed-amount discount, validated against what is still
   * actually chargeable. A discount can never exceed the remaining balance,
   * which stops a stacked-discount bug producing a negative check.
   */
  applyDiscount(
    actor: ActorContext,
    input: { kind: "percent" | "amount"; value: number; label?: string },
  ): void {
    if (this.state.status === "closed" || this.state.status === "voided") {
      throw kernelError("ORDER_NOT_EDITABLE", `Order is ${this.state.status}`)
    }
    const subtotal = this.subtotal()
    if (subtotal <= 0) throw kernelError("NOTHING_TO_DISCOUNT", "Order has no chargeable lines")

    if (input.kind === "percent") {
      if (!Number.isFinite(input.value) || input.value <= 0 || input.value > 100) {
        throw kernelError("INVALID_DISCOUNT", "Percent discount must be between 0 and 100")
      }
      const subtotalCents = toCents(subtotal)
      const pctAmount = fromCents(Math.round((subtotalCents * input.value) / 100))
      this.pushDiscount(actor, {
        kind: "percent",
        value: input.value,
        amount: pctAmount,
        label: input.label ?? `${input.value}% off`,
      })
      return
    }

    if (!Number.isFinite(input.value) || input.value <= 0) {
      throw kernelError("INVALID_DISCOUNT", "Discount amount must be positive")
    }
    const remainingCents = Math.max(0, toCents(subtotal) - toCents(this.state.discountTotal))
    const amount = fromCents(Math.min(toCents(input.value), remainingCents))
    if (amount <= 0) throw kernelError("DISCOUNT_EXCEEDS_TOTAL", "Discount exceeds the remaining balance")
    this.pushDiscount(actor, { kind: "amount", value: amount, amount, label: input.label ?? "Discount" })
  }

  private pushDiscount(
    actor: ActorContext,
    d: { kind: "percent" | "amount"; value: number; amount: number; label: string },
  ): void {
    const discount: OrderDiscount = { ...d, discountId: crypto.randomUUID(), appliedBy: actor.userId }
    const discountTotal = fromCents(toCents(this.state.discountTotal) + toCents(d.amount))
    this.raise("order.discountApplied", { discount, discountTotal }, actor)
  }

  /**
   * Move lines to another check (splitting a table, or correcting a rung-in on
   * the wrong table).
   *
   * The Neon HTTP driver cannot span a transaction across two aggregates, so a
   * transfer is deliberately *not* atomic. It is idempotent by `transferId`:
   * the receiver records the id in `appliedTransfers`, so replaying a partially
   * applied transfer credits the destination exactly once.
   */
  transferLinesOut(actor: ActorContext, toOrderId: Id, lineIds: Id[], transferId: Id): void {
    if (this.state.status !== "open" && this.state.status !== "draft") {
      throw kernelError("ORDER_NOT_EDITABLE", `Order is ${this.state.status}`)
    }
    if (toOrderId === this.id) throw kernelError("INVALID_TRANSFER", "Cannot transfer to the same order")
    if (!Array.isArray(lineIds) || lineIds.length === 0) {
      throw kernelError("INVALID_TRANSFER", "Provide at least one line to transfer")
    }
    if (this.state.appliedTransfers.includes(transferId)) return
    const unknown = lineIds.filter((id) => !this.state.lines.some((l) => l.lineId === id))
    if (unknown.length > 0) throw kernelError("UNKNOWN_LINE", `No line ${unknown[0]} on this order`)
    this.raise(
      "order.linesTransferredOut",
      {
        transferId,
        toOrderId,
        lines: lineIds.map((id) => ({ ...(this.state.lines.find((l) => l.lineId === id) as OrderLine) })),
      },
      actor,
    )
  }

  /** Receive transferred lines. Idempotent by transferId. */
  transferLinesIn(actor: ActorContext, fromOrderId: Id, lines: OrderLine[], transferId: Id): void {
    if (this.state.status === "closed" || this.state.status === "voided") {
      throw kernelError("ORDER_NOT_EDITABLE", `Destination order is ${this.state.status}`)
    }
    // The idempotency guard: a replayed transfer must not double-credit.
    if (this.state.appliedTransfers.includes(transferId)) return
    if (!Array.isArray(lines) || lines.length === 0) throw kernelError("INVALID_TRANSFER", "No lines to receive")
    this.raise("order.linesTransferredIn", { transferId, fromOrderId, lines }, actor)
  }

  close(actor: ActorContext): void {
    const total = this.orderTotal()
    const paid = this.paidTotal()
    if (paid + 0.001 < total) {
      throw kernelError("ORDER_UNPAID", `Cannot close: paid ${paid} of ${total}`)
    }
    // Totals ride on the event so downstream consumers (accounting connector,
    // webhooks) never need to load the aggregate.
    this.raise("order.closed", { total, paid, tipTotal: this.tipTotal() }, actor)
  }

  void(actor: ActorContext, reason: string): void {
    if (this.state.status === "closed") throw kernelError("ORDER_ALREADY_CLOSED", "Cannot void a closed order")
    this.raise("order.voided", { reason }, actor)
  }

  /**
   * Free-text ticket notes. Allowed on draft/open tickets only — a closed
   * check is financial history and must not be annotated after the fact.
   * Capped so a pasted novel cannot bloat the event payload.
   */
  setNotes(actor: ActorContext, notes: string): void {
    if (this.state.status === "closed" || this.state.status === "voided") {
      throw kernelError("ORDER_NOT_EDITABLE", `Order is ${this.state.status}`)
    }
    if (typeof notes !== "string" || notes.length > 2000) {
      throw kernelError("INVALID_NOTES", "Notes must be a string of at most 2000 characters")
    }
    this.raise("order.notesSet", { notes }, actor)
  }

  setTable(actor: ActorContext, tableId: Id): void {
    if (this.state.status === "closed" || this.state.status === "voided") {
      throw kernelError("ORDER_NOT_EDITABLE", `Order is ${this.state.status}`)
    }
    this.raise("order.tableChanged", { tableId }, actor)
  }

  /** Chargeable line value: voided and comped lines contribute nothing. */
  subtotal(): number {
    const cents = this.state.lines
      .filter((l) => l.status !== "voided" && !l.comped)
      .reduce((s, l) => s + this.lineValueCents(l), 0)
    return fromCents(cents)
  }

  private lineValueCents(l: OrderLine): number {
    const extrasCents = (l.modifiers ?? []).reduce((m, o) => m + toCents(o.price), 0)
    return (toCents(l.unitPrice) + extrasCents) * l.quantity
  }

  private lineValue(l: OrderLine): number {
    return fromCents(this.lineValueCents(l))
  }

  tipTotal(): number {
    const cents = this.state.tips.reduce((s, t) => s + toCents(t.amount), 0)
    return fromCents(cents)
  }

  paidTotal(): number {
    const cents = this.state.payments.reduce((s, p) => s + toCents(p.amount), 0)
    return fromCents(cents)
  }

  /** What the guest still owes. Tips are extra, so they are excluded here. */
  balanceDue(): number {
    return fromCents(Math.max(0, toCents(this.orderTotal()) - toCents(this.paidTotal())))
  }

  orderTotal(): number {
    return fromCents(
      Math.max(0, toCents(this.subtotal()) - toCents(this.state.discountTotal) + toCents(this.state.taxTotal)),
    )
  }

  protected applyEvent(event: AggregateEvent): OrderState {
    const s = this.state
    const setLine = (id: Id, status: OrderLine["status"]): OrderState => ({
      ...s,
      lines: s.lines.map((l) => (l.lineId === id ? { ...l, status } : l)),
    })
    switch (event.eventType) {
      case "order.created":
        return { ...s, ...event.payload }
      case "order.lineAdded":
        return {
          ...s,
          status: s.status === "draft" ? "open" : s.status,
          lines: [...s.lines, event.payload.line as OrderLine],
        }
      case "order.lineVoided":
        return setLine(event.payload.lineId as Id, "voided")
      case "order.lineComped":
        return {
          ...s,
          // The line stays put and stays visible; only its value is zeroed.
          lines: s.lines.map((l) => (l.lineId === event.payload.lineId ? { ...l, comped: true } : l)),
        }
      case "order.comped":
        return { ...s, lines: s.lines.map((l) => ({ ...l, comped: true })) }
      case "order.sentToKitchen": {
        const ids = new Set(event.payload.lineIds as Id[])
        return { ...s, lines: s.lines.map((l) => (ids.has(l.lineId) ? { ...l, status: "sent" as const } : l)) }
      }
      case "order.courseHeld":
        return {
          ...s,
          heldCourses: [...new Set([...s.heldCourses, Number(event.payload.course)])],
        }
      case "order.courseReleased":
        return { ...s, heldCourses: s.heldCourses.filter((c) => c !== Number(event.payload.course)) }
      case "kitchen.lineBegan":
        return setLine(event.payload.lineId as Id, "preparing")
      case "kitchen.lineReady":
        return setLine(event.payload.lineId as Id, "ready")
      case "kitchen.lineServed":
        return setLine(event.payload.lineId as Id, "served")
      case "order.discountApplied":
        return {
          ...s,
          discounts: [...s.discounts, event.payload.discount as OrderDiscount],
          discountTotal: Number(event.payload.discountTotal ?? s.discountTotal),
        }
      case "order.taxApplied":
        return {
          ...s,
          taxTotal: Number(event.payload.taxTotal ?? s.taxTotal),
          taxRate: (event.payload.taxRate as number | null) ?? null,
        }
      case "order.tipAdded":
        return { ...s, tips: [...s.tips, event.payload.tip as OrderTip] }
      case "order.splitCreated":
        return { ...s, splits: [...s.splits, event.payload.split as OrderSplit] }
      case "order.paymentRecorded":
        return { ...s, payments: [...s.payments, event.payload.payment as OrderState["payments"][number]] }
      case "order.linesTransferredOut": {
        // Moved lines are retained as `transferred` for audit but no longer
        // count, so the source check shows what left without double-charging.
        const moved = new Set((event.payload.lines as OrderLine[]).map((l) => l.lineId))
        return {
          ...s,
          appliedTransfers: [...s.appliedTransfers, event.payload.transferId as Id],
          lines: s.lines.map((l) => (moved.has(l.lineId) ? { ...l, status: "voided" as const } : l)),
        }
      }
      case "order.linesTransferredIn": {
        const incoming = (event.payload.lines as OrderLine[]).map((l) => ({
          ...l,
          // Incoming lines always land `open`, whatever state they had when they
          // left, so the destination can send them on.
          status: "open" as const,
          comped: undefined,
        }))
        return {
          ...s,
          status: s.status === "draft" ? "open" : s.status,
          appliedTransfers: [...s.appliedTransfers, event.payload.transferId as Id],
          lines: [...s.lines, ...incoming],
        }
      }
      case "order.closed":
        return { ...s, status: "closed" }
      case "order.voided":
        return { ...s, status: "voided" }
      case "order.notesSet":
        return { ...s, notes: String(event.payload.notes ?? "") }
      case "order.tableChanged":
        return { ...s, tableId: event.payload.tableId as Id }
      default:
        return s
    }
  }
}

/** Money is rounded to cents at every boundary; floats must not leak into totals. */
export function round2(n: number): number {
  return fromCents(toCents(n))
}

