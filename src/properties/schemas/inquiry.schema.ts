import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type InquiryDocument = Inquiry & Document;

export enum InquiryStatus {
  PENDING = 'pending',
  RESPONDED = 'responded',
  CLOSED = 'closed',
}

export enum InquiryType {
  GENERAL = 'general',
  VIEWING_REQUEST = 'viewing_request',
  PRICE_INQUIRY = 'price_inquiry',
  AVAILABILITY = 'availability',
  MORE_INFO = 'more_info',
}

@Schema({ timestamps: true })
export class Inquiry {
  @Prop({ type: Types.ObjectId, ref: 'Property', required: true })
  propertyId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  agentId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  message: string;

  @Prop({ type: String, enum: InquiryType, default: InquiryType.GENERAL })
  type: InquiryType;

  @Prop({ type: String, enum: InquiryStatus, default: InquiryStatus.PENDING })
  status: InquiryStatus;

  @Prop()
  response?: string;

  @Prop()
  respondedAt?: Date;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  respondedBy?: Types.ObjectId;

  // Contact preferences
  @Prop()
  preferredContactMethod?: string; // 'email' | 'phone' | 'both'

  @Prop()
  preferredContactTime?: string; // 'morning' | 'afternoon' | 'evening' | 'anytime'

  // Additional inquiry details
  @Prop()
  viewingDate?: Date;

  @Prop()
  budget?: number;

  @Prop()
  moveInDate?: Date;

  // User contact info (in case they want to be contacted differently)
  @Prop()
  contactEmail?: string;

  @Prop()
  contactPhone?: string;

  // Analytics
  @Prop({ default: false })
  isRead: boolean;

  @Prop()
  readAt?: Date;

  // Timestamps are automatically added
  createdAt: Date;
  updatedAt: Date;
}

export const InquirySchema = SchemaFactory.createForClass(Inquiry);

// Indexes for efficient queries
InquirySchema.index({ propertyId: 1, createdAt: -1 });
InquirySchema.index({ agentId: 1, status: 1, createdAt: -1 });
InquirySchema.index({ userId: 1, createdAt: -1 });
InquirySchema.index({ status: 1, createdAt: -1 });
