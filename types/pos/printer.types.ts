// types/pos/printer.types.ts
import { Location } from './multi-location.types';
import { MenuCategory, MenuItem } from './menu.types'; // For assigning printers to categories/items
import { DiningMode } from './cart.types'; // Or order.types
import { User } from './auth.types';

export type PrinterType =
  | "receipt_printer"
  | "kitchen_printer" // For specific food prep stations
  | "bar_printer"
  | "expo_printer" // Expediter station printer
  | "label_printer" // For stickers on to-go items, inventory labels
  | "report_printer"; // For printing end-of-day reports etc.

export type PrinterConnectionType =
  | "network_ip"
  | "usb"
  | "bluetooth"
  | "serial_rs232"
  | "system_driver"; // Using OS print drivers

export interface PrinterProfile { // For specific print job types
  name: string; // e.g., "Standard Receipt", "Kitchen Hot Line Ticket"
  copies?: number; // Default 1
  fontSize?: "small" | "medium" | "large";
  characterSet?: string;
  lineSpacing?: number;
  enableCutter?: boolean;
  kickCashDrawer?: boolean; // For receipt printers
  printLogo?: boolean;
  // Template for the print job (could be simple text or a template language string)
  headerTemplate?: string;
  itemLineTemplate?: string;
  footerTemplate?: string;
}

export interface Printer {
  id: string;
  restaurantId: string;
  locationId: Location['id']; // Printer is physically at this location
  name: string; // User-friendly name, e.g., "Main Till Receipt", "Hot Line Kitchen"
  type: PrinterType;
  modelName?: string; // e.g., "Epson TM-T88VI", "Star TSP100"
  connectionType: PrinterConnectionType;
  // Connection details (vary based on type)
  ipAddress?: string; // For network_ip
  port?: number; // For network_ip (e.g., 9100)
  usbPortPath?: string; // For USB
  bluetoothAddress?: string; // For Bluetooth MAC address
  serialPortName?: string; // For serial (e.g., COM1, /dev/ttyS0)
  systemPrinterName?: string; // If using OS print driver
  driverName?: string; // Specific driver if not using system default
  paperWidthMillimeters?: 58 | 80 | number; // Common thermal paper widths
  status: "online" | "offline" | "error" | "paper_low" | "cover_open" | "printing";
  lastTestPrintStatus?: "success" | "failed";
  lastTestPrintAt?: Date;
  isDefaultReceiptPrinter?: boolean; // For its location
  isDefaultKitchenPrinter?: boolean; // General kitchen default
  isDefaultBarPrinter?: boolean;

  // Routing rules: Where print jobs for certain items/categories go
  assignedMenuCategoryIds?: MenuCategory[]; // Prints items from these categories
  assignedMenuItemIds?: MenuItem['id'][]; // Prints these specific items (overrides category)
  assignedDiningModes?: DiningMode[]; // e.g., print takeaway orders here
  assignedOrderSources?: string[]; // e.g., print online orders here
  assignedKdsStationId?: string; // If this printer is a backup/alternative for a KDS

  // Profiles for different types of print jobs this printer handles
  receiptProfile?: PrinterProfile;
  kitchenTicketProfile?: PrinterProfile;
  labelProfile?: PrinterProfile;

  notes?: string;
  createdAt: Date;
  updatedAt: Date;
  updatedByUserId?: User['id'];
}