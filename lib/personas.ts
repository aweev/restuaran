import type { UserRole } from "@/types/auth";
import {
  LayoutDashboard, ShoppingCart, CookingPot, ConciergeBell, CalendarCheck,
  Package, BarChart3, Users, Settings, UtensilsCrossed, QrCode, Wallet,
  type LucideIcon,
} from "lucide-react";

export interface Persona {
  role: UserRole;
  title: string;
  tagline: string;
  /** Goal templates (static guidance), not live counts — live state comes from SignalDashboard. */
  goals: string[];
  homeHref: string;
  quickActions: { label: string; href: string; icon: string; hint?: string; shortcut?: string }[];
  alerts: string[];
}

// Alerts are computed live by SignalDashboard from kernel projections —
// no hardcoded counts here (they rendered fake "3 tables waiting" copy).
const BASE_ALERTS: Record<"admin" | "manager" | "staff" | "kitchen" | "waiter", string[]> = {
  admin: [],
  manager: [],
  staff: [],
  kitchen: [],
  waiter: [],
};

// Server-section scoping: a server owns a named floor section (zone) plus
// their assigned tables. PERSONAS goals below are templates, not live data.
export type ServerSection = { id: string; label: string };
export const SECTIONS: ServerSection[] = [
  { id: "main", label: "Main room" },
  { id: "terrace", label: "Terrace" },
  { id: "bar", label: "Bar" },
];

export const PERSONAS: Record<UserRole, Persona> = {
  admin: {
    role: "admin", title: "Owner / Admin", tagline: "Full control of sales, team and settings.",
    goals: ["Today's revenue at a glance", "Unblock staff quickly", "Keep menu & inventory healthy"],
    homeHref: "/dashboard",
    quickActions: [
      { label: "New order", href: "/dashboard/orders/new", icon: "cart", hint: "Start a sale", shortcut: "N" },
      { label: "Floor plan", href: "/dashboard/tables/management", icon: "tables", hint: "Tables & floor" },
      { label: "Reports", href: "/dashboard/reports", icon: "reports", hint: "Close the day" },
      { label: "Staff", href: "/dashboard/staff", icon: "staff", hint: "Shifts & roles" },
    ],
    alerts: BASE_ALERTS.admin,
  },
  manager: {
    role: "manager", title: "Floor Manager", tagline: "Keep service flowing and tables turning.",
    goals: ["See live orders & tables", "Reassign staff", "Handle comps & voids"],
    homeHref: "/dashboard",
    quickActions: [
      { label: "New order", href: "/dashboard/orders/new", icon: "cart", shortcut: "N" },
      { label: "Tables", href: "/dashboard/tables", icon: "tables", hint: "Seat & transfer" },
      { label: "Kitchen", href: "/dashboard/kitchen", icon: "kitchen", hint: "Expedite" },
      { label: "Reservations", href: "/dashboard/reservations", icon: "calendar", hint: "Tonight's book" },
    ],
    alerts: BASE_ALERTS.manager,
  },
  owner: {
    role: "owner", title: "Owner", tagline: "Full control of the venue and all settings.",
    goals: ["Today's revenue at a glance", "Unblock staff quickly", "Keep menu & inventory healthy"],
    homeHref: "/dashboard",
    quickActions: [
      { label: "New order", href: "/dashboard/orders/new", icon: "cart", hint: "Start a sale", shortcut: "N" },
      { label: "Floor plan", href: "/dashboard/tables/management", icon: "tables", hint: "Tables & floor" },
      { label: "Reports", href: "/dashboard/reports", icon: "reports", hint: "Close the day" },
      { label: "Staff", href: "/dashboard/staff", icon: "staff", hint: "Shifts & roles" },
    ],
    alerts: BASE_ALERTS.admin,
  },
  server: {
    role: "server", title: "Server", tagline: "Your section, your tempo.",
    goals: ["My tables & tickets", "Fire to kitchen", "Track ready dishes"],
    homeHref: "/dashboard/tables",
    quickActions: [
      { label: "My tables", href: "/dashboard/tables", icon: "tables", shortcut: "T" },
      { label: "New order", href: "/dashboard/orders/new", icon: "cart", shortcut: "N" },
      { label: "Kitchen", href: "/dashboard/kitchen", icon: "kitchen", hint: "Ready picks" },
      { label: "Reservations", href: "/dashboard/reservations", icon: "calendar" },
    ],
    alerts: BASE_ALERTS.waiter,
  },
  waiter: {
    role: "waiter", title: "Server", tagline: "Your section, your tempo.",
    goals: ["My tables & tickets", "Fire to kitchen", "Track ready dishes"],
    homeHref: "/dashboard/tables",
    quickActions: [
      { label: "My tables", href: "/dashboard/tables", icon: "tables", shortcut: "T" },
      { label: "New order", href: "/dashboard/orders/new", icon: "cart", shortcut: "N" },
      { label: "Kitchen", href: "/dashboard/kitchen", icon: "kitchen", hint: "Ready picks" },
      { label: "Reservations", href: "/dashboard/reservations", icon: "calendar" },
    ],
    alerts: BASE_ALERTS.waiter,
  },
  host: {
    role: "host", title: "Host", tagline: "Seating, reservations, and the waitlist.",
    goals: ["Seat walk-ins", "Manage the queue", "Assign reservations"],
    homeHref: "/dashboard/reservations",
    quickActions: [
      { label: "Reservations", href: "/dashboard/reservations", icon: "calendar", hint: "Tonight's book", shortcut: "G R" },
      { label: "Waitlist", href: "/dashboard/waitlist", icon: "bell", hint: "Seating queue" },
      { label: "Tables", href: "/dashboard/tables", icon: "tables", hint: "Floor status" },
      { label: "Customers", href: "/dashboard/customers", icon: "users", hint: "Guests" },
    ],
    alerts: [],
  },
  "host_staff": {
    role: "host_staff", title: "Host Staff", tagline: "Support the host stand.",
    goals: ["View the queue", "Update reservations"],
    homeHref: "/dashboard/reservations",
    quickActions: [
      { label: "Reservations", href: "/dashboard/reservations", icon: "calendar" },
      { label: "Waitlist", href: "/dashboard/waitlist", icon: "bell" },
    ],
    alerts: [],
  },
  cashier: {
    role: "cashier", title: "Cashier", tagline: "Checkout and payment processing.",
    goals: ["Take orders fast", "Process payments", "Handle refunds"],
    homeHref: "/dashboard/orders/new",
    quickActions: [
      { label: "New order", href: "/dashboard/orders/new", icon: "cart", shortcut: "N" },
      { label: "Orders", href: "/dashboard/orders", icon: "orders", hint: "Active tickets" },
      { label: "Tables", href: "/dashboard/tables", icon: "tables" },
      { label: "Menu", href: "/dashboard/menu", icon: "menu" },
    ],
    alerts: [],
  },
  bartender: {
    role: "bartender", title: "Bartender", tagline: "Bar service and quick orders.",
    goals: ["Take drink orders", "Process bar payments", "86 tracking"],
    homeHref: "/dashboard/orders/new",
    quickActions: [
      { label: "New order", href: "/dashboard/orders/new", icon: "cart", shortcut: "N" },
      { label: "Menu", href: "/dashboard/menu", icon: "menu" },
      { label: "Inventory", href: "/dashboard/inventory", icon: "inventory" },
    ],
    alerts: [],
  },
  delivery: {
    role: "delivery", title: "Delivery", tagline: "Delivery order lifecycle.",
    goals: ["View delivery orders", "Update fulfillment status"],
    homeHref: "/dashboard/orders",
    quickActions: [
      { label: "Orders", href: "/dashboard/orders", icon: "orders", hint: "Delivery queue" },
      { label: "Menu", href: "/dashboard/menu", icon: "menu" },
    ],
    alerts: [],
  },
  staff: {
    role: "staff", title: "Cashier", tagline: "Fast, accurate checkout every time.",
    goals: ["Take orders fast", "Take payment", "Print receipts"],
    homeHref: "/dashboard/orders/new",
    quickActions: [
      { label: "New order", href: "/dashboard/orders/new", icon: "cart", shortcut: "N" },
      { label: "Orders", href: "/dashboard/orders", icon: "orders", hint: "Active tickets" },
      { label: "Tables", href: "/dashboard/tables", icon: "tables" },
      { label: "Menu", href: "/dashboard/menu", icon: "menu" },
    ],
    alerts: BASE_ALERTS.staff,
  },
  kitchen: {
    role: "kitchen", title: "Kitchen", tagline: "Fire, expedite, repeat — distraction-free.",
    goals: ["See queue by urgency", "Bump completed", "Flag 86'd items"],
    homeHref: "/dashboard/kitchen/display",
    quickActions: [
      { label: "KDS board", href: "/dashboard/kitchen/display", icon: "kitchen", shortcut: "K" },
      { label: "Queue", href: "/dashboard/kitchen", icon: "orders" },
      { label: "Inventory", href: "/dashboard/inventory", icon: "inventory", hint: "86 list" },
      { label: "Menu", href: "/dashboard/menu", icon: "menu" },
    ],
    alerts: BASE_ALERTS.kitchen,
  },
};

export function personaFor(role?: string | null): Persona {
  if (role && role in PERSONAS) return PERSONAS[role as UserRole];
  return PERSONAS.staff;
}

export const NAV_META: Record<string, { title: string; href: string; icon: LucideIcon; permission?: string; kbd?: string }> = {
  dashboard: { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard, kbd: "G D" },
  orders: { title: "Orders", href: "/dashboard/orders", icon: ShoppingCart, permission: "order:view", kbd: "G O" },
  newOrder: { title: "New order", href: "/dashboard/orders/new", icon: ShoppingCart, permission: "order:create" },
  menu: { title: "Menu", href: "/dashboard/menu", icon: UtensilsCrossed, permission: "menu:view", kbd: "G M" },
  tables: { title: "Tables", href: "/dashboard/tables", icon: ConciergeBell, permission: "table:view", kbd: "G T" },
  floor: { title: "Floor plan", href: "/dashboard/tables/management", icon: QrCode, permission: "table:view" },
  reservations: { title: "Reservations", href: "/dashboard/reservations", icon: CalendarCheck, permission: "reservation:view", kbd: "G R" },
  waitlist: { title: "Waitlist", href: "/dashboard/waitlist", icon: ConciergeBell, permission: "waitlist:view", kbd: "G W" },
  kitchen: { title: "Kitchen", href: "/dashboard/kitchen", icon: CookingPot, permission: "order:view", kbd: "G K" },
  kds: { title: "KDS display", href: "/dashboard/kitchen/display", icon: CookingPot, permission: "order:view" },
  inventory: { title: "Inventory", href: "/dashboard/inventory", icon: Package, permission: "inventory:view", kbd: "G I" },
  giftCards: { title: "Gift Cards", href: "/dashboard/gift-cards", icon: Wallet, permission: "giftcard:view" },
  multiVenue: { title: "Multi-Venue", href: "/dashboard/multi-venue", icon: LayoutDashboard, permission: "venue:view" },
  reports: { title: "Reports", href: "/dashboard/reports", icon: Wallet, permission: "report:view" },
  analytics: { title: "Analytics", href: "/dashboard/analytics", icon: BarChart3, permission: "report:view" },
  staff: { title: "Staff", href: "/dashboard/staff", icon: Users, permission: "user:view" },
  cash: { title: "Cash drawer", href: "/dashboard/cash", icon: Wallet, permission: "order:pay" },
  zReport: { title: "Z-report", href: "/dashboard/reports/z-report", icon: BarChart3, permission: "report:view" },
  customers: { title: "Customers", href: "/dashboard/customers", icon: Users, permission: "customer:view" },
  settings: { title: "Settings", href: "/dashboard/settings", icon: Settings, permission: "settings:view", kbd: "G S" },
};

/**
 * RBAC check for nav: fail-closed. When permissions are unknown (null/undefined
 * or empty), the user sees NO privileged navigation. The previous open fallback
 * let unrecognized roles access every screen, which is a security regression.
 * Only nav items with no permission gate (e.g. user-facing landing pages)
 * return true for empty permission sets.
 */
export function canSeeNav(
  permissions: readonly string[] | undefined | null,
  key: string,
): boolean {
  const meta = NAV_META[key];
  if (!meta?.permission) return true;
  if (!permissions || permissions.length === 0) return false;
  return permissions.includes(meta.permission);
}
