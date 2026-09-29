import { ActorContext, AttributeBag, Id, kernelError, TenantContext } from "@/kernel/types"
import { Aggregate, AggregateEvent } from "./aggregate"

export interface InventoryState extends AttributeBag {
  sku: string
  name: string
  unit: string
  onHand: number
  reserved: number
  reorderPoint: number
  unitCost: number
  vendorId: Id | null
  wastageTotal: number
}

export class InventoryItemAggregate extends Aggregate<InventoryState> {
  static readonly TYPE = "InventoryItem"

  constructor(tenant: TenantContext) {
    super(InventoryItemAggregate.TYPE, tenant, {
      sku: "",
      name: "",
      unit: "ea",
      onHand: 0,
      reserved: 0,
      reorderPoint: 0,
      unitCost: 0,
      vendorId: null,
      wastageTotal: 0,
    })
  }

  static define(tenant: TenantContext, opts: {
    id: Id
    sku: string
    name: string
    unit: string
    reorderPoint?: number
    unitCost?: number
    vendorId?: Id
    actor: ActorContext
  }): InventoryItemAggregate {
    const agg = new InventoryItemAggregate(tenant)
    agg.initialize(opts.id)
    agg.raise("inventory.itemDefined", {
      sku: opts.sku,
      name: opts.name,
      unit: opts.unit,
      reorderPoint: opts.reorderPoint ?? 0,
      unitCost: opts.unitCost ?? 0,
      vendorId: opts.vendorId ?? null,
    }, opts.actor)
    return agg
  }

  receive(actor: ActorContext, quantity: number, opts?: { note?: string }): void {
    if (quantity <= 0) throw kernelError("INVALID_QUANTITY", "Receive quantity must be positive")
    this.raise("inventory.received", { delta: quantity, note: opts?.note ?? null }, actor)
  }

  consume(actor: ActorContext, quantity: number, orderId?: Id): void {
    if (quantity <= 0) throw kernelError("INVALID_QUANTITY", "Consume quantity must be positive")
    if (this.state.onHand < quantity) throw kernelError("INSUFFICIENT_STOCK", `onHand=${this.state.onHand} need=${quantity}`)
    this.raise("inventory.consumed", { delta: quantity, orderId: orderId ?? null }, actor)
  }

  recordWastage(actor: ActorContext, quantity: number, reason: string): void {
    if (quantity <= 0 || this.state.onHand < quantity) throw kernelError("INVALID_QUANTITY", "Wastage exceeds on-hand")
    this.raise("inventory.wasted", { delta: quantity, reason }, actor)
  }

  adjust(actor: ActorContext, counted: number, reason: string): void {
    const delta = counted - this.state.onHand
    this.raise("inventory.adjusted", { delta, reason, target: counted }, actor)
  }

  available(): number {
    return this.state.onHand - this.state.reserved
  }

  protected applyEvent(event: AggregateEvent): InventoryState {
    const s = this.state
    switch (event.eventType) {
      case "inventory.itemDefined":
        return { ...s, ...event.payload }
      case "inventory.received":
        return { ...s, onHand: s.onHand + Number(event.payload.delta) }
      case "inventory.consumed":
        return { ...s, onHand: s.onHand - Number(event.payload.delta) }
      case "inventory.wasted":
        return {
          ...s,
          onHand: s.onHand - Number(event.payload.delta),
          wastageTotal: s.wastageTotal + Number(event.payload.delta),
        }
      case "inventory.adjusted":
        return { ...s, onHand: Number(event.payload.target) }
      default:
        return s
    }
  }
}
