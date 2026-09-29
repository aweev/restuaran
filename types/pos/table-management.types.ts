// types/pos/table-management.types.ts

import { Location } from './multi-location.types';
import { User } from './auth.types';
import { Order } from './order.types';
// import { Customer } from './customer.types'; // For customer name on table
import { FloorPlan } from './floor-plan.types'; // For linking to a floor plan

// Types from your original Table section
export type TableType = "indoor" | "outdoor" | "private_room" | "bar_seating" | "booth" | "communal" | "counter" | string;
export type TableShape = "rectangle" | "square" | "round" | "oval" | "custom_polygon" | string;

export type TableStatus =
  | "available"
  | "occupied_serving" // Customers are seated and being served
  | "occupied_needs_attention" // e.g., server call, payment requested
  | "reserved"
  | "cleaning_dirty" // Needs cleaning
  | "out_of_service" // Temporarily unavailable (e.g., broken)
  | "blocked_unavailable"; // Intentionally not in use

export interface Table {
  id: string;
  restaurantId: string;
  locationId: Location['id'];
  floorPlanId?: FloorPlan['id']; // Which floor plan this table primarily belongs to for default view
  tableNumber: string; // User-friendly identifier (e.g., "1A", "P2", "Bar Seat 5")
  displayName?: string; // e.g., "Window Booth", "Chef's Table"
  capacityMin: number; // Minimum number of guests
  capacityMax: number; // Maximum number of guests
  type?: TableType;
  shape?: TableShape;
  // Other physical attributes if needed for inventory or detailed planning:
  size?: "small" | "medium" | "large";
  dimensions?: { width: number; height: number; unit: "cm" | "inch" };
  material?: string;
  color?: string;

  // Status & Occupancy (This is the dynamic state)
  status: TableStatus;
  currentOrderId?: Order['id']; // If occupied, the active order ID
  currentGuestCount?: number;
  currentSeatedAt?: Date; // Time when current party was seated
  currentServerUserId?: User['id']; // Server assigned to this table currently
  customerNameOnTable?: string; // Name of primary guest (if known)

  defaultPosition?: { x: number; y: number };

  isCombinable: boolean; // Can this table be combined with others?
  combinableWithTableIds?: Table['id'][]; // Which tables it can combine with
  combinedStatus?: { // If currently part of a combined table group
    isCombined: boolean;
    combinedGroupId: string; // An ID for the temporary group
    parentTableId?: Table['id']; // If one table acts as the "master" for the group
  };

  notes?: string; // e.g., "Wobbly leg", "Near restroom"
  isActive: boolean; // Is this table currently in service inventory?
  createdAt: Date;
  updatedAt: Date;
}

export interface TableManagementUIState {
  tables: Table[]; // All tables or those for a selected floor plan
  isLoading: boolean;
  error: string | null;
  selectedTableId?: Table['id'] | null;
  selectedFloorPlanId?: FloorPlan['id'] | null;
  filterByStatus?: TableStatus;
  searchTerm?: string; // For table number or name
}

// TableEvent for sockets was good, ensure TableStatus is the updated one.
export interface TableEvent {
  type: "table_status_update";
  data: TableStatus; // This should probably be the full Table object or {tableId, newStatus, ...}
}
export interface TableStatusUpdateEvent {
  type: "TABLE_STATUS_UPDATED";
  restaurantId: string;
  locationId: string;
  payload: {
    tableId: Table['id'];
    newStatus: TableStatus;
    currentOrderId?: Order['id'];
    currentGuestCount?: number;
    currentSeatedAt?: Date;
    currentServerUserId?: User['id'];
    // other relevant fields that change with status
  };
}