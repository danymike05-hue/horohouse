import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type BookingDocument = Booking & Document;

// ─── Enums ────────────────────────────────────────────────────────────────────

export enum BookingStatus {
  PENDING = 'pending',    // Guest requested, waiting for host confirmation
  CONFIRMED = 'confirmed',  // Host accepted (or instant-book triggered)
  CANCELLED = 'cancelled',  // Cancelled by guest or host
  COMPLETED = 'completed',  // Stay is over
  REJECTED = 'rejected',   // Host explicitly declined
  NO_SHOW = 'no_show',    // Guest never checked in
}

export enum PaymentStatus {
  UNPAID = 'unpaid',
  PAID = 'paid',
  REFUNDED = 'refunded',
  PARTIAL = 'partial',     // Partial refund after cancellation
}

export enum CancellationPolicy {
  FLEXIBLE = 'flexible',   // Full refund up to 24h before check-in
  MODERATE = 'moderate',   // Full refund up to 5 days before check-in
  STRICT = 'strict',     // 50% refund up to 7 days before check-in
  NO_REFUND = 'no_refund',
}

export enum CancelledBy {
  GUEST = 'guest',
  HOST = 'host',
  ADMIN = 'admin',
  SYSTEM = 'system',        // Automatic cancellation (e.g. payment timeout)
}

// ─── Sub-document interfaces ──────────────────────────────────────────────────

export interface BookingGuest {
  adults: number;
  children?: number;
  infants?: number;
}

export interface BookingPriceBreakdown {
  pricePerNight: number;
  nights: number;
  subtotal: number;         // pricePerNight × nights
  cleaningFee: number;
  serviceFee: number;       // Platform fee
  taxAmount: number;
  discountAmount: number;   // Weekly / monthly discount
  totalAmount: number;
}

export interface BookingCancellation {
  cancelledBy: CancelledBy;
  cancelledAt: Date;
  reason?: string;
  refundAmount?: number;
  refundStatus?: 'pending' | 'processed' | 'failed';
}

// ─── Schema ───────────────────────────────────────────────────────────────────

@Schema({ timestamps: true })
export class Booking {
  _id!: Types.ObjectId;

  // ── Core references ──────────────────────────────────────────────────────

  @Prop({ type: Types.ObjectId, ref: 'Property', required: true, index: true })
  propertyId: Types.ObjectId;

  /**
   * Optional — set when the property has multiple bookable rooms (hotel/hostel/motel).
   * If present, availability checks are scoped to this room rather than the whole property.
   */
  @Prop({ type: Types.ObjectId, ref: 'Room', index: true })
  roomId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  guestId: Types.ObjectId;

  /**
   * The person who receives the reservation (property owner or agent).
   * Denormalized here so we never have to join through Property to notify them.
   */
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  hostId: Types.ObjectId;

  // ── Stay details ─────────────────────────────────────────────────────────

  @Prop({ required: true })
  checkIn: Date;

  @Prop({ required: true })
  checkOut: Date;

  /** Computed at creation: Math.ceil((checkOut - checkIn) / 86_400_000) */
  @Prop({ required: true, min: 1 })
  nights: number;

  @Prop({
    type: {
      adults: { type: Number, required: true, min: 1, default: 1 },
      children: { type: Number, default: 0 },
      infants: { type: Number, default: 0 },
    },
    required: true,
  })
  guests: BookingGuest;

  // ── Pricing ──────────────────────────────────────────────────────────────

  /**
   * Full price breakdown captured at booking time so it never changes
   * even if the host later edits the property price.
   */
  @Prop({
    type: {
      pricePerNight: { type: Number, required: true },
      nights: { type: Number, required: true },
      subtotal: { type: Number, required: true },
      cleaningFee: { type: Number, default: 0 },
      serviceFee: { type: Number, default: 0 },
      taxAmount: { type: Number, default: 0 },
      discountAmount: { type: Number, default: 0 },
      totalAmount: { type: Number, required: true },
    },
    required: true,
  })
  priceBreakdown: BookingPriceBreakdown;

  @Prop({ default: 'XAF' })
  currency: string;

  // ── Status ───────────────────────────────────────────────────────────────

  @Prop({
    type: String,
    enum: Object.values(BookingStatus),
    default: BookingStatus.PENDING,
    index: true,
  })
  status: BookingStatus;

  @Prop({
    type: String,
    enum: Object.values(PaymentStatus),
    default: PaymentStatus.UNPAID,
  })
  paymentStatus: PaymentStatus;

  @Prop()
  paymentReference?: string;    // External payment gateway transaction ID

  @Prop()
  paymentMethod?: string;       // 'mobile_money' | 'card' | 'cash' etc.

  @Prop()
  paidAt?: Date;

  // ── Communication ────────────────────────────────────────────────────────

  @Prop({ trim: true, maxlength: 1000 })
  guestNote?: string;           // Message from guest at booking time

  @Prop({ trim: true, maxlength: 1000 })
  hostNote?: string;            // Host's internal note or message to guest

  // ── Confirmation / Instant book ──────────────────────────────────────────

  /**
   * true  → booking was auto-confirmed because property.isInstantBookable = true
   * false → host manually confirmed
   */
  @Prop({ default: false })
  isInstantBook: boolean;

  @Prop()
  confirmedAt?: Date;

  @Prop()
  expiresAt?: Date;
  // ── Cancellation ─────────────────────────────────────────────────────────

  @Prop({
    type: {
      cancelledBy: { type: String, enum: Object.values(CancelledBy) },
      cancelledAt: { type: Date },
      reason: { type: String },
      refundAmount: { type: Number },
      refundStatus: { type: String, enum: ['pending', 'processed', 'failed'] },
    },
    default: null,
  })
  cancellation?: BookingCancellation;

  // ── Check-in / Check-out tracking ────────────────────────────────────────

  @Prop()
  actualCheckIn?: Date;

  @Prop()
  actualCheckOut?: Date;

  // ── Review flags ─────────────────────────────────────────────────────────

  @Prop({ default: false })
  guestReviewLeft: boolean;

  @Prop({ default: false })
  hostReviewLeft: boolean;

  // ── Timestamps (auto by Mongoose) ────────────────────────────────────────
  createdAt: Date;
  updatedAt: Date;
}

// ─── Schema factory & indexes ─────────────────────────────────────────────────

export const BookingSchema = SchemaFactory.createForClass(Booking);

// Fast lookups by property + date range (used in availability checks)
BookingSchema.index({ propertyId: 1, checkIn: 1, checkOut: 1 });
// Room-level availability checks
BookingSchema.index({ roomId: 1, status: 1, checkIn: 1, checkOut: 1 });

// Dashboard queries
BookingSchema.index({ guestId: 1, status: 1, createdAt: -1 });
BookingSchema.index({ hostId: 1, status: 1, createdAt: -1 });

// Automated jobs (e.g. auto-cancel unpaid after X hours)
BookingSchema.index({ status: 1, paymentStatus: 1, createdAt: 1 });

// Index for auto-cancellation queries
BookingSchema.index({ status: 1, expiresAt: 1 });
