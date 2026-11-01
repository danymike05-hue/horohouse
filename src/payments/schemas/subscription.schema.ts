import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type SubscriptionDocument = Subscription & Document;

export enum BillingCycle {
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  YEARLY = 'yearly',
}

export enum SubscriptionPlan {
  // STUDENT
  STUDENT_FREE = 'student_free',

  // USER
  USER_FREE = 'user_free',
  USER_PREMIUM = 'user_premium',

  // AGENT
  AGENT_FREE = 'agent_free',
  AGENT_BASIC = 'agent_basic',
  AGENT_PRO = 'agent_pro',
  AGENT_ELITE = 'agent_elite',

  // LANDLORD
  LANDLORD_FREE = 'landlord_free',
  LANDLORD_BASIC = 'landlord_basic',
  LANDLORD_PRO = 'landlord_pro',

  // HOST
  HOST_FREE = 'host_free',
  HOST_STARTER = 'host_starter',
  HOST_GROWTH = 'host_growth',
  HOST_PRO = 'host_pro',
  HOST_ELITE = 'host_elite',
}

export enum SubscriptionStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled',
  SUSPENDED = 'suspended',
}

export type SubscriptionFeatures = {
  // Generic fields
  maxListings?: number;
  maxActiveListings?: number;
  canBoostListings?: boolean;
  boostsPerMonth?: number;
  prioritySupport?: boolean;
  analytics?: boolean;
  apiAccess?: boolean;
  teamMembers?: number;
  virtualTours?: boolean;
  professionalPhotography?: boolean;
  featuredListings?: number;
  socialMediaIntegration?: boolean;
  leadGeneration?: boolean;
  whiteLabel?: boolean;
  // Landlord / Host specific fields
  role?: 'landlord' | 'agent' | 'student' | 'user' | 'host';
  maxProperties?: number;       // -1 = unlimited
  bookingCalendar?: boolean;
  shortTermRentalSupport?: boolean;
  smartPricing?: boolean;       // AI-based pricing
  maintenanceTracking?: boolean;
  premiumVisibility?: boolean;
  dedicatedSupport?: boolean;
  [key: string]: any;
};

@Schema({ timestamps: true })
export class Subscription {
  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  userId: Types.ObjectId;

  @Prop({ required: true, type: String, enum: SubscriptionPlan })
  plan: SubscriptionPlan;

  @Prop({ required: true, type: String, enum: SubscriptionStatus, default: SubscriptionStatus.PENDING })
  status: SubscriptionStatus;

  @Prop({ type: String, enum: BillingCycle, required: true })
  billingCycle: BillingCycle;

  @Prop({ required: true })
  price: number;

  @Prop({ default: 'XAF' })
  currency: string;

  @Prop({ type: Object, required: true })
  features: SubscriptionFeatures;

  @Prop()
  startDate?: Date;

  @Prop()
  endDate?: Date;

  @Prop()
  nextBillingDate?: Date;

  @Prop({ default: true })
  autoRenew: boolean;

  // Usage tracking
  @Prop({ default: 0 })
  listingsUsed: number;

  @Prop({ default: 0 })
  boostsUsed: number;

  // Payment tracking
  @Prop({ type: Types.ObjectId, ref: 'Transaction' })
  lastPaymentTransactionId?: Types.ObjectId;

  @Prop()
  lastPaymentDate?: Date;

  // Cancellation details
  @Prop()
  cancelledAt?: Date;

  @Prop()
  cancellationReason?: string;

  /**
   * Set when a user cancels but elects to remain active until the end of
   * the current billing period (cancelImmediately = false).
   * The expiration cron uses autoRenew=false to expire the subscription;
   * this field makes the scheduled intent explicit and queryable.
   */
  @Prop()
  scheduledCancellationDate?: Date;

  // Upgrade/downgrade tracking
  @Prop({ type: Types.ObjectId, ref: 'Subscription' })
  previousSubscriptionId?: Types.ObjectId;

  @Prop({ type: String, enum: SubscriptionPlan })
  upgradedFrom?: SubscriptionPlan;

  @Prop()
  providerSubscriptionId?: string;

  @Prop({ type: Object })
  metadata?: Record<string, any>;

  createdAt: Date;
  updatedAt: Date;
}

export const SubscriptionSchema = SchemaFactory.createForClass(Subscription);

// Indexes
SubscriptionSchema.index({ userId: 1 });
SubscriptionSchema.index({ plan: 1, status: 1 });
SubscriptionSchema.index({ status: 1, endDate: 1 });
SubscriptionSchema.index({ scheduledCancellationDate: 1 }, { sparse: true }); // for querying pending cancellations