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
  /** Merchandising grouping for the stock screens; empty when uncategorised. */
  category: string
  /** Soft-delete flag: inactive items stay in history but leave the boards. */
  isActive: boolean
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
      category: "",
      isActive: true,
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
    category?: string
    actor: ActorContext
  }): InventoryItemAggregate {
    const agg = new InventoryItemAggregate(tenant)
    agg.initialize(opts.id)
    if (!opts.name?.trim()) throw kernelError("INVALID_ITEM", "Item name is required")
    agg.raise("inventory.itemDefined", {
      sku: opts.sku,
      name: opts.name,
      unit: opts.unit,
      reorderPoint: opts.reorderPoint ?? 0,
      unitCost: opts.unitCost ?? 0,
      vendorId: opts.vendorId ?? null,
      category: opts.category ?? "",
      isActive: true,
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

  /**
   * Edit item metadata without touching stock. Stock moves through
   * receive/consume/waste/adjust so every unit stays accountable.
   */
  updateDetails(actor: ActorContext, patch: {
    name?: string
    unit?: string
    reorderPoint?: number
    unitCost?: number
    category?: string
    vendorId?: Id | null
    isActive?: boolean
  }): void {
    if (patch.name !== undefined && !patch.name.trim()) {
      throw kernelError("INVALID_ITEM", "Item name is required")
    }
    if (patch.reorderPoint !== undefined && patch.reorderPoint < 0) {
      throw kernelError("INVALID_ITEM", "Reorder point cannot be negative")
    }
    if (patch.unitCost !== undefined && patch.unitCost < 0) {
      throw kernelError("INVALID_ITEM", "Unit cost cannot be negative")
    }
    this.raise("inventory.itemUpdated", { ...patch }, actor)
  }

  setActive(actor: ActorContext, isActive: boolean): void {
    this.raise("inventory.itemUpdated", { isActive }, actor)
  }

  available(): number {
    return this.state.onHand - this.state.reserved
  }

  protected applyEvent(event: AggregateEvent): InventoryState {
    const s = this.state
    switch (event.eventType) {
      case "inventory.itemDefined":
      case "inventory.itemUpdated":
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
