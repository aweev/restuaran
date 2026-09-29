// types/pos/device.types.ts
import { User } from './auth.types';
import { Location } from './multi-location.types';

export type DeviceType =
  | "fixed_pos_terminal" // Traditional POS station
  | "handheld_pos" // Mobile POS for servers
  | "kds" // Kitchen Display System
  | "customer_facing_display" // CFD attached to POS
  | "self_service_kiosk"
  | "payment_terminal" // Standalone card reader (e.g., Verifone, Ingenico)
  | "receipt_printer" // If managed as a 'device' separate from PrinterConfiguration
  | "label_printer"; // For inventory or order labels

export type DeviceStatus =
  | "online"
  | "offline"
  | "in_use"
  | "idle"
  | "needs_attention" // e.g., low paper for printer, error state
  | "maintenance_mode"
  | "decommissioned";

export type DeviceConnectionType = "ethernet" | "wifi" | "bluetooth" | "usb" | "serial";

//Represents a physical or logical device used by the POS system.
export interface Device {
  id: string;
  restaurantId: string;
  locationId: Location['id']; // The location where the device is physically present
  name: string; // User-friendly name, e.g., "Main Counter POS", "Kitchen KDS 1"
  type: DeviceType;
  model?: string; // e.g., "iPad Pro 11-inch", "Epson TM-T88VI"
  serialNumber?: string; // Manufacturer's serial number
  ipAddress?: string; // If network-connected
  macAddress?: string; // If network-connected
  connectionType?: DeviceConnectionType;
  status: DeviceStatus;
  lastSeenAt?: Date; // Last time the device communicated with the server
  softwareVersion?: string; // Version of the POS app or firmware
  osVersion?: string; // Operating system version (e.g., iOS 15.5, Android 12)
  batteryLevel?: number; // For mobile devices (percentage)
  isCharging?: boolean; // For mobile devices
  assignedUserId?: User['id']; // User currently logged into/using this device (transient)
  defaultPurpose?: string; // e.g., "Primary Cash Register", "Bar Order Entry"
  installationDate?: Date;
  notes?: string;
  settings?: Record<string, unknown>; // Device-specific settings (e.g., KDS display columns, printer font size)
  // For payment terminals
  paymentGatewayIntegrationId?: string; // If linked to a specific payment processor setup
  isDefaultPaymentTerminal?: boolean; // For a POS station
  createdAt: Date;
  updatedAt: Date;
}