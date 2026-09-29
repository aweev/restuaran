// types/pos/customer-feedback.types.ts
import { User } from './auth.types'; // For staff who responded
import { Order } from './order.types'; // For linking feedback to an order
import { Customer } from './customer.types'; // For linking feedback to a known POS customer
import { MenuItem } from './menu.types'; // If feedback is item-specific
import { Location } from './multi-location.types';

export type FeedbackSource =
  | "table_tablet"
  | "email_survey"
  | "sms_survey"
  | "qr_code_on_receipt"
  | "staff_input" // Feedback given verbally and entered by staff
  | "website_form"
  | "in_app_pos" // If POS has a customer-facing screen for feedback
  | "kiosk";

export type FeedbackSentiment = "positive" | "neutral" | "negative";

export interface FeedbackRatingAspect {
  aspect: string; // e.g., "Food Quality", "Service Speed", "Ambiance", "Cleanliness"
  rating: number; // Typically 1-5 or 1-10
  comment?: string; // Specific comment for this aspect
}

export interface CustomerFeedback {
  id: string;
  restaurantId: string;
  locationId?: Location['id'];
  orderId?: Order['id']; // Link to the specific order, if applicable
  customerId?: Customer['id']; // Link to a known POS customer
  dinerName?: string; // If customer is not in DB or anonymous
  dinerContact?: string; // Email or phone, if provided and allowed
  source: FeedbackSource;
  submittedAt: Date;

  overallRating?: number; // Overall satisfaction rating (e.g., 1-5 stars)
  comment?: string; // General comments
  aspectRatings?: FeedbackRatingAspect[]; // Detailed ratings for specific aspects
  itemSpecificFeedback?: {
    menuItemId: MenuItem['id'];
    itemName: MenuItem['title']; // Denormalized
    rating?: number;
    comment?: string;
  }[];

  sentiment?: FeedbackSentiment; // Auto-analyzed or manually set
  tags?: string[]; // e.g., "complaint_food", "praise_service", "suggestion_menu"
  isPublic?: boolean; // If the feedback can be displayed publicly (e.g., on website testimonials)
  isAnonymous: boolean; // If the customer chose to submit anonymously

  followUpRequired: boolean;
  followUpStatus?: "pending" | "in_progress" | "resolved" | "closed_no_action";
  resolutionNotes?: string;
  resolvedByUserId?: User['id'];
  resolvedAt?: Date;

  // For internal use
  viewedByStaffAt?: Date;
  viewedByStaffUserId?: User['id'];
  internalNotes?: string;

  createdAt: Date; // When the feedback record was created in the system
  updatedAt: Date;
}