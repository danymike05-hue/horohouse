import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum TemplateKind {
  /** Saved answer the host inserts in the chat with one tap */
  QUICK_REPLY = 'quick_reply',
  /** Sent automatically at a moment of the stay */
  SCHEDULED = 'scheduled',
}

export enum MessageTrigger {
  BOOKING_CONFIRMED = 'booking_confirmed',
  BEFORE_CHECKIN = 'before_checkin',
  CHECKIN_DAY = 'checkin_day',
  BEFORE_CHECKOUT = 'before_checkout',
  AFTER_CHECKOUT = 'after_checkout',
}

export type HostMessageTemplateDocument = HostMessageTemplate & Document;

@Schema({ timestamps: true, collection: 'host_message_templates' })
export class HostMessageTemplate {
  _id!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  hostId: Types.ObjectId;

  @Prop({ type: String, enum: Object.values(TemplateKind), required: true })
  kind: TemplateKind;

  @Prop({ type: String, required: true, maxlength: 60 })
  title: string;

  /** May contain {guest_name}, {listing}, {check_in_date}… (see renderTemplate) */
  @Prop({ type: String, required: true, maxlength: 2000 })
  body: string;

  @Prop({ type: String, enum: Object.values(MessageTrigger) })
  trigger?: MessageTrigger;

  /** Days before (before_*) or after (after_checkout) the date. Ignored for the others. */
  @Prop({ type: Number, default: 1, min: 0, max: 14 })
  daysOffset: number;

  /** Cameroon time (WAT, UTC+1), 'HH:mm'. Ignored for booking_confirmed (sent right away). */
  @Prop({ type: String, default: '10:00' })
  sendTime: string;

  /** Empty = every listing of the host */
  @Prop({ type: [Types.ObjectId], ref: 'Property', default: [] })
  propertyIds: Types.ObjectId[];

  @Prop({ default: true })
  isActive: boolean;

  createdAt?: Date;
  updatedAt?: Date;
}

export const HostMessageTemplateSchema = SchemaFactory.createForClass(HostMessageTemplate);
HostMessageTemplateSchema.index({ kind: 1, isActive: 1 });

export type HostMessageDeliveryDocument = HostMessageDelivery & Document;

/** One automatic message sent for one booking (also guarantees it is sent only once) */
@Schema({ timestamps: true, collection: 'host_message_deliveries' })
export class HostMessageDelivery {
  _id!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'HostMessageTemplate', required: true })
  templateId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Booking', required: true, index: true })
  bookingId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  hostId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  guestId: Types.ObjectId;

  @Prop({ type: String, required: true })
  title: string;

  @Prop({ type: String, required: true })
  body: string;

  @Prop({ type: Date, required: true })
  sentAt: Date;

  createdAt?: Date;
}

export const HostMessageDeliverySchema = SchemaFactory.createForClass(HostMessageDelivery);
HostMessageDeliverySchema.index({ templateId: 1, bookingId: 1 }, { unique: true });
