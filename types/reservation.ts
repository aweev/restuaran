export type ReservationStatus =
  | "pending"
  | "confirmed"
  | "seated"
  | "completed"
  | "cancelled"
  | "no_show"
  | "cancelled_by_customer"
  | "cancelled_by_restaurant"
  | string;

export interface Reservation {
  id: string;
  customerName: string;
  phone: string;
  email: string;
  partySize: number;
  tableId: string;
  date: string;
  time: string;
  status: ReservationStatus;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface UpdateReservationDTO {
  id: string;
  status?: ReservationStatus;
  tableId?: string;
  date?: string;
  time?: string;
  partySize?: number;
  notes?: string;
}

export * from "./pos/reservations.types";
