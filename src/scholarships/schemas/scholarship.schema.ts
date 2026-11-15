import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export const SCHOLARSHIP_LEVELS = ['bachelor', 'master', 'phd', 'diploma'] as const;
export type ScholarshipLevel = (typeof SCHOLARSHIP_LEVELS)[number];

export const PROVIDER_TYPES = ['government', 'university', 'foundation', 'company', 'other'] as const;

/** What a scholarship pays for */
@Schema({ _id: false })
export class ScholarshipCoverage {
  @Prop({ default: false }) fullyFunded: boolean;
  @Prop({ default: false }) tuition: boolean;
  @Prop({ default: false }) housing: boolean;
  @Prop({ default: false }) allowance: boolean;
  @Prop({ default: false }) flights: boolean;
  /** Free text, e.g. "€1,200 a month" or "Up to 2,000,000 FCFA a year" */
  @Prop({ trim: true }) amountText?: string;
}
export const ScholarshipCoverageSchema = SchemaFactory.createForClass(ScholarshipCoverage);

/**
 * A scholarship or grant, entered by an admin from its official source. Students only see
 * published ones whose deadline hasn't passed (no deadline = open all year).
 */
@Schema({ timestamps: true })
export class Scholarship {
  @Prop({ required: true, trim: true }) title: string;
  @Prop({ required: true, trim: true }) provider: string;
  @Prop({ enum: PROVIDER_TYPES, default: 'other' }) providerType: string;
  @Prop({ trim: true }) description?: string;

  @Prop({ type: [String], enum: SCHOLARSHIP_LEVELS, default: [], index: true }) levels: ScholarshipLevel[];
  /** Fields of study, e.g. "Engineering", "Medicine". Empty = any field */
  @Prop({ type: [String], default: [] }) fields: string[];

  /** Where the studies take place */
  @Prop({ required: true, trim: true, index: true }) destinationCountry: string;
  @Prop({ trim: true }) destinationCity?: string;
  /** Who can apply. Empty = any nationality */
  @Prop({ type: [String], default: [] }) eligibleNationalities: string[];

  @Prop({ type: ScholarshipCoverageSchema, default: () => ({}) }) coverage: ScholarshipCoverage;

  /** Application deadline; none = rolling / all year */
  @Prop({ index: true }) deadline?: Date;
  @Prop({ trim: true }) language?: string;
  @Prop({ type: [String], default: [] }) requirements: string[];
  @Prop({ type: [String], default: [] }) documents: string[];

  /** Official page where students apply */
  @Prop({ required: true, trim: true }) applyUrl: string;
  /** Where the details were checked, if different */
  @Prop({ trim: true }) sourceUrl?: string;
  /** When an admin last checked the details against the source */
  @Prop({ default: () => new Date() }) lastCheckedAt: Date;

  @Prop({ default: false, index: true }) isPublished: boolean;
  @Prop({ type: Types.ObjectId, ref: 'User' }) createdBy?: Types.ObjectId;
}

export type ScholarshipDocument = Scholarship & Document;
export const ScholarshipSchema = SchemaFactory.createForClass(Scholarship);
ScholarshipSchema.index({ isPublished: 1, deadline: 1 });

/** A scholarship a user saved; the two flags make each deadline reminder go out once */
@Schema({ timestamps: true })
export class SavedScholarship {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true }) userId: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'Scholarship', required: true, index: true }) scholarshipId: Types.ObjectId;
  @Prop({ default: false }) reminded14: boolean;
  @Prop({ default: false }) reminded3: boolean;
}

export type SavedScholarshipDocument = SavedScholarship & Document;
export const SavedScholarshipSchema = SchemaFactory.createForClass(SavedScholarship);
SavedScholarshipSchema.index({ userId: 1, scholarshipId: 1 }, { unique: true });
