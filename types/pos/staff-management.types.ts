// types/pos/staff-management.types.ts

import { User, UserRole } from './auth.types';
import { Location } from './multi-location.types';
export interface Skill {
  id: string;
  name: string;
  description?: string;
}
import { UserWorkShift } from './auth.types'; // Assuming this is the correct import for UserWorkShift

export interface StaffProfile {
  id: string; // Should match User['id'] for a one-to-one relationship
  userId: User['id'];
  restaurantId: string;
  employeeId?: string; // Internal employee number
  dateOfBirth?: Date;
  hireDate: Date;
  terminationDate?: Date;
  employmentType: "full_time" | "part_time" | "contractor" | "intern" | "temporary";
  jobTitle?: string; // More specific than UserRole, e.g., "Head Chef", "Senior Waiter"
  department?: string; // e.g., "Kitchen", "Front of House", "Management"
  managerUserId?: User['id']; // Direct manager
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContactRelationship?: string;

  // Performance & Skills
  performanceReviewIds?: string[]; // Links to performance review records
  trainingRecordIds?: string[]; // Links to training completion records
  skills?: Skill[]; // List of skills/certifications (e.g., "Sommelier Level 1", "Food Handler Certified")
  languagesSpoken?: string[]; // e.g., ["English", "Spanish"]

  // Scheduling Preferences (distinct from fixed availability)
  maxHoursPerWeek?: number;
  minHoursPerWeek?: number;
  preferredShiftTypes?: ("morning" | "afternoon" | "evening" | "night")[];
  unavailableOnSpecificDates?: { date: Date, reason?: string }[];

  // Other HR Info
  address?: { // Home address
    street: string;
    city: string;
    stateProvince: string;
    postalCode: string;
    country: string;
  };
  notes?: string; // HR-related notes
  documents?: { name: string, url: string, type: "contract" | "id_proof" | "certificate" }[];

  createdAt: Date;
  updatedAt: Date;
  updatedByUserId?: User['id'];
}

export interface StaffAvailability {
  id: string;
  staffUserId: User['id'];
  restaurantId: string;
  locationId?: Location['id']; // If availability is location-specific
  dayOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = Sunday
  startTime: string; // HH:MM format (24-hour), local to staff's or location's timezone
  endTime: string; // HH:MM format (24-hour)
  isAvailableAllDay?: boolean; // If true, startTime/endTime might be ignored for this day
  isRecurring: boolean; // If this is their general weekly availability
  effectiveStartDate: Date; // When this availability pattern starts
  effectiveEndDate?: Date; // When this availability pattern ends (if not indefinite)
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ScheduledStaffShift {
  id: string;
  restaurantId: string;
  locationId: Location['id'];
  staffUserId: User['id'];
  shiftDate: Date; // The date the shift occurs on
  startTime: Date; // Full DateTime object (UTC or with timezone)
  endTime: Date; // Full DateTime object
  durationHours: number; // Calculated
  roleAssigned: UserRole | string; // Role they are scheduled for this shift
  positionOrTask?: string; // More specific task, e.g., "Barista AM", "Host Stand"
  status:
    | "draft" // Proposed shift, not yet published
    | "scheduled_unpublished"
    | "published_pending_confirmation" // Published, employee needs to confirm
    | "confirmed_by_employee"
    | "declined_by_employee"
    | "open_for_pickup" // Available for other staff to claim
    | "picked_up_by_staff_id" // Another staff member claimed it
    | "cancelled_by_manager"
    | "trade_requested"
    | "trade_approved";
  // Actual clock-in/out data will be in UserWorkShift (from auth.types.ts) or TimeClockEntry
  userWorkShiftId?: UserWorkShift['id'];
  isPaidBreak?: boolean;
  unpaidBreakMinutes?: number;
  notes?: string; // Manager notes for the shift
  employeeNotes?: string; // Staff notes if they confirm/decline/request trade
  scheduleId?: string; // Link to the parent StaffSchedule document if applicable
  colorCode?: string; // For visual display on calendar
  createdAt: Date;
  updatedAt: Date;
  publishedAt?: Date;
  publishedByUserId?: User['id'];
}

export interface BusyPeriodPrediction {
  id: string;
  restaurantId: string;
  locationId: Location['id'];
  predictionDate: Date; // Date for which the prediction is made
  hourOfDay: number; // 0-23
  predictedBusynessScore: number; // e.g., 1-10 scale, or expected covers/orders
  confidence?: number; // 0-1
  source?: "historical_data" | "ml_model" | "event_calendar_override";
  requiredStaffingLevels?: {
    role: UserRole | string;
    count: number;
  }[];
  notes?: string;
  generatedAt: Date;
}

export interface StaffSchedule {
  id: string;
  restaurantId: string;
  locationId: Location['id'];
  scheduleName?: string; // e.g., "Week 25 Schedule - Main Dining"
  periodStartDate: Date;
  periodEndDate: Date;
  status: "draft" | "published" | "archived";
  scheduledShifts: ScheduledStaffShift[]; // Shifts can be queried separately or embedded if not too many
  totalScheduledHours: number;
  estimatedLaborCost: number; // (cents/decimal)
  // Coverage analysis (could be complex, might be a separate report/calculation)
  coverageGaps?: {
    date: Date;
    hour: number;
    role: UserRole | string;
    requiredStaff: number;
    scheduledStaff: number;
    gap: number; // Positive if overstaffed, negative if understaffed
  }[];
  notes?: string;
  publishedAt?: Date;
  publishedByUserId?: User['id'];
  createdAt: Date;
  updatedAt: Date;
  updatedByUserId?: User['id'];
}