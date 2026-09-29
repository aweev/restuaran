// types/pos/system-settings.types.ts
import { User } from './auth.types';
import { BusinessProfile } from './business-profile.types'; // For relating to the business
import { AccountingProvider } from './accounting.types'; // Example integration setting
import { PaymentGateway } from './payments.types'; // Example integration setting

export interface RoundingRule {
  currencyCode: string; // e.g., "USD", "CAD"
  type: "none" | "round_nearest" | "round_up" | "round_down";
  precision: number; // Number of decimal places for general calculations
  cashRoundingIncrement?: number; // For cash transactions, e.g., 0.05 for rounding to nearest 5 cents
}

export interface RegionalSettings {
  defaultCountry: string; // ISO 3166-1 alpha-2 code
  dateFormat: "MM/DD/YYYY" | "DD/MM/YYYY" | "YYYY-MM-DD" | string;
  timeFormat: "12h_am_pm" | "24h";
  numberFormat: {
    decimalSeparator: "." | ",";
    thousandsSeparator: "," | "." | " " | "";
  };
  firstDayOfWeek: 0 | 1; // 0 = Sunday, 1 = Monday
}

export interface SecuritySettings {
  passwordPolicy: {
    minLength: number;
    requiresUppercase: boolean;
    requiresLowercase: boolean;
    requiresNumber: boolean;
    requiresSpecialChar: boolean;
    maxPasswordAgeDays?: number; // Days before password must be changed
    passwordHistoryCount?: number; // Prevent reuse of last N passwords
  };
  accountLockoutPolicy: {
    maxFailedAttempts: number;
    lockoutDurationMinutes: number;
  };
  sessionTimeoutMinutes: number; // For web dashboard inactivity
  twoFactorAuthRequirement: "disabled" | "optional_for_users" | "mandatory_for_all" | "mandatory_for_roles";
  mandatoryRolesFor2FA?: User['roles'][];
  ipWhitelist?: string[]; // IPs allowed to access admin functions
}

export interface IntegrationSettings {
  //storing enabled state or global API keys if not per-integration instance
  enabledAccountingProviders?: AccountingProvider[];
  enabledPaymentGateways?: PaymentGateway[];
  globalApiKeyForServiceX?: string; // Securely stored
}

export interface SystemSettings {
  id: string; // Usually a fixed ID like "global_settings"
  restaurantId: BusinessProfile['id']; // Link to the business this settings instance belongs to

  // General Application
  applicationName?: string; // Name displayed in UI
  applicationVersion?: string; // Current deployed version
  maintenanceMode: {
    isEnabled: boolean;
    message?: string;
    allowedIpAddresses?: string[]; // IPs that can bypass maintenance mode
  };

  // Financial & Regional
  defaultCurrency: string; // ISO 4217 (can be overridden by BusinessProfile/Location)
  defaultTimezone: string; // IANA Time Zone (can be overridden)
  roundingRules: RoundingRule[]; // Per currency if multi-currency support
  regionalOverrides?: RegionalSettings; // Global date/time/number formats

  // Operational Defaults
  defaultOrderNumberPrefix?: string;
  defaultKdsScreenRefreshIntervalSeconds?: number;
  defaultTableTurnoverTimeMinutes?: number;

  // Security & Compliance
  security?: SecuritySettings;
  auditLogRetentionDays: number; // How long to keep audit logs
  dataRetentionPolicy?: { // For GDPR etc.
    customerDataYears?: number;
    orderDataYears?: number;
  };

  // Integrations (Global on/off or master keys, specific configs in their own types)
  integrations?: IntegrationSettings;

  // Email & Communication (Default SMTP or service for system emails)
  systemEmailSenderAddress?: string;
  smtpSettings?: { host: string; port: number; user?: string; pass?: string; secure: boolean; };

  // Feature Flags (To enable/disable features globally)
  featureFlags?: Record<string, boolean>;

  // Customization
  customCssUrl?: string;
  customJavaScriptUrl?: string;
  customBranding?: {
    logoUrl?: string; // URL to the logo
    colorScheme?: {
      primaryColor?: string; // Hex code or color name
      secondaryColor?: string;
    };
  };
  // Accessibility Settings (e.g., for color blindness, font size adjustments)
  accessibilitySettings?: {
    highContrastMode?: boolean;
    fontSizeAdjustment?: number; // e.g., 1.2 for 20% larger text
  };

  // Licensing (If applicable for the POS software itself)
  licenseKey?: string;
  licensedTo?: string;
  licenseExpiryDate?: Date;

  lastUpdatedAt: Date;
  lastUpdatedByUserId?: User['id'];
}