// types/pos/recipe.types.ts

import { MenuItem } from './menu.types';
import { Ingredient } from './inventory.types';
import { UnitOfMeasure } from './units-of-measure.types'; // Assumed to be created
import { User } from './auth.types';
import { Location } from './multi-location.types'; // If recipes vary by location

export interface RecipeItem {
  id: string;
  ingredientId: Ingredient['id'];
  subRecipeId?: Recipe['id']; // If this component is another pre-defined recipe (e.g., "Burger Sauce")
  quantity: number; // Quantity of the ingredient/sub-recipe used
  unitOfMeasureId: UnitOfMeasure['id']; // Unit in which quantity is specified (e.g., grams, ml, pieces)
                                      // This unit MUST be convertible to the Ingredient's baseUnitOfMeasure
  notes?: string; // e.g., "diced", "to taste"
  isYieldAdjustable?: boolean; // If true, this ingredient's quantity scales with recipe yield
  sequenceNumber?: number; // Order in preparation steps
  costContribution?: number; // Calculated: quantity * ingredient_cost_per_uom (cents/decimal) - Store if needed for snapshots
}

export interface Recipe {
  id: string;
  restaurantId: string;
  // Target of the recipe:
  menuItemId?: MenuItem['id']; // If this recipe is directly for a sellable MenuItem
  name: string; // If this is a "sub-recipe" / "prep item" (e.g., "Pizza Dough", "House Dressing")
  subRecipeCode?: string; // If it's a sub-recipe, might have its own code

  description?: string; // e.g., "Standard Burger Build", "12-inch Pizza Base"
  version: number; // For recipe versioning
  isActive: boolean; // Is this the current active recipe for the MenuItem/sub-recipe?

  yieldQuantity: number; // How many portions this recipe makes (e.g., 1 for a single burger, 10 for a batch of sauce)
  yieldUnitOfMeasureId?: UnitOfMeasure['id']; // Unit of the yield (e.g., "portion", "liter", "kilogram")

  preparationInstructions?: string; // Step-by-step instructions
  preparationTimeMinutes?: number; // Active prep time
  cookingTimeMinutes?: number; // Cook time
  totalTimeMinutes?: number;

  components: RecipeItem[]; // List of ingredients or sub-recipes

  // Calculated total cost for one yield unit of this recipe (sum of component costs)
  totalCostPerYield?: number; // (cents/decimal) - Store if needed for snapshots or calculate on demand

  // Location-specific recipe variations (optional)
  locationOverrides?: {
    locationId: Location['id'];
    components?: RecipeItem[]; // Overridden components for this location
    yieldQuantity?: number;
    totalCostPerYield?: number;
  }[];

  createdByUserId: User['id'];
  createdAt: Date;
  updatedAt: Date;
  updatedByUserId?: User['id'];
  approvedByUserId?: User['id']; // If recipes require approval
  approvalDate?: Date;
}