import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

// ─── Review Enums ────────────────────────────────────────────────────────────
export enum ReviewType {
  PROPERTY = 'property',
  AGENT = 'agent',
  STAY = 'stay',
  GUEST = 'guest',
  INSIGHT = 'insight',
}

export enum ReviewerRole {
  GUEST = 'guest',
  HOST = 'host',
}

// ─── Review Schema ───────────────────────────────────────────────────────────
@Schema({ timestamps: true })
export class Review {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ type: String, required: true })
  userName: string;

  @Prop({ type: String, enum: Object.values(ReviewType), required: true })
  reviewType: ReviewType;

  @Prop({ type: String, enum: Object.values(ReviewerRole), required: true })
  reviewerRole: ReviewerRole;

  @Prop({ type: Types.ObjectId, ref: 'Property' })
  propertyId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  agentId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Booking' })
  bookingId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Post' })
  insightId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  reviewedUserId?: Types.ObjectId;

  @Prop({ type: Number, min: 1, max: 5 })
  rating: number;

  @Prop({ type: Object })
  staySubRatings?: {
    cleanliness?: number;
    accuracy?: number;
    checkIn?: number;
    communication?: number;
    location?: number;
    value?: number;
  };

  @Prop({ type: Object })
  guestSubRatings?: {
    communication?: number;
    cleanliness?: number;
    rules?: number;
  };

  @Prop({ type: String })
  comment?: string;

  @Prop({ type: [String] })
  images?: string[];

  @Prop({ type: Boolean, default: true })
  verified: boolean;

  @Prop({ type: Boolean, default: false })
  bookingVerified: boolean;

  @Prop({ type: Boolean, default: true })
  isPublished: boolean;

  @Prop({ type: Boolean, default: true })
  isActive: boolean;

  @Prop({ type: Date })
  publishDeadline?: Date;

  @Prop({ type: String })
  response?: string;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  respondedBy?: Types.ObjectId;

  @Prop({ type: Date })
  respondedAt?: Date;

  @Prop({ type: [Types.ObjectId], ref: 'User', default: [] })
  helpfulBy?: Types.ObjectId[];

  @Prop({ type: Number, default: 0 })
  helpfulCount?: number;
}

export type ReviewDocument = Review & Document;
export const ReviewSchema = SchemaFactory.createForClass(Review);

// ─── Notification Types (existing) ─────────────────────────────────────────
export type NotificationDocument = Notification & Document;

export enum NotificationType {
  INQUIRY         = 'inquiry',
  FAVORITE        = 'favorite',
  PROPERTY_UPDATE = 'property_update',
  MESSAGE         = 'message',
  SYSTEM          = 'system',
  BOOKING_REQUEST    = 'booking_request',
  BOOKING_CONFIRMED  = 'booking_confirmed',
  BOOKING_REJECTED   = 'booking_rejected',
  BOOKING_CANCELLED  = 'booking_cancelled',
  BOOKING_REMINDER   = 'booking_reminder',
  BOOKING_COMPLETED  = 'booking_completed',
  REVIEW_REQUEST     = 'review_request',
  REVIEW_RECEIVED    = 'review_received',
  REVIEW_PUBLISHED   = 'review_published',
  REVIEW_RESPONSE    = 'review_response',
  PAYMENT_RECEIVED   = 'payment_received',
  REFUND_PROCESSED   = 'refund_processed',
}

@Schema({ timestamps: true })
export class Notification {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({
    type: String,
    enum: Object.values(NotificationType),
    required: true,
    index: true,
  })
  type: NotificationType;

  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  message: string;

  @Prop({ default: false, index: true })
  read: boolean;

  @Prop({ type: String })
  link?: string;

  @Prop({ type: Object })
  metadata?: {
    // ── Existing ────────────────────────────────────────────────────────────
    propertyId?: string;
    inquiryId?: string;
    senderId?: string;
    // ── NEW ─────────────────────────────────────────────────────────────────
    bookingId?: string;
    reviewId?: string;
    checkIn?: string;     // ISO date string — used in reminder notifications
    checkOut?: string;
    guestName?: string;
    hostName?: string;
    propertyTitle?: string;
    amount?: number;      // payment / refund amount
    currency?: string;
    [key: string]: any;
  };

  createdAt?: Date;
  updatedAt?: Date;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);

// ── Existing indexes (preserved) ─────────────────────────────────────────────
NotificationSchema.index({ userId: 1, read: 1 });
NotificationSchema.index({ userId: 1, createdAt: -1 });
NotificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 2592000 }); // TTL: 30 days

// ── New indexes ───────────────────────────────────────────────────────────────
// Fast lookup for "all booking notifications for this user" (dashboard filter)
NotificationSchema.index({ userId: 1, type: 1, createdAt: -1 });
// Used by the cron job that sends check-in reminders
NotificationSchema.index({ type: 1, 'metadata.checkIn': 1, read: 1 });