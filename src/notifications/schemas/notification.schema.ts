import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type NotificationDocument = Notification & Document;

// ─── Enums ────────────────────────────────────────────────────────────────────

export enum NotificationType {
  // ── Existing ──────────────────────────────────────────────────────────────
  INQUIRY         = 'inquiry',
  FAVORITE        = 'favorite',
  PROPERTY_UPDATE = 'property_update',
  MESSAGE         = 'message',
  SYSTEM          = 'system',

  // ── NEW: Booking lifecycle ─────────────────────────────────────────────────
  BOOKING_REQUEST    = 'booking_request',    // Host: new booking request received
  BOOKING_CONFIRMED  = 'booking_confirmed',  // Guest: host confirmed their booking
  BOOKING_REJECTED   = 'booking_rejected',   // Guest: host declined their booking
  BOOKING_CANCELLED  = 'booking_cancelled',  // Both: a booking was cancelled
  BOOKING_REMINDER   = 'booking_reminder',   // Guest: check-in is approaching (e.g. 24h before)
  BOOKING_COMPLETED  = 'booking_completed',  // Both: stay marked as completed

  // ── NEW: Review lifecycle ─────────────────────────────────────────────────
  REVIEW_REQUEST     = 'review_request',     // Both: prompted to leave a review after checkout
  REVIEW_RECEIVED    = 'review_received',    // Host: guest left a review on their property
  REVIEW_PUBLISHED   = 'review_published',   // Both: mutual reviews are now visible
  REVIEW_RESPONSE    = 'review_response',    // Guest: host responded to their review

  // ── NEW: Payment ──────────────────────────────────────────────────────────
  PAYMENT_RECEIVED   = 'payment_received',   // Host: payment confirmed for a booking
  REFUND_PROCESSED   = 'refund_processed',   // Guest: refund has been processed
}

// ─── Schema ───────────────────────────────────────────────────────────────────

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