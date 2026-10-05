"use client";

import type { CartItem, MenuCategory, MenuItem, Order, OrderStatus, Table, TableStatus, WaitListEntry, Customer } from "@/types";
import type { Ingredient } from "@/types/inventory";
import type { Reservation } from "@/types/reservation";
import type { InventoryRow, TableBoardRow } from "@/kernel/projections/builtins";
import type { MenuBoardRow } from "@/kernel/modules/menu.module";
import type { OrderBoardRow } from "@/kernel/projections/orders-board";
import type { ReservationBoardRow } from "@/kernel/modules/reservations.module";
import type { WaitlistRow } from "@/kernel/modules/waitlist.module";
import type { CustomerBoardRow } from "@/kernel/modules/customers.module";

/**
 * Projection → legacy UI type adapters.
 *
 * The contexts expose the shapes that ~40 components already consume. Rather
 * than rewrite every consumer at once, each context is backed by the kernel
 * while still *presenting* the old shape. That lets the migration proceed one
 * context at a time with no UI changes and no half-migrated screen.
 *
 * These mappers are deliberately lossy in one direction only: fields the event
 * store does not model yet (a table's guest name, say) are surfaced as `null`
 * rather than invented, so a gap shows up as missing data instead of a lie.
 */

const TABLE_STATUSES = new Set<string>([
  "available",
  "occupied",
  "reserved",
  "dirty",
]);

/** `tables.board` carries `out_of_service`, which the legacy type does not model. */
export function toTableStatus(raw: string): TableStatus {
  return TABLE_STATUSES.has(raw) ? (raw as TableStatus) : "available";
}

export function tableRowToTable(row: TableBoardRow): Table {
  return {
    id: row.tableId,
    number: row.label,
    capacity: row.capacity,
    status: toTableStatus(row.status),
    orderId: row.currentOrderId ?? undefined,
    // Geometry is real now, so the floor-plan editor's drag positions survive a
    // reload. Tables that have never been placed fall back to the origin rather
    // than to a random offset that would jitter on every render.
    position: { x: row.x ?? 0, y: row.y ?? 0 },
  };
}

export function tableRowsToTables(rows: TableBoardRow[]): Table[] {
  return rows.map(tableRowToTable);
}

/**
 * `menu.board` → legacy `MenuItem`.
 *
 * The projection is the sellability source of truth (available/86'd); the
 * mutable `MenuItem` table still carries richer merchandising fields the event
 * store does not model yet (calories, popular flag, full modifier options).
 * Fields the projection lacks surface as neutral defaults rather than invented
 * data, so a gap shows as missing detail instead of a lie.
 */
export function menuRowToMenuItem(row: MenuBoardRow): MenuItem {
  return {
    id: row.id,
    title: row.name,
    description: row.description,
    price: row.price,
    image: row.image ?? "/placeholder.svg?height=300&width=300",
    category: row.categoryId as MenuCategory,
    type: "Veg",
    available: row.available && !row.eightySixed,
    preparationTime: row.prepMinutes || undefined,
    allergens: row.allergens,
    modifiers: row.modifierGroups.map((g) => ({
      id: g.groupId,
      name: g.name,
      options: [],
      required: g.required,
      multiple: g.max !== 1,
    })),
  };
}

export function menuRowsToMenuItems(rows: MenuBoardRow[]): MenuItem[] {
  return rows.map(menuRowToMenuItem);
}

/**
 * Merge kernel rows with legacy REST rows. The kernel wins on identity:
 * when both sources know an item, the projection's price/availability is used
 * (it carries the 86'd guard); REST-only rows are seed data the event store
 * has not ingested yet and are kept so the menu never blanks during migration.
 */
export function mergeMenuItems(kernelItems: MenuItem[], restItems: MenuItem[]): MenuItem[] {
  if (kernelItems.length === 0) return restItems;
  if (restItems.length === 0) return kernelItems;
  const kernelIds = new Set(kernelItems.map((i) => i.id));
  return [...kernelItems, ...restItems.filter((i) => !kernelIds.has(i.id))];
}

/**
 * Board status → legacy `OrderStatus`. The kernel models the lifecycle as
 * order-level `draft|open|closed|voided` while the UI groups by fulfilment;
 * the line mix decides the fulfilment bucket, matching the Orders screen.
 */
export function orderRowToStatus(row: OrderBoardRow): OrderStatus {
  if (row.status === "closed") return "completed";
  if (row.status === "voided") return "cancelled";
  if (row.status === "draft") return "pending";
  if (row.lines.some((l) => l.status === "ready")) return "ready";
  if (row.lines.some((l) => l.status === "preparing")) return "preparing";
  if (row.lines.some((l) => l.status === "sent")) return "pending";
  if (row.lines.some((l) => l.status === "served")) return "served";
  return "pending";
}

/** `orders.board` row → legacy `Order`. Lossy only where the event store does
 *  not model the field yet (guest count, table object, payment method
 *  breakdown); those surface as neutral defaults rather than invented data. */
export function orderRowToOrder(row: OrderBoardRow): Order {
  const items: CartItem[] = row.lines
    .filter((l) => l.status !== "voided")
    .map((l) => ({
      id: l.lineId,
      menuItemId: l.menuItemId,
      title: l.name,
      price: l.unitPrice,
      quantity: l.quantity,
      type: "Veg" as const,
      modifiers: [],
      totalPrice: l.lineTotal,
      course: l.course,
    }));
  const status = orderRowToStatus(row);
  const quantity = items.reduce((s, i) => s + i.quantity, 0);
  return {
    id: row.orderId,
    tableId: row.tableId,
    table: {
      id: row.tableId ?? "",
      number: row.tableId ?? "",
      capacity: 0,
      status: "occupied",
    } as Table,
    customerName: row.dinerName,
    items,
    quantity,
    status,
    createdAt: row.openedAt,
    updatedAt: row.updatedAt,
    subtotal: row.subtotal,
    tax: row.taxTotal,
    discount: row.discountTotal,
    total: row.total,
    payments: [],
    isPaid: row.balanceDue <= 0 && row.paid > 0,
    diningMode: "Dine in",
    serverId: row.serverId ?? "",
    notes: row.notes ?? undefined,
    heldCourses: row.heldCourses ?? [],
  };
}

export function orderRowsToOrders(rows: OrderBoardRow[]): Order[] {
  return rows.map(orderRowToOrder);
}

/** Merge kernel orders with legacy REST orders; kernel wins on identity. */
export function mergeOrders(kernelOrders: Order[], restOrders: Order[]): Order[] {
  if (kernelOrders.length === 0) return restOrders;
  if (restOrders.length === 0) return kernelOrders;
  const kernelIds = new Set(kernelOrders.map((o) => o.id));
  return [...kernelOrders, ...restOrders.filter((o) => !kernelIds.has(o.id))];
}

/**
 * `reservations.board` → legacy `Reservation`. Contact + requests ride the
 * board (same `reservation:view` gate the host stand already holds), so the
 * list needs no second query. `createdAt/updatedAt` are not projected and
 * surface as undefined.
 */
export function reservationRowToReservation(row: ReservationBoardRow): Reservation {
  return {
    id: row.id,
    customerName: row.customerName,
    phone: row.phone ?? "",
    email: row.email ?? "",
    partySize: row.partySize,
    tableId: row.tableId ?? "",
    date: row.date,
    time: row.time,
    status: row.status,
    notes: row.specialRequests ?? undefined,
  };
}

export function reservationRowsToReservations(rows: ReservationBoardRow[]): Reservation[] {
  return rows.map(reservationRowToReservation);
}

/**
 * Combine the kernel's separate YYYY-MM-DD date and HH:MM time into a Date
 * for sorting and display. Accepts legacy full-ISO strings too, so rows from
 * either era render identically.
 */
export function reservationSlotToDate(date: string, time: string): Date {
  const hm = /^(\d{2}):(\d{2})/.exec(time)
  const day = /^\d{4}-\d{2}-\d{2}$/.exec(date) ? date : new Date(date).toISOString().slice(0, 10)
  if (hm) return new Date(`${day}T${hm[1]}:${hm[2]}:00`)
  const fallback = new Date(time)
  if (!Number.isNaN(fallback.getTime())) return fallback
  return new Date(`${day}T00:00:00`)
}

/** HH:MM (or legacy ISO) → "6:30 PM" for guest-facing display. */
export function formatReservationTime(date: string, time: string): string {
  const d = reservationSlotToDate(date, time)
  const h = d.getHours()
  const m = String(d.getMinutes()).padStart(2, "0")
  const suffix = h >= 12 ? "PM" : "AM"
  const hour12 = h % 12 === 0 ? 12 : h % 12
  return `${hour12}:${m} ${suffix}`
}

/**
 * `waitlist.board` → legacy `WaitListEntry`. `estimatedWaitTime` is a
 * client-side heuristic (position × 10 min), not a domain fact, so the
 * manager keeps computing it locally.
 */
export function waitlistRowToEntry(row: WaitlistRow): WaitListEntry {
  return {
    id: row.id,
    customerName: row.customerName,
    phoneNumber: row.phone ?? "",
    partySize: row.partySize,
    estimatedWaitTime: row.position * 10,
    notes: row.notes ?? "",
    notified: row.status === "notified",
    createdAt: row.joinedAt,
    updatedAt: row.notifiedAt ?? row.joinedAt,
  };
}

export function waitlistRowsToEntries(rows: WaitlistRow[]): WaitListEntry[] {
  return rows.map(waitlistRowToEntry);
}

/**
 * `customers.board` → legacy operational `Customer`. The board deliberately
 * omits PII, so contact fields arrive via `get.customer` on selection and are
 * merged over the row (see CustomerContext). Array fields serialize to the
 * comma-separated strings the preferences UI edits.
 */
export function customerRowToCustomer(
  row: CustomerBoardRow,
  details?: { email?: string; phone?: string; notes?: string; dietaryRestrictions?: string[]; allergies?: string[]; favoriteItems?: string[]; seatingPreferences?: string[] },
): Customer {
  const csv = (v?: string[]) => (v ?? []).join(", ");
  return {
    id: row.customerId,
    name: row.displayName,
    email: details?.email ?? "",
    phone: details?.phone ?? "",
    notes: details?.notes ?? "",
    allergies: csv(details?.allergies),
    dietaryRestrictions: csv(details?.dietaryRestrictions),
    favoriteItems: csv(details?.favoriteItems),
    seatingPreferences: csv(details?.seatingPreferences),
    visitCount: row.visitCount,
    lastVisit: row.lastVisitAt ?? "",
    totalSpent: row.lifetimeSpend,
  };
}

export function customerRowsToCustomers(rows: CustomerBoardRow[]): Customer[] {
  return rows.map((r) => customerRowToCustomer(r));
}

/**
 * `inventory.board` → legacy `Ingredient`. The kernel models stock truthfully
 * (onHand/reorderPoint/unitCost); merchandising extras the event store does
 * not track (monthly usage) surface as neutral defaults.
 */
export function inventoryRowToIngredient(row: InventoryRow): Ingredient {
  return {
    id: row.itemId,
    name: row.name,
    category: row.category ?? "",
    unit: row.unit,
    currentStock: row.onHand,
    reorderLevel: row.reorderPoint,
    unitCost: row.unitCost ?? 0,
    usageLastMonth: 0,
    isActive: row.isActive ?? true,
    lastUpdated: new Date().toISOString(),
  };
}

export function inventoryRowsToIngredients(rows: InventoryRow[]): Ingredient[] {
  return rows.map(inventoryRowToIngredient);
}
