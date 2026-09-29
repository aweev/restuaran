// types/pos/notifications.types.ts

import { User } from './auth.types';
import { Location } from './multi-location.types';
// import { Order } from './order.types'; // For notifications related to orders
// import { InventoryAlert } from './inventory.types'; // For inventory-related notifications

export type NotificationLevel = "info" | "success" | "warning" | "error" | "critical";

export type NotificationChannel = "in_app_pos" | "sms" | "email" | "push_mobile_app" | "kds_alert";

export type NotificationTargetAudience =
  | "all_staff_at_location"
  | "specific_roles" // e.g., "manager", "waiter"
  | "specific_users"
  | "kitchen_displays"
  | "management_dashboard";

export type NotificationEntityType =
  | "Order"
  | "InventoryItem"
  | "Reservation"
  | "SystemMaintenance"
  | "UserShift"
  | "LowStockAlert"
  | "NewPromotion"
  | "StaffMessage" // General message from one staff to another/group
  | string; // For custom entities

export interface POSNotification {
  id: string;
  restaurantId: string;
  locationId?: Location['id']; // If notification is location-specific
  title?: string;
  message: string;
  level: NotificationLevel;
  channels: NotificationChannel[]; // How the notification is delivered

  // Targeting
  targetAudienceType: NotificationTargetAudience;
  targetUserIds?: User['id'][]; // If targetAudienceType is 'specific_users'
  targetUserRoles?: User['roles'][]; // If targetAudienceType is 'specific_roles'

  // Context
  entityType?: NotificationEntityType; // The type of entity this notification relates to
  entityId?: string; // The ID of the related entity (e.g., Order ID, InventoryAlert ID)
  deepLink?: string; // Link to navigate to the relevant part of the POS app

  // Status & Interaction
  isRead: boolean;
  readAt?: Date;
  readByUserId?: User['id']; // If multiple users can see and mark as read individually
  isArchived: boolean;
  archivedAt?: Date;
  archivedByUserId?: User['id'];
  requiresAction?: boolean;
  actionTaken?: boolean;
  actionTakenAt?: Date;
  actionTakenByUserId?: User['id'];

  // Scheduling & Expiry
  sendAt?: Date; // If scheduled for later delivery
  expiresAt?: Date; // When the notification should no longer be prominently displayed

  senderUserId?: User['id']; // If sent by a specific user
  senderSystemComponent?: string; // e.g., "InventoryModule", "OrderProcessor"
  createdAt: Date;
  // metadata?: Record<string, any>;
}

export interface UserNotificationStatus {
  id: string;
  notificationId: POSNotification['id'];
  userId: User['id'];
  isRead: boolean;
  readAt?: Date;
  isArchived: boolean;
  archivedAt?: Date;
  actionTaken?: boolean; // If actions are per-user for a shared notification
  actionTakenAt?: Date;
}