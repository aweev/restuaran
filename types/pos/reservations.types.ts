// types/pos/reservations.types.ts
import { Table } from './table-management.types';
import { Customer } from './customer.types';
import { User } from './auth.types';
import { Location } from './multi-location.types';
import { DiningMode } from './cart.types'; // For linking pre-orders
import { Order } from './order.types'; // For pre-orders

export type ReservationStatus =
  | "pending_confirmation" // Needs staff approval
  | "confirmed"
  | "tentative_hold" // Temporarily held, awaiting confirmation
  | "waitlisted" // If no tables available, moved to waitlist
  | "checked_in_arrived" // Customer has arrived
  | "seated"
  | "partially_seated" // Some of the party has been seated
  | "no_show"
  | "cancelled_by_customer"
  | "cancelled_by_restaurant"
  | "completed_dined" // Finished their meal
  | "walk_in_seated"; // For tracking walk-ins using reservation system

export type ReservationSource =
  | "phone_call"
  | "in_person_walk_in"
  | "pos_staff_entry"
  | "restaurant_website"
  | "online_booking_platform" // e.g., from your PlatformReservation
  | "email_request";

export interface Reservation {
  id: string;
  restaurantId: string;
  locationId: Location['id'];
  reservationNumber?: string; // User-friendly reservation ID
  source: ReservationSource;
  externalReservationId?: string; // If synced from an external platform (e.g., PlatformReservation['id'])

  customerId?: Customer['id']; // Link to known POS customer
  customerFirstName: string;
  customerLastName: string;
  customerPhoneNumber?: string;
  customerEmail?: string;

  partySize: number;
  numberOfAdults?: number;
  numberOfChildren?: number;

  reservationDateTime: Date; // Requested date and time
  estimatedDurationMinutes?: number; // How long they expect to stay
  expectedArrivalTime?: Date; // If different from reservationDateTime (e.g., grace period)

  status: ReservationStatus;
  statusHistory?: {
    status: ReservationStatus;
    timestamp: Date;
    changedByUserId?: User['id'];
    notes?: string;
  }[];

  assignedTableIds?: Table['id'][]; // Can be one or more tables if large party
  tablePreferences?: string; // e.g., "window", "booth", "quiet area"
  seatingAreaPreference?: string; // e.g., "Patio", "Main Dining" (links to FloorPlan name)

  specialRequests?: string; // e.g., "High chair needed", "Birthday celebration"
  internalNotes?: string; // For staff, e.g., "VIP customer", "Regular"
  tags?: string[]; // e.g., "VIP", "Anniversary", "RequiresAccessibility"

  // Pre-order details (if system supports it)
  preOrderId?: Order['id']; // Link to a pre-placed order
  diningMode?: DiningMode; // e.g., "dine_in", "takeaway", "delivery"

  // Communication with customer
  confirmationSentAt?: Date;
  reminderSentAt?: Date;
  // waitlistEntryId?: string; // If this reservation originated from a waitlist entry

  // Check-in & Seating
  checkedInAt?: Date;
  checkedInByUserId?: User['id'];
  seatedAt?: Date;
  seatedByUserId?: User['id'];

  // System Fields
  createdByUserId: User['id']; // Staff who took/entered the reservation
  createdAt: Date; // When the reservation was made
  updatedAt: Date;
  updatedByUserId?: User['id'];
}

export interface UpdateReservationDTO {
  id: Reservation['id'];
  status?: ReservationStatus;
  assignedTableIds?: Table['id'][];
  reservationDateTime?: Date;
  partySize?: number;
  specialRequests?: string;
}

export interface ReservationEvent {
  type: "RESERVATION_CREATED" | "RESERVATION_UPDATED" | "RESERVATION_DELETED" | "RESERVATION_STATUS_CHANGED";
  restaurantId: string;
  locationId: string;
  payload: Reservation | { reservationId: string; updates: Partial<Reservation>; changedByUserId?: string };
}