// types/pos/menu.types.ts
import { Location } from './multi-location.types';
import { User } from './auth.types';
import { TaxSetting } from './accounting.types'; // For linking default tax
import { Ingredient } from './inventory.types'; // For recipe/costing
import { Printer } from './printer.types'; // For KDS/Printer routing

export type MenuCategory =
  | "all" // Special value for filtering, not usually an item category
  | "appetizers"
  | "soups_salads"
  | "main_courses_entrees"
  | "burgers_sandwiches"
  | "pasta_noodles"
  | "pizza"
  | "seafood"
  | "steaks_grill"
  | "vegetarian_vegan"
  | "sides"
  | "desserts"
  | "kids_menu"
  | "hot_drinks_coffee_tea"
  | "cold_drinks_soda_juice"
  | "beer_ales"
  | "wine"
  | "cocktails_spirits"
  | "breakfast" 
  | "specials_daily"
  | "combo_meals"
  | string; // Allow for fully custom categories

export interface MenuCategoryEntity {
  id: string; // Can be the string from MenuCategory type if simple, or UUID if complex
  restaurantId: string;
  name: string;
  description?: string;
  imageUrl?: string;
  displayOrder: number;
  parentCategoryId?: MenuCategoryEntity['id']; // For sub-categories
  isActive: boolean;
  colorCode?: string; // For UI theming
  kdsPrinterId?: Printer['id']; // Route items of this category to specific KDS/printer
  locationAvailability?: Record<Location['id'], boolean>; // If category availability varies by location
  createdAt: Date;
  updatedAt: Date;
}

export type FoodType = "vegetarian" | "vegan" | "non_vegetarian" | "gluten_free_option" | "contains_nuts" | string;

export type Allergen =
  | "celery" | "gluten" | "crustaceans" | "eggs" | "fish" | "lupin"
  | "milk" | "molluscs" | "mustard" | "nuts_tree" | "peanuts"
  | "sesame_seeds" | "soya" | "sulphur_dioxide_sulphites" | string; // Allow custom

export interface NutritionalInfo {
  servingSize?: string; // e.g., "100g", "1 slice"
  calories?: number;
  proteinGrams?: number;
  carbohydratesGrams?: number;
  fatTotalGrams?: number;
  fatSaturatedGrams?: number;
  fatTransGrams?: number;
  sugarGrams?: number;
  sodiumMilligrams?: number;
  fiberGrams?: number;
  cholesterolMilligrams?: number;
}

//an option within a modifier group (e.g., "Small", "Medium", "Large" for Size modifier).
export interface MenuItemModifierOption {
  id: string; // Unique ID for this option
  name: string;
  priceAdjustment: number; // Amount to add/subtract from base item price (cents/decimal)
                            // Can be 0 for no-cost options.
  caloriesAdjustment?: number; // Optional calorie change for this option
  isDefault?: boolean; // Is this option pre-selected?
  isAvailable: boolean;
  displayOrder?: number;
  recipeIngredientAdjustments?: { ingredientId: Ingredient['id'], quantityChange: number }[]; // For inventory impact
}

export interface MenuItemModifierGroup {
  id: string; // Unique ID for this modifier group
  restaurantId: string;
  name: string; // e.g., "Choose Size", "Select Toppings", "Steak Doneness"
  description?: string;
  options: MenuItemModifierOption[];
  minSelections: number; // Minimum number of options that must be selected
  maxSelections: number; // Maximum number of options that can be selected (e.g., 1 for radio, N for checkboxes)
  isRequired: boolean; // Covered by minSelections > 0
  allowMultipleSelectionsOfSameOption: boolean; // e.g., "Extra Cheese x2" - handled by quantity on option in cart
  displayType: "radio" | "checkbox" | "dropdown" | "quantity_stepper"; // How it's presented in UI
  displayOrder?: number; // Order of modifier groups on the item
  locationAvailability?: Record<Location['id'], boolean>; // If modifier availability varies by location
  createdAt: Date;
  updatedAt: Date;
}

export interface MenuItem {
  id: string;
  restaurantId: string;
  title: string; // Name of the item
  shortName?: string; // For POS buttons or KDS display
  description?: string;
  imageUrl?: string;
  basePrice: number; // Price before any modifiers (in cents/decimal)
  currency: string; // e.g., "USD"

  categories: MenuCategory[]; // Can belong to multiple categories
  primaryCategoryId: MenuCategory; // The main category for display/reporting

  foodTypes?: FoodType[]; // e.g., ["vegetarian", "gluten_free_option"]
  allergens?: Allergen[];
  nutritionalInfo?: NutritionalInfo;

  // Modifiers & Customization
  modifierGroupIds?: MenuItemModifierGroup['id'][]; // IDs of applicable modifier groups
  embeddedModifiers?: MenuItemModifierGroup[]; // Alternative: embed if modifiers are item-specific and not reused

  // Availability & Kitchen
  isAvailable: boolean; // Overall availability
  availabilityByLocation?: Record<Location['id'], boolean>; // Location-specific availability
  preparationTimeMinutes?: number; // Estimated prep time
  kdsRoutingPrinterIds?: Printer['id'][]; // Specific KDS screens or printers for this item
  courseDefault?: string; // e.g., "Appetizer", "Main" - can be overridden at order time

  // Sales & Display
  displayOrderInCategory?: number;
  isPopular?: boolean; // Manually flagged or algorithmically determined
  isFeatured?: boolean; // For special highlighting
  tags?: string[]; // e.g., "spicy", "new", "chef_special"

  // Costing & Tax
  costOfGoodsSold?: number; // Calculated from recipe, in cents/decimal
  defaultTaxSettingIds?: TaxSetting['id'][]; // Applicable tax rates

  // PLU/Barcode
  pluCode?: string; // Price Look-Up code
  barcode?: string;

  // System Fields
  isArchived: boolean; // Soft delete
  createdByUserId: User['id'];
  createdAt: Date;
  updatedAt: Date;
  updatedByUserId?: User['id'];
}

export interface MenuUIState {
  categories: {
    id: MenuCategory | MenuCategoryEntity['id'];
    label: string;
    itemCount: number; // Number of items in this category
  }[];
  items: MenuItem[]; // Items for the selected category or search result
  allModifierGroups: MenuItemModifierGroup[]; // For lookup when configuring items
  isLoading: boolean;
  error: string | null;
  selectedCategoryId?: MenuCategory | MenuCategoryEntity['id'];
  searchTerm?: string;
  filters?: {
    foodTypes?: FoodType[];
    isPopular?: boolean;
  };
}
