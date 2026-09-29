export interface StaffMember {
  id: string
  userId: string
  position: string
  hourlyRate: number
  maxHoursPerWeek: number
  isFullTime: boolean
  locationId?: string
}

export interface StaffAvailability {
  id: string
  staffId: string
  dayOfWeek: number // 0 = Sunday, 1 = Monday, etc.
  startTime: string // HH:MM format
  endTime: string // HH:MM format
  isRecurring: boolean
  specificDate?: Date
}

export interface StaffShift {
  id: string
  staffId: string
  locationId: string
  startTime: Date
  endTime: Date
  position: string
  status: "scheduled" | "confirmed" | "in_progress" | "completed" | "missed"
  notes?: string
  createdAt: Date
  updatedAt: Date
}

export interface BusyPeriodPrediction {
  locationId: string
  date: Date
  hour: number
  predictedBusyness: number // 1-10 scale
  confidence: number // 0-1 scale
  requiredStaff: {
    position: string
    count: number
  }[]
}

export interface StaffSchedule {
  weekStartDate: Date
  locationId: string
  shifts: StaffShift[]
  totalHours: number
  totalCost: number
  coverage: {
    date: Date
    hour: number
    requiredStaff: number
    scheduledStaff: number
    coverage: number // 0-1 scale
  }[]
}
