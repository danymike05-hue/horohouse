import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import type { BookingPriceBreakdown } from '../../bookings/schema/booking.schema';

export type BookingDateChangeDocument = BookingDateChange & Document;

export enum DateChangeStatus {
  PENDING = 'pending',                   // Waiting for the host
  AWAITING_PAYMENT = 'awaiting_payment', // Host accepted, the guest owes the difference
  APPLYING = 'applying',                 // Money is moving: nobody else can touch this one
  APPLIED = 'applied',
  DECLINED = 'declined',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired',
}

/** A guest's request to move a paid, confirmed stay. The booking keeps its dates until it's applied. */
@Schema({ collection: 'booking_date_changes', timestamps: true })
export class BookingDateChange {
  @Prop({ type: Types.ObjectId, ref: 'Booking', required: true, index: true })
  bookingId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  guestId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  hostId: Types.ObjectId;

  @Prop({ required: true })
  previousCheckIn: Date;

  @Prop({ required: true })
  previousCheckOut: Date;

  @Prop({ required: true })
  previousTotal: number;

  @Prop({ required: true })
  checkIn: Date;

  @Prop({ required: true })
  checkOut: Date;

  @Prop({ required: true })
  nights: number;

  /** The price is fixed when the guest asks: what they saw is what they get. */
  @Prop({ type: Object, required: true })
  priceBreakdown: BookingPriceBreakdown;

  /** The guest pays this before the new dates apply */
  @Prop({ default: 0 })
  amountDue: number;

  /** The guest gets this back (a cheaper stay, under the cancellation policy) */
  @Prop({ default: 0 })
  refundAmount: number;

  @Prop({ trim: true, maxlength: 500 })
  guestNote?: string;

  @Prop({ trim: true, maxlength: 500 })
  declineReason?: string;

  @Prop({ type: String, enum: Object.values(DateChangeStatus), default: DateChangeStatus.PENDING })
  status: DateChangeStatus;

  /** true until it ends. Only one open request per booking (see the index below). */
  @Prop({ default: true })
  active: boolean;

  @Prop({ required: true })
  expiresAt: Date;

  @Prop()
  appliedAt?: Date;

  /** The host's share of the payment was added to their held money (never twice) */
  @Prop({ default: false })
  holdAdded: boolean;

  /** Admins were told this one got stuck mid-way */
  @Prop()
  stuckAlertedAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

export const BookingDateChangeSchema = SchemaFactory.createForClass(BookingDateChange);

BookingDateChangeSchema.index({ bookingId: 1 }, { unique: true, partialFilterExpression: { active: true }, name: 'one_open_change_per_booking' });
BookingDateChangeSchema.index({ status: 1, expiresAt: 1 });
