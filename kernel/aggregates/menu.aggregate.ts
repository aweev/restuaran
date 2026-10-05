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

export interface MenuRecipeLine {
  inventoryItemId: Id
  qty: number
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
  /** One-line pitch shown under the name on the guest menu. */
  description: string
  /** Typical kitchen time in minutes. */
  prepMinutes: number
  /** Dietary tags: "vegetarian", "vegan", "gluten_free", "spicy". */
  dietary: string[]
  modifiers: MenuModifierGroupView[]
  priceHistory: Array<{ price: number; at: string; by: string }>
  /** Stock recipe: inventory depleted per unit fired. Empty = no auto-deplete. */
  recipe: MenuRecipeLine[]
}

export interface NewMenuItem {
  name: string
  categoryId: Id
  basePrice: number
  cost?: number
  image?: string
  allergens?: string[]
  description?: string
  prepMinutes?: number
  dietary?: string[]
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
      description: "",
      prepMinutes: 0,
      dietary: [],
      modifiers: [],
      priceHistory: [],
      recipe: [],
    })
  }

  static create(tenant: TenantContext, opts: NewMenuItem & { id: Id; actor: ActorContext }): MenuItemAggregate {
    const agg = new MenuItemAggregate(tenant)
    agg.initialize(opts.id)
    if (!opts.name?.trim()) throw kernelError("INVALID_MENU_ITEM", "Name is required")
    if (!Number.isFinite(opts.basePrice) || opts.basePrice < 0) {
      throw kernelError("INVALID_MENU_ITEM", "Base price must be a non-negative number")
    }
    if (opts.prepMinutes != null && (!Number.isFinite(opts.prepMinutes) || opts.prepMinutes < 0)) {
      throw kernelError("INVALID_MENU_ITEM", "Prep time must be a non-negative number of minutes")
    }
    agg.raise("menu.itemCreated", {
      name: opts.name,
      categoryId: opts.categoryId,
      basePrice: opts.basePrice,
      cost: opts.cost ?? 0,
      image: opts.image ?? null,
      allergens: opts.allergens ?? [],
      description: opts.description ?? "",
      prepMinutes: opts.prepMinutes ?? 0,
      dietary: opts.dietary ?? [],
    }, opts.actor)
    return agg
  }

  /** Update the guest-facing content of an item, leaving price/availability alone. */
  updatePresentation(
    actor: ActorContext,
    patch: { description?: string; image?: string | null; prepMinutes?: number; dietary?: string[] },
  ): void {
    if (patch.prepMinutes != null && (!Number.isFinite(patch.prepMinutes) || patch.prepMinutes < 0)) {
      throw kernelError("INVALID_MENU_ITEM", "Prep time must be a non-negative number of minutes")
    }
    if (patch.description != null && patch.description.length > 280) {
      throw kernelError("INVALID_MENU_ITEM", "Description is too long")
    }
    this.raise("menu.itemUpdated", patch, actor)
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

  /**
   * Set the stock recipe: inventory lines depleted per unit fired to the
   * kitchen. Empty array clears the recipe (no auto-deplete).
   */
  setRecipe(actor: ActorContext, recipe: MenuRecipeLine[]): void {
    if (!Array.isArray(recipe)) throw kernelError("INVALID_RECIPE", "Recipe must be an array")
    for (const line of recipe) {
      if (!line.inventoryItemId || typeof line.inventoryItemId !== "string") {
        throw kernelError("INVALID_RECIPE", "Each recipe line needs an inventoryItemId")
      }
      if (!Number.isFinite(line.qty) || line.qty <= 0) {
        throw kernelError("INVALID_RECIPE", "Each recipe line needs a positive qty")
      }
    }
    this.raise("menu.recipeSet", { recipe }, actor)
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
      case "menu.itemUpdated":
        return { ...s, ...event.payload } as MenuState
      case "menu.modifierGroupAdded":
        return { ...s, modifiers: [...s.modifiers, event.payload.group as MenuModifierGroupView] }
      case "menu.recipeSet":
        return { ...s, recipe: (event.payload.recipe as MenuRecipeLine[]) ?? [] }
      default:
        return s
    }
  }
}
