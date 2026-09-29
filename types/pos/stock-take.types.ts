// types/pos/stock-take.types.ts
import { User } from './auth.types';
import { Location } from './multi-location.types';
import { Ingredient } from './inventory.types';
import { UnitOfMeasure } from './units-of-measure.types'; // Assumed
import { InventoryTransaction } from './inventory.types'; // For generated adjustment transactions

export interface StockTakeItem {
  id: string;
  ingredientId: Ingredient['id'];
  ingredientNameSnapshot: Ingredient['name']; // Denormalized
  baseUnitOfMeasureIdSnapshot: UnitOfMeasure['id']; // Denormalized
  baseUnitOfMeasureNameSnapshot: string; // Denormalized (e.g., "gram")

  // Stock levels are in the ingredient's base unit of measure
  systemStockOnHand: number; // Expected quantity from system before count
  countedQuantity: number; // Actual physical count
  varianceQuantity: number; // countedQuantity - systemStockOnHand
  variancePercentage?: number; // (varianceQuantity / systemStockOnHand) * 100 (if systemStockOnHand > 0)

  costPerBaseUnitAtCountTime: number; // Cost of the ingredient at the time of stock take (cents/decimal)
  varianceValue: number; // varianceQuantity * costPerBaseUnitAtCountTime (cents/decimal)

  notes?: string; // For specific item discrepancies
  batchDetails?: { // If counting specific batches
    batchId: string; // IngredientBatch['id']
    countedQuantityForBatch: number;
  }[];
  isReconciled?: boolean; // If variance for this item has been addressed
}

export interface StockTake {
  id: string;
  restaurantId: string;
  locationId: Location['id'];
  stockTakeNumber?: string; // User-friendly identifier
  title?: string; // e.g., "End of Month Full Count", "Weekly Produce Count"
  status:
    | "draft_pending_count" // Created, items listed, but counting not started/completed
    | "in_progress_counting"
    | "pending_review_approval" // Counts entered, awaiting manager review
    | "pending_reconciliation" // Approved, but variances need to be processed
    | "completed_reconciled" // All variances processed, inventory updated
    | "cancelled";
  scheduledDate?: Date; // If planned in advance
  startedAt?: Date;
  completedAt?: Date; // When counting was finished
  reconciledAt?: Date; // When inventory adjustments were posted
  countedByUserId?: User['id'][]; // Can be multiple staff involved
  approvedByUserId?: User['id'];
  reconciledByUserId?: User['id'];
  items: StockTakeItem[];
  // Summary values (calculated)
  totalSystemValue?: number; // Expected total value of stock (cents/decimal)
  totalCountedValue?: number; // Actual total value of counted stock (cents/decimal)
  totalVarianceValue?: number; // (cents/decimal)
  notes?: string; // General notes for the stock take
  generatedInventoryTransactionIds?: InventoryTransaction['id'][]; // IDs of transactions created to adjust stock
  attachmentUrls?: string[]; // e.g., photos of count sheets
  createdAt: Date;
  updatedAt: Date;
}