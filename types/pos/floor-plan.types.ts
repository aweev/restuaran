// types/pos/floor-plan.types.ts
import { Table } from './table-management.types'; // The core Table definition
import { Location } from './multi-location.types';
import { User } from './auth.types';

export interface FloorPlanElement {
  id: string;
  type: "wall" | "door" | "window" | "bar_counter" | "pillar" | "stairs" | "decoration" | "label" | "restroom" | "kitchen_area";
  // Position and dimensions will vary based on how you render the floor plan
  // Example for a simple 2D canvas:
  startX: number;
  startY: number;
  endX?: number; // For lines like walls
  endY?: number; // For lines like walls
  width?: number; // For shapes like pillars, decorations
  height?: number; // For shapes like pillars, decorations
  radius?: number; // For circles
  points?: { x: number, y: number }[]; // For polygons
  rotation?: number; // Degrees
  label?: string; // For 'label' type or to name elements
  color?: string;
  fillColor?: string;
  strokeWidth?: number;
  metadata?: Record<string, unknown>;
}

export interface FloorPlan {
  id: string;
  restaurantId: string;
  locationId: Location['id'];
  name: string; // e.g., "Main Dining Room", "Patio", "Upstairs Bar"
  description?: string;
  backgroundImageUrl?: string; // Optional background image for the floor plan editor
  canvasWidth: number; // Width of the design canvas
  canvasHeight: number; // Height of the design canvas
  gridSize?: number; // Optional grid size for snapping elements
  tables: {
    tableId: Table['id'];
    // Position and visual properties defined on the FloorPlan,
    // overriding or supplementing Table's base `position` if it exists.
    x: number; // Position on the floor plan canvas
    y: number;
    width?: number; // Optional, if tables have visual dimensions on plan
    height?: number; // Optional
    rotation?: number; // Degrees
    shape?: Table['shape']; // Could be stored here if it's layout-specific
    labelOverride?: string; // e.g., if table '101' is labeled 'VIP Booth' on this plan
  }[];
  elements?: FloorPlanElement[]; // Non-table elements like walls, doors, etc.
  isActive: boolean; // Whether this floor plan is currently in use
  defaultZoomLevel?: number;
  defaultPanPosition?: { x: number, y: number };
  createdByUserId: User['id'];
  createdAt: Date;
  updatedAt: Date;
  updatedByUserId?: User['id'];
}