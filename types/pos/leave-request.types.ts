// types/pos/leave-request.types.ts
import { User } from './auth.types';
import { Location } from './multi-location.types';

export type LeaveType =
  | "vacation"
  | "sick_leave_paid"
  | "sick_leave_unpaid"
  | "personal_leave_unpaid"
  | "bereavement"
  | "jury_duty"
  | "parental_leave"
  | "study_leave"
  | "time_off_in_lieu" // TOIL
  | "other";

export type LeaveRequestStatus =
  | "pending_approval"
  | "approved"
  | "declined"
  | "cancelled_by_employee" // Employee withdrew the request
  | "taken" // If you track actual usage post-approval
  | "partially_approved"; // If dates or duration were modified

export interface LeaveRequest {
  id: string;
  restaurantId: string;
  requestingUserId: User['id']; // The staff member making the request
  locationId?: Location['id']; // Primary location of the staff member
  leaveType: LeaveType;
  customLeaveTypeName?: string; // If leaveType is 'other'
  startDate: Date; // Start date of leave (inclusive)
  endDate: Date; // End date of leave (inclusive)
  isHalfDayStart?: boolean; // If leave starts mid-day
  isHalfDayEnd?: boolean; // If leave ends mid-day
  totalLeaveDays: number; // Calculated, can account for weekends/holidays if policy dictates
  totalLeaveHours?: number; // If tracking by hours
  reason?: string; // Reason provided by the employee
  employeeComments?: string;
  status: LeaveRequestStatus;
  requestedAt: Date; // When the request was submitted
  // Approval details
  approvedOrDeclinedByUserId?: User['id']; // Manager who actioned the request
  approvalOrDeclineDate?: Date;
  managerComments?: string; // Comments from the manager
  // Cancellation details
  cancelledAt?: Date;
  cancellationReason?: string;
  // Attachments
  attachmentUrls?: string[]; // e.g., for medical certificates
  // System fields
  createdAt: Date;
  updatedAt: Date;
}