import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type CoHostDocument = CoHost & Document;

export enum CoHostStatus {
  PENDING = 'pending',   // Invited, hasn't answered
  ACTIVE = 'active',
  DECLINED = 'declined',
  REMOVED = 'removed',   // Removed by the owner, or the co-host left
}

/**
 * Someone who helps run one listing. They can see its bookings, answer requests, run its
 * calendar and reply to reported problems. They never touch money: payouts stay with the
 * owner, and they can't cancel a booking, edit the listing or invite others.
 */
@Schema({ collection: 'co_hosts', timestamps: true })
export class CoHost {
  @Prop({ type: Types.ObjectId, ref: 'Property', required: true })
  propertyId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  invitedBy: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  /** The email or phone the owner typed. Until the invite is accepted, this is all they see. */
  @Prop({ required: true, trim: true })
  contact: string;

  @Prop({ type: String, enum: Object.values(CoHostStatus), default: CoHostStatus.PENDING })
  status: CoHostStatus;

  /** true while pending or active. One per person per listing (see the index below). */
  @Prop({ default: true })
  open: boolean;

  @Prop()
  respondedAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

export const CoHostSchema = SchemaFactory.createForClass(CoHost);

CoHostSchema.index({ propertyId: 1, userId: 1 }, { unique: true, partialFilterExpression: { open: true }, name: 'one_open_invite_per_person' });
CoHostSchema.index({ userId: 1, status: 1 });
CoHostSchema.index({ propertyId: 1, status: 1 });
