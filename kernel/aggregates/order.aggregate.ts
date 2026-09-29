import { AttributeBag, ActorContext, Id, kernelError, TenantContext } from "@/kernel/types"
import { Aggregate, AggregateEvent } from "./aggregate"

export interface OrderLine extends AttributeBag {
  lineId: Id
  menuItemId: Id
  name: string
  unitPrice: number
  quantity: number
  modifiers?: Array<{ optionId: Id; name: string; price: number }>
  course?: number
  status: "open" | "sent" | "preparing" | "ready" | "served" | "voided"
}

export interface OrderState extends AttributeBag {
  tableId: Id | null
  customerId: Id | null
  dinerName: string | null
  serverId: Id | null
  channel: "pos" | "kiosk" | "platform" | "phone"
  status: "draft" | "open" | "closed" | "voided"
  lines: OrderLine[]
  discountTotal: number
  taxTotal: number
  payments: Array<{ paymentId: Id; method: string; amount: number; gateway?: string }>
}

const emptyState: OrderState = {
  tableId: null,
  customerId: null,
  dinerName: null,
  serverId: null,
  channel: "pos",
  status: "draft",
  lines: [],
  discountTotal: 0,
  taxTotal: 0,
  payments: [],
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
    // Payload embeds full line details so kitchen tickets are self-contained.
    this.raise("order.sentToKitchen", { lineIds: ids, lines: sent.map((l) => ({
      lineId: l.lineId,
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

  private assertLineStatus(lineId: Id, from: OrderLine["status"], to: OrderLine["status"]): void {
    const line = this.state.lines.find((l) => l.lineId === lineId)
    if (!line) throw kernelError("UNKNOWN_LINE", `No line ${lineId} on this order`)
    if (line.status !== from) {
      throw kernelError("BAD_LINE_STATE", `Line is ${line.status}; cannot move ${from} -> ${to}`)
    }
  }

  recordPayment(actor: ActorContext, payment: { method: string; amount: number; gateway?: string }): void {
    if (payment.amount <= 0) throw kernelError("INVALID_PAYMENT", "Payment amount must be positive")
    this.raise("order.paymentRecorded", { payment: { ...payment, paymentId: crypto.randomUUID() } }, actor)
  }

  close(actor: ActorContext): void {
    const total = this.orderTotal()
    const paid = this.state.payments.reduce((s, p) => s + p.amount, 0)
    if (paid + 0.001 < total) {
      throw kernelError("ORDER_UNPAID", `Cannot close: paid ${paid} of ${total}`)
    }
    // Totals ride on the event so downstream consumers (accounting connector,
    // webhooks) never need to load the aggregate.
    this.raise("order.closed", { total, paid }, actor)
  }

  void(actor: ActorContext, reason: string): void {
    if (this.state.status === "closed") throw kernelError("ORDER_ALREADY_CLOSED", "Cannot void a closed order")
    this.raise("order.voided", { reason }, actor)
  }

  orderTotal(): number {
    const sub = this.state.lines
      .filter((l) => l.status !== "voided")
      .reduce((s, l) => s + l.unitPrice * l.quantity + (l.modifiers?.reduce((m, o) => m + o.price, 0) ?? 0) * l.quantity, 0)
    return Math.max(0, sub - this.state.discountTotal + this.state.taxTotal)
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
        return { ...s, status: s.status === "draft" ? "open" : s.status, lines: [...s.lines, event.payload.line as OrderLine] }
      case "order.lineVoided":
        return setLine(event.payload.lineId as Id, "voided")
      case "order.sentToKitchen": {
        const ids = new Set(event.payload.lineIds as Id[])
        return { ...s, lines: s.lines.map((l) => (ids.has(l.lineId) ? { ...l, status: "sent" as const } : l)) }
      }
      case "kitchen.lineBegan":
        return setLine(event.payload.lineId as Id, "preparing")
      case "kitchen.lineReady":
        return setLine(event.payload.lineId as Id, "ready")
      case "kitchen.lineServed":
        return setLine(event.payload.lineId as Id, "served")
      case "order.discountApplied":
        return { ...s, discountTotal: Number(event.payload.discountTotal ?? s.discountTotal) }
      case "order.taxApplied":
        return { ...s, taxTotal: Number(event.payload.taxTotal ?? s.taxTotal) }
      case "order.paymentRecorded":
        return { ...s, payments: [...s.payments, event.payload.payment as OrderState["payments"][number]] }
      case "order.closed":
        return { ...s, status: "closed" }
      case "order.voided":
        return { ...s, status: "voided" }
      default:
        return s
    }
  }
}
