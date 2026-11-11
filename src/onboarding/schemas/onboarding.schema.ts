import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type OnboardingDocument = Onboarding & Document;

export interface PropertyPreferences {
  propertyType: string[];
  budget: {
    min: number;
    max: number;
    currency: string;
  };
  location: string[];
  bedrooms: number[];
  bathrooms: number[];
  features: string[];
}

export interface AgentPreferences {
  licenseNumber: string;
  agency: string;
  experience: number;
  specializations: string[];
  serviceAreas: string[];
}

@Schema({ timestamps: true })
export class Onboarding {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, unique: true })
  userId: Types.ObjectId;

  @Prop({ required: true, default: false })
  isCompleted: boolean;

  @Prop({ required: true, default: 0 })
  currentStep: number;

  @Prop({ type: Number, default: 0 })
  totalSteps: number;

  @Prop({ type: Object })
  propertyPreferences?: PropertyPreferences;

  @Prop({ type: Object })
  agentPreferences?: AgentPreferences;

  @Prop({ type: [String], default: [] })
  completedSteps: string[];

  @Prop({ type: Date })
  completedAt?: Date;

  @Prop({ type: Date })
  lastActivityAt: Date;

  @Prop({ type: Boolean, default: false })
  welcomeEmailSent: boolean;

  @Prop({ type: Boolean, default: false })
  completionEmailSent: boolean;
}

export const OnboardingSchema = SchemaFactory.createForClass(Onboarding);

// Index for faster queries
OnboardingSchema.index({ isCompleted: 1 });
OnboardingSchema.index({ lastActivityAt: 1 });
