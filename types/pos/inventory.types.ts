// types/pos/inventory.types.ts
import { User } from './auth.types';
import { Vendor } from './vendor.types';
import { Location } from './multi-location.types';
import { Order } from './order.types'; 
import { MenuItem } from './menu.types'; 
import { UnitOfMeasure } from './units-of-measure.types';
import { StockTake } from './stock-take.types'; 

export type IngredientCategory =
  | "produce"
  | "dairy_eggs"
  | "meat_poultry"
  | "seafood"
  | "bakery_bread"
  | "dry_goods_pantry" // e.g., flour, sugar, pasta
  | "canned_jarred_goods"
  | "frozen_foods"
  | "beverages_alcoholic"
  | "beverages_non_alcoholic"
  | "spices_seasonings"
  | "oils_vinegars_sauces"
  | "packaging_supplies" // To-go containers, napkins (if tracked as inventory)
  | "cleaning_supplies"  // If tracked
  | "other";
// Consider allowing custom categories: string;

export interface Ingredient {
  id: string;
  restaurantId: string;
  name: string;
  sku?: string; // Stock Keeping Unit
  barcode?: string; // UPC/EAN
  description?: string;
  category: IngredientCategory | string;
  subCategory?: string;

  // Stock Management
  currentStock: number; 
  baseUnitOfMeasureId: UnitOfMeasure['id']; // "gram", "milliliter"
  reorderPoint?: number; 
  idealParLevel?: number; 
  lastStocktakeDate?: Date;
  lastStocktakeQuantity?: number; 

  // Costing
  averageCostPerBaseUnit?: number; 
  lastPurchasePricePerBaseUnit?: number; 
  standardCostPerBaseUnit?: number; 

  // Purchase & Vendor
  defaultVendorId?: Vendor['id'];
  purchaseUnitOfMeasureId?: UnitOfMeasure['id']; // "kilogram", "case"
  purchaseUnitToBaseUnitConversionFactor?: number; // e.g., 1000 if purchase in KG, base in Grams
  defaultPurchaseQuantity?: number;

  // Other Attributes
  shelfLifeDays?: number; 
  storageInstructions?: string; // "Refrigerate", "Keep Dry"
  isPerishable: boolean;
  isTaxable?: boolean; 
  isActive: boolean; 
  notes?: string;
  imageUrl?: string;
  tags?: string[];

  createdByUserId: User['id'];
  createdAt: Date;
  updatedAt: Date;
  updatedByUserId?: User['id'];
}

export interface IngredientBatch {
  id: string;
  ingredientId: Ingredient['id'];
  locationId: Location['id'];
  batchNumber?: string; 
  quantityReceived: number; 
  currentQuantity: number; 
  costPerBaseUnit: number; // Cost for this specific batch (cents/decimal)
  receivedDate: Date;
  expiryDate?: Date;
  purchaseOrderItemId?: string; // Link to the PO item if received via PO
  notes?: string;
  createdAt: Date;
}

export type InventoryTransactionType =
  | "stock_in_purchase" // Received from vendor via PO
  | "stock_in_transfer" // Transferred from another location
  | "stock_in_adjustment_positive" // Manual positive adjustment
  | "stock_out_sale" // Used in a sold menu item (via recipe)
  | "stock_out_wastage" // Spoiled, expired, damaged
  | "stock_out_transfer" // Transferred to another location
  | "stock_out_adjustment_negative" // Manual negative adjustment
  | "stock_out_internal_use" // e.g., staff meals, samples
  | "stock_take_variance_positive" // Found more than expected during stock take
  | "stock_take_variance_negative"; // Found less than expected

export interface WastageReason {
  id: string;
  restaurantId: string;
  reasonText: string; // "Expired", "Spoiled", "Damaged in Storage", "Cooking Error", "Dropped"
  description?: string;
  isSystemDefined: boolean;
  isActive: boolean;
}

export interface InventoryTransaction {
  id: string;
  restaurantId: string;
  locationId: Location['id']; 
  ingredientId: Ingredient['id'];
  ingredientBatchId?: IngredientBatch['id'];
  transactionType: InventoryTransactionType;
  quantityChange: number; 
  stockBefore: number; 
  stockAfter: number;
  costPerBaseUnitAtTransaction?: number; 
  totalValueChange?: number; 
  transactionDate: Date;
  orderId?: Order['id']; 
  menuItemId?: MenuItem['id']; 
  purchaseOrderId?: string; 
  stockTakeId?: StockTake['id'];
  wastageReasonId?: WastageReason['id']; 
  notes?: string;
  reference?: string; // Transfer Slip #, Adjustment Memo #
  createdByUserId: User['id'];
  createdAt: Date;
}

export interface AutoReorderSetting {
  id: string; // Or use ingredientId as primary key if one-to-one
  restaurantId: string;
  ingredientId: Ingredient['id'];
  locationId: Location['id']; // Reorder settings can be location-specific
  isEnabled: boolean;
  reorderPoint: number; 
  reorderQuantity: number; // Quantity to reorder
  preferredVendorId?: Vendor['id'];
  notificationEmails?: string[];
  autoCreatePurchaseOrder?: boolean;
  updatedAt: Date;
  updatedByUserId?: User['id'];
}

export interface InventoryAlert {
  id: string;
  restaurantId: string;
  locationId: Location['id'];
  ingredientId: Ingredient['id'];
  ingredientBatchId?: IngredientBatch['id']; // If alert is for a specific batch (e.g., expiring soon)
  type:
    | "low_stock" // Reached reorder point
    | "out_of_stock"
    | "expiring_soon" // Batch specific
    | "expired" // Batch specific
    | "over_stock"; 
  message: string;
  severity?: "info" | "warning" | "critical";
  isAcknowledged: boolean;
  acknowledgedByUserId?: User['id'];
  acknowledgedAt?: Date;
  isResolved: boolean;
  resolvedByUserId?: User['id'];
  resolvedAt?: Date;
  resolutionNotes?: string;
  createdAt: Date;
}

export interface InventoryForecast {
  id: string;
  restaurantId: string;
  locationId: Location['id'];
  ingredientId: Ingredient['id'];
  forecastForDate: Date;
  projectedUsage: number; 
  confidenceLevel?: number; // 0-1
  daysOfStockRemaining?: number; // Based on current stock and projected usage
  suggestedReorderDate?: Date;
  generatedAt: Date;
}