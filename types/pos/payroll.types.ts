// types/pos/payroll.types.ts

import { User } from './auth.types';
// import { Location } from './multi-location.types';
import { UserWorkShift } from './auth.types'; // Actual clocked shifts

export interface PayRate {
  id: string; // Unique identifier for the pay rate
  type: "hourly" | "salaried_per_period" | "commission_percentage" | "fixed_per_shift";
  amount: number; // Hourly rate, salary amount, commission %, shift pay (in cents/decimal for monetary)
  currency: string; // e.g., "USD"
  effectiveDate: Date;
  endDate?: Date; // If rate is for a specific period
}

export interface StaffPayrollProfile {
  id: string; // Or link directly using User['id'] if one-to-one
  userId: User['id'];
  restaurantId: string;
  payRates: PayRate[]; // History of pay rates
  defaultPayRateId?: PayRate['id']; // Current active pay rate
  paymentFrequency: "weekly" | "bi_weekly" | "semi_monthly" | "monthly";
  paymentMethod: "direct_deposit" | "cheque" | "cash";
  bankAccountNumber?: string; // Encrypted
  bankRoutingNumber?: string; // Encrypted
  taxIdNumber?: string; // e.g., SSN, EIN (store securely)
  deductions?: {
    name: string; // e.g., "Health Insurance", "401k"
    type: "fixed_amount" | "percentage_of_gross";
    value: number; // Amount or percentage
    isPreTax?: boolean;
  }[];
  withholdingAllowances?: number; // For tax calculations
}

export interface TimeSheetEntry {
  id: string;
  userWorkShiftId: UserWorkShift['id']; // Link to the actual clocked shift
  date: Date;
  regularHours: number;
  overtimeHours?: number;
  doubleTimeHours?: number;
  breakHoursUnpaid?: number;
  payRateApplied: PayRate; // Snapshot of the pay rate used for this entry
  grossPayForEntry: number; // (cents/decimal)
  notes?: string;
  isApproved: boolean;
  approvedByUserId?: User['id'];
}

export interface PayrollPeriod {
  id: string;
  restaurantId: string;
  startDate: Date;
  endDate: Date;
  paymentDate: Date;
  status: "open" | "pending_approval" | "approved" | "processing_payment" | "paid" | "closed";
}

export interface PayrollRecord {
  id: string;
  restaurantId: string;
  payrollPeriodId: PayrollPeriod['id'];
  userId: User['id'];
  staffNameSnapshot: string; // Denormalized

  // Earnings
  totalRegularHours: number;
  totalOvertimeHours?: number;
  totalDoubleTimeHours?: number;
  regularPayAmount: number; // (cents/decimal)
  overtimePayAmount?: number; // (cents/decimal)
  doubleTimePayAmount?: number; // (cents/decimal)
  tipsEarned?: number; // (cents/decimal) - if tips are part of payroll
  commissionsEarned?: number; // (cents/decimal)
  bonuses?: number; // (cents/decimal)
  otherEarnings?: { name: string, amount: number }[];
  grossPay: number; // Total earnings before deductions (cents/decimal)

  // Deductions
  preTaxDeductionsTotal: number; // (cents/decimal)
  postTaxDeductionsTotal: number; // (cents/decimal)
  employeeTaxesWithheld?: { // e.g., Federal, State, Local, Social Security, Medicare
    taxName: string;
    amount: number; // (cents/decimal)
  }[];
  totalTaxesWithheld: number; // (cents/decimal)
  totalDeductions: number; // preTax + postTax + totalTaxesWithheld (cents/decimal)

  netPay: number; // grossPay - totalDeductions (cents/decimal)

  employerTaxes?: { taxName: string, amount: number }[];
  employerBenefitContributions?: { benefitName: string, amount: number }[];

  paymentMethodUsed?: StaffPayrollProfile['paymentMethod'];
  paymentConfirmationId?: string; // If paid electronically
  timeSheetEntryIds?: TimeSheetEntry['id'][]; // Links to approved timesheet entries for this payroll
  notes?: string;
  createdAt: Date;
  processedByUserId?: User['id'];
}