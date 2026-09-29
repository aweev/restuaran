import { ActorContext, AttributeBag, Id, kernelError, TenantContext } from "@/kernel/types"
import { Aggregate, AggregateEvent } from "./aggregate"

export interface MenuModifierOptionView {
  optionId: Id
  name: string
  priceAdjustment: number
}

export interface MenuModifierGroupView {
  groupId: Id
  name: string
  required: boolean
  multiple: boolean
  options: MenuModifierOptionView[]
}

export interface MenuState extends AttributeBag {
  name: string
  categoryId: Id
  basePrice: number
  available: boolean
  /** "86'd" — out of stock; overrides available until cleared */
  eightySixed: boolean
  eightySixReason: string | null
  cost: number
  image: string | null
  allergens: string[]
  modifiers: MenuModifierGroupView[]
  priceHistory: Array<{ price: number; at: string; by: string }>
}

export interface NewMenuItem {
  name: string
  categoryId: Id
  basePrice: number
  cost?: number
  image?: string
  allergens?: string[]
}

export class MenuItemAggregate extends Aggregate<MenuState> {
  static readonly TYPE = "MenuItem"

  constructor(tenant: TenantContext) {
    super(MenuItemAggregate.TYPE, tenant, {
      name: "",
      categoryId: "",
      basePrice: 0,
      available: true,
      eightySixed: false,
      eightySixReason: null,
      cost: 0,
      image: null,
      allergens: [],
      modifiers: [],
      priceHistory: [],
    })
  }

  static create(tenant: TenantContext, opts: NewMenuItem & { id: Id; actor: ActorContext }): MenuItemAggregate {
    const agg = new MenuItemAggregate(tenant)
    agg.initialize(opts.id)
    if (!opts.name?.trim()) throw kernelError("INVALID_MENU_ITEM", "Name is required")
    if (!Number.isFinite(opts.basePrice) || opts.basePrice < 0) {
      throw kernelError("INVALID_MENU_ITEM", "Base price must be a non-negative number")
    }
    agg.raise("menu.itemCreated", {
      name: opts.name,
      categoryId: opts.categoryId,
      basePrice: opts.basePrice,
      cost: opts.cost ?? 0,
      image: opts.image ?? null,
      allergens: opts.allergens ?? [],
    }, opts.actor)
    return agg
  }

  changePrice(actor: ActorContext, price: number): void {
    if (!Number.isFinite(price) || price < 0) throw kernelError("INVALID_PRICE", "Price must be a non-negative number")
    this.raise("menu.priceChanged", { basePrice: price }, actor)
  }

  setAvailability(actor: ActorContext, available: boolean): void {
    if (this.state.eightySixed && available) {
      throw kernelError("CLEAR_86_FIRST", "Clear the 86 before marking the item available")
    }
    this.raise("menu.availabilityChanged", { available }, actor)
  }

  eightySix(actor: ActorContext, reason: string): void {
    this.raise("menu.eightySixed", { eightySixed: true, eightySixReason: reason, available: false }, actor)
  }

  clearEightySix(actor: ActorContext): void {
    if (!this.state.eightySixed) throw kernelError("NOT_86D", "Item is not 86'd")
    this.raise("menu.eightySixCleared", { eightySixed: false, eightySixReason: null, available: true }, actor)
  }

  addModifierGroup(actor: ActorContext, group: Omit<MenuModifierGroupView, "groupId"> & { groupId?: Id }): void {
    this.raise("menu.modifierGroupAdded", {
      group: { ...group, groupId: group.groupId ?? crypto.randomUUID() },
    }, actor)
  }

  sellable(): boolean {
    return this.state.available && !this.state.eightySixed
  }

  margin(): number {
    return this.state.basePrice - this.state.cost
  }

  protected applyEvent(event: AggregateEvent): MenuState {
    const s = this.state
    switch (event.eventType) {
      case "menu.itemCreated":
        return {
          ...s,
          ...event.payload,
          priceHistory: [
            { price: Number(event.payload.basePrice), at: event.occurredAt, by: event.actor?.userId ?? "system" },
          ],
        } as MenuState
      case "menu.priceChanged":
        return {
          ...s,
          basePrice: Number(event.payload.basePrice),
          priceHistory: [
            ...s.priceHistory,
            { price: Number(event.payload.basePrice), at: event.occurredAt, by: event.actor?.userId ?? "system" },
          ],
        }
      case "menu.availabilityChanged":
      case "menu.eightySixed":
      case "menu.eightySixCleared":
        return { ...s, ...event.payload } as MenuState
      case "menu.modifierGroupAdded":
        return { ...s, modifiers: [...s.modifiers, event.payload.group as MenuModifierGroupView] }
      default:
        return s
    }
  }
}
