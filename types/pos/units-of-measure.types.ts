// types/pos/units-of-measure.types.ts
import { User } from './auth.types';

export type UnitOfMeasureType =
  | "weight" // e.g., gram, kilogram, pound, ounce
  | "volume" // e.g., milliliter, liter, fluid ounce, cup, gallon
  | "length" // e.g., centimeter, meter, inch, foot
  | "area"   // e.g., square meter, square foot
  | "count"  // e.g., piece, each, dozen, case
  | "time"   // e.g., second, minute, hour (less common for inventory, but possible)
  | "custom"; // For non-standard units

export interface UnitOfMeasure {
  id: string;
  restaurantId: string; // Or global if UoMs are shared across restaurants in a multi-tenant system
  name: string; // e.g., "Gram", "Kilogram", "Milliliter", "Piece", "Case (24)"
  abbreviation: string; // e.g., "g", "kg", "ml", "pcs", "cs"
  type: UnitOfMeasureType;
  isSystemDefined: boolean; // If it's a standard UoM or user-defined
  decimalPlaces?: number; // How many decimal places are typically used for this unit (e.g., 0 for "Piece", 3 for "Kilogram")
  isActive: boolean;
  // For 'count' types that represent a package of a base unit
  baseUnitEquivalent?: {
    baseUnitId: UnitOfMeasure['id']; // e.g., if 'Case (24)' refers to 'Piece'
    quantity: number; // e.g., 24
  };
  createdAt: Date;
  updatedAt: Date;
  createdByUserId?: User['id']; // If user-defined
  updatedByUserId?: User['id'];
}

export interface UnitOfMeasureConversion {
  id: string;
  restaurantId: string;
  fromUnitId: UnitOfMeasure['id'];
  toUnitId: UnitOfMeasure['id']; // Target unit (often the system's base unit for that UoM type)
  conversionFactor: number; // Multiply quantity in 'fromUnit' by this factor to get quantity in 'toUnit'
                           // e.g., From: Kilogram, To: Gram, Factor: 1000
                           // e.g., From: Gram, To: Kilogram, Factor: 0.001
  description?: string; // e.g., "1 kg = 1000 g"
  isSystemDefined?: boolean;
  createdAt: Date;
  updatedAt: Date;
}