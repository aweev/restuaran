// types/pos/business-profile.types.ts
import { User } from './auth.types'; 
import { SystemSettings } from './system-settings.types'; // If global settings are linked here

export interface BusinessHours {
  dayOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = Sunday, 6 = Saturday
  openTime: string; // HH:MM format (24-hour)
  closeTime: string; // HH:MM format (24-hour)
  isOpen: boolean; // Allows marking a day as closed
}

export interface SpecialBusinessHours {
  date: Date; // Specific date for special hours (e.g., holiday)
  openTime?: string; // HH:MM, optional if closed all day
  closeTime?: string; // HH:MM, optional if closed all day
  isClosed: boolean; // Explicitly closed for the day
  reason?: string; // e.g., "Holiday Closure", "Private Event"
}

export interface BusinessContactInfo {
  primaryPhoneNumber?: string;
  secondaryPhoneNumber?: string;
  publicEmail?: string;
  supportEmail?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  stateProvince: string;
  postalCode: string;
  country: string;
  latitude?: number;
  longitude?: number;
}

export interface BusinessProfile {
  id: string; // Typically a single record for a single restaurant setup, or unique ID for a chain
  businessName: string; // The commonly known name of the restaurant/business
  legalName?: string; // Official legal name of the entity
  taxId?: string; // e.g., EIN, VAT number
  registrationNumber?: string; // Business registration number
  ownerUserId?: User['id']; // The primary owner/admin user account
  logoImageUrl?: string;
  brandColorPrimary?: string; // For theming POS UI elements
  brandColorSecondary?: string;
  websiteUrl?: string;
  description?: string; // Short description or tagline
  establishedDate?: Date;
  defaultCurrency: string; // e.g., "USD", "EUR", "GBP" (ISO 4217 code)
  defaultTimezone: string; // e.g., "America/New_York", "Europe/London"
  defaultLanguage: string; // e.g., "en", "es"
  contactInfo: BusinessContactInfo;
  standardOpeningHours: BusinessHours[];
  specialOpeningHours?: SpecialBusinessHours[]; // For holidays, special events
  globalSettingsId?: SystemSettings['id']; // Link to global system settings
  subscriptionPlanId?: string; // If your POS is SaaS with different plans
  subscriptionStatus?: "active" | "trial" | "past_due" | "cancelled";
  billingContactEmail?: string;
  industryType?: string; // e.g., "Full-Service Restaurant", "Quick Service", "Cafe", "Bar"
  metadata?: Record<string, unknown>; // For any other custom business-level data
  createdAt: Date;
  updatedAt: Date;
  updatedByUserId?: User['id'];
}