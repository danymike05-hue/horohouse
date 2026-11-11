import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type BookingIssueDocument = BookingIssue & Document;

export const ISSUE_CATEGORIES = [
  'could_not_check_in',
  'not_as_described',
  'cleanliness',
  'safety',
  'missing_amenities',
  'host_unresponsive',
  'other',
] as const;
export type IssueCategory = (typeof ISSUE_CATEGORIES)[number];

export enum IssueStatus {
  OPEN = 'open',
  /** An admin's refund is in progress: nobody else can decide this one */
  RESOLVING = 'resolving',
  RESOLVED = 'resolved',
}

export enum IssueOutcome {
  REFUND = 'refund',
  NO_REFUND = 'no_refund',
}

/** A guest's report of a problem with a stay. An admin decides it. */
@Schema({ timestamps: true })
export class BookingIssue {
  @Prop({ type: Types.ObjectId, ref: 'Booking', required: true, index: true })
  bookingId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  guestId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  hostId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Property', required: true })
  propertyId: Types.ObjectId;

  @Prop({ type: String, enum: ISSUE_CATEGORIES, required: true })
  category: IssueCategory;

  @Prop({ required: true, trim: true, maxlength: 2000 })
  description: string;

  @Prop({ type: [String], default: [] })
  photos: string[];

  /** The host's side of the story */
  @Prop({ trim: true, maxlength: 2000 })
  hostResponse?: string;

  @Prop()
  hostRespondedAt?: Date;

  /** Was the host's money still held when this was reported? */
  @Prop({ default: false })
  payoutFrozen: boolean;

  @Prop({ type: String, enum: Object.values(IssueStatus), default: IssueStatus.OPEN })
  status: IssueStatus;

  /** true until decided. Only one undecided report per booking (see the index below). */
  @Prop({ default: true })
  active: boolean;

  @Prop({ type: String, enum: Object.values(IssueOutcome) })
  outcome?: IssueOutcome;

  @Prop()
  refundAmount?: number;

  /** Shown to both the guest and the host */
  @Prop({ trim: true, maxlength: 500 })
  resolutionNote?: string;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  resolvedBy?: Types.ObjectId;

  @Prop()
  resolvedAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

export const BookingIssueSchema = SchemaFactory.createForClass(BookingIssue);

BookingIssueSchema.index({ bookingId: 1 }, { unique: true, partialFilterExpression: { active: true }, name: 'one_active_issue_per_booking' });
BookingIssueSchema.index({ status: 1, createdAt: 1 });
