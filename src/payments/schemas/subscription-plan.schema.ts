import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { SubscriptionFeatures, SubscriptionPlan } from './subscription.schema';
import { BillingCycle } from './transaction.schema';

export type SubscriptionPlanDocument = SubscriptionPlanModel & Document;

@Schema({ timestamps: true })
export class SubscriptionPlanModel {
  @Prop({ required: true, unique: true, type: String, enum: SubscriptionPlan })
  name: SubscriptionPlan;

  @Prop({ required: true })
  displayName: string;

  @Prop({ required: true })
  description: string;

  @Prop({ type: [String] })
  highlights: string[];

  // Pricing per billing cycle
  @Prop({ type: Object, required: true })
  pricing: {
    [BillingCycle.MONTHLY]?: number;
    [BillingCycle.QUARTERLY]?: number;
    [BillingCycle.YEARLY]?: number;
  };

  @Prop({ default: 'XAF' })
  currency: string;

  @Prop({ type: Object, required: true })
  features: SubscriptionFeatures;

  // Trial period
  @Prop({ default: false })
  hasTrialPeriod: boolean;

  @Prop()
  trialDurationDays?: number;

  // Visibility
  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: true })
  isPublic: boolean;

  // Order for display
  @Prop({ default: 0 })
  displayOrder: number;

  // Discounts
  @Prop()
  currentDiscount?: number; // Percentage

  @Prop()
  discountEndDate?: Date;

  // Popular badge
  @Prop({ default: false })
  isPopular: boolean;

  // Metadata
  @Prop({ type: Object })
  metadata?: {
    color?: string;
    icon?: string;
    badge?: string;
    [key: string]: any;
  };

  createdAt: Date;
  updatedAt: Date;
}

export const SubscriptionPlanSchema = SchemaFactory.createForClass(SubscriptionPlanModel);

// Indexes
SubscriptionPlanSchema.index({ name: 1 });
SubscriptionPlanSchema.index({ isActive: 1, isPublic: 1 });
SubscriptionPlanSchema.index({ displayOrder: 1 });