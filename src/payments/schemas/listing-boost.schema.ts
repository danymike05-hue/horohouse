import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ListingBoostDocument = ListingBoost & Document;

export enum BoostType {
  STANDARD = 'standard',
  FEATURED = 'featured',
  HIGHLIGHT = 'highlight',
  TOP = 'top',
  HOMEPAGE = 'homepage',
  SOCIAL_MEDIA = 'social_media',
}

export enum BoostStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled',
}

@Schema({ timestamps: true })
export class ListingBoost {
  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  userId: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId, ref: 'Property' })
  propertyId: Types.ObjectId;

  @Prop({ required: true, type: String, enum: BoostType })
  boostType: BoostType;

  @Prop({ required: true, type: String, enum: BoostStatus, default: BoostStatus.PENDING })
  status: BoostStatus;

  @Prop({ required: true })
  duration: number; // Duration in hours

  @Prop({ required: true })
  price: number;

  @Prop({ default: 'XAF' })
  currency?: string;

  @Prop()
  startDate?: Date;

  @Prop()
  endDate?: Date;

  @Prop()
  paymentDate?: Date;

  @Prop({ type: Types.ObjectId, ref: 'Transaction' })
  transactionId?: Types.ObjectId;

  // Analytics
  @Prop({ default: 0 })
  impressions?: number;

  @Prop({ default: 0 })
  clicks?: number;

  @Prop({ default: 0 })
  inquiries?: number;

  // Cancellation
  @Prop()
  cancelledAt?: Date;

  @Prop()
  cancellationReason?: string;

  @Prop({ type: Object })
  metadata?: Record<string, any>;

  createdAt: Date;
  updatedAt: Date;
}

export const ListingBoostSchema = SchemaFactory.createForClass(ListingBoost);

// Indexes
ListingBoostSchema.index({ propertyId: 1 });
ListingBoostSchema.index({ userId: 1 });
ListingBoostSchema.index({ boostType: 1, status: 1 });
ListingBoostSchema.index({ status: 1, endDate: 1 }); // For expiration checks
ListingBoostSchema.index({ status: 1, startDate: 1, endDate: 1 }); // For active boosts queries