import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type DigitalLeaseDocument = DigitalLease & Document;

// ─── Enums ────────────────────────────────────────────────────────────────────

export enum LeaseStatus {
  /** Generated but not yet signed by both parties */
  DRAFT      = 'draft',
  /** Landlord has signed, waiting for tenant(s) */
  PENDING_TENANT = 'pending_tenant',
  /** All parties have signed — lease is live */
  ACTIVE     = 'active',
  /** Lease has naturally expired (end date passed) */
  EXPIRED    = 'expired',
  /** Terminated early by either party */
  TERMINATED = 'terminated',
}

export enum ConditionRating {
  EXCELLENT = 'excellent',
  GOOD      = 'good',
  FAIR      = 'fair',
  POOR      = 'poor',
}

// ─── Sub-documents ────────────────────────────────────────────────────────────

export interface LeaseTenant {
  tenantUserId: Types.ObjectId;
  tenantName: string;
  tenantEmail?: string;
  tenantPhone?: string;
  /** Cloudinary URL of the tenant's signature (base64 PNG drawn in-browser) */
  signatureUrl?: string;
  signedAt?: Date;
  /** Share of monthly rent this tenant is responsible for in XAF */
  rentShare: number;
}

export interface ConditionItem {
  /** e.g. "Front door", "Kitchen sink", "Living room floor" */
  label: string;
  rating: ConditionRating;
  notes?: string;
  /** Cloudinary URLs of photos taken at move-in */
  photoUrls: string[];
}

export interface ConditionLog {
  /** Logged by this user (landlord or agent) */
  loggedByUserId: Types.ObjectId;
  loggedAt: Date;
  items: ConditionItem[];
  /** Overall notes for the move-in/move-out inspection */
  overallNotes?: string;
  type: 'move_in' | 'move_out';
}

// ─── Schema ───────────────────────────────────────────────────────────────────

@Schema({ timestamps: true })
export class DigitalLease {
  @Prop({ type: Types.ObjectId, ref: 'Property', required: true, index: true })
  propertyId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  landlordUserId: Types.ObjectId;

  /** One or more tenants on this lease (supports colocation) */
  @Prop({
    type: [
      {
        tenantUserId: { type: Types.ObjectId, ref: 'User', required: true },
        tenantName: { type: String, required: true },
        tenantEmail: { type: String },
        tenantPhone: { type: String },
        signatureUrl: { type: String },
        signedAt: { type: Date },
        rentShare: { type: Number, required: true, min: 0 },
      },
    ],
    required: true,
  })
  tenants: LeaseTenant[];

  @Prop({ required: true })
  leaseStart: Date;

  @Prop({ required: true })
  leaseEnd: Date;

  /** Total monthly rent for the property in XAF */
  @Prop({ required: true, min: 0 })
  monthlyRent: number;

  /** Security deposit in XAF */
  @Prop({ default: 0, min: 0 })
  depositAmount: number;

  /** Number of months paid in advance */
  @Prop({ default: 1, min: 1, max: 12 })
  advanceMonths: number;

  @Prop({
    type: String,
    enum: Object.values(LeaseStatus),
    default: LeaseStatus.DRAFT,
    index: true,
  })
  status: LeaseStatus;

  /** Cloudinary URL of the landlord's signature */
  @Prop()
  landlordSignatureUrl?: string;

  @Prop()
  landlordSignedAt?: Date;

  /**
   * Free-text lease clauses generated from HoroHouse's standard template.
   * Stored as a JSON-serialisable array of clause objects so the
   * frontend can render them as a formatted document without parsing HTML.
   */
  @Prop({ type: [Object], default: [] })
  clauses: Array<{ heading: string; body: string }>;

  /**
   * Custom clauses added by the landlord on top of the standard template.
   */
  @Prop({ type: [Object], default: [] })
  customClauses: Array<{ heading: string; body: string }>;

  /**
   * Move-in and move-out condition logs.
   * Stored chronologically — first entry is move-in, last is move-out.
   * Photo evidence is attached per item via Cloudinary URLs.
   */
  @Prop({
    type: [
      {
        loggedByUserId: { type: Types.ObjectId, ref: 'User', required: true },
        loggedAt: { type: Date, required: true },
        type: { type: String, enum: ['move_in', 'move_out'], required: true },
        overallNotes: { type: String },
        items: [
          {
            label: { type: String, required: true },
            rating: {
              type: String,
              enum: Object.values(ConditionRating),
              required: true,
            },
            notes: { type: String },
            photoUrls: [{ type: String }],
          },
        ],
      },
    ],
    default: [],
  })
  conditionLogs: ConditionLog[];

  /** Reason provided when a lease is terminated early */
  @Prop()
  terminationReason?: string;

  @Prop()
  terminatedAt?: Date;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  terminatedByUserId?: Types.ObjectId;

  createdAt: Date;
  updatedAt: Date;
}

export const DigitalLeaseSchema = SchemaFactory.createForClass(DigitalLease);

DigitalLeaseSchema.index({ landlordUserId: 1, status: 1, leaseStart: -1 });
DigitalLeaseSchema.index({ 'tenants.tenantUserId': 1, status: 1 });
// Cron: find leases whose end date has passed
DigitalLeaseSchema.index({ status: 1, leaseEnd: 1 });