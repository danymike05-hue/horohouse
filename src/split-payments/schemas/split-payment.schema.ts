import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type SplitPaymentDocument = SplitPayment & Document;

// ─── Enums ────────────────────────────────────────────────────────────────────

export enum SplitPaymentStatus {
  /** Ledger created, no payments received yet */
  PENDING    = 'pending',
  /** At least one tenant has paid their share this cycle */
  PARTIAL    = 'partial',
  /** All tenants have paid — landlord disbursement ready */
  COMPLETE   = 'complete',
  /** Landlord has been paid out for this cycle */
  DISBURSED  = 'disbursed',
  /** One or more tenants overdue */
  OVERDUE    = 'overdue',
}

export enum TenantShareStatus {
  UNPAID    = 'unpaid',
  PAID      = 'paid',
  OVERDUE   = 'overdue',
  WAIVED    = 'waived',
}

export enum MoMoProvider {
  MTN  = 'mtn',
  ORANGE = 'orange',
}

// ─── Sub-documents ────────────────────────────────────────────────────────────

export interface TenantShare {
  /** References the User document for this tenant */
  tenantUserId: Types.ObjectId;
  tenantName: string;
  tenantPhone?: string;
  /** Amount this tenant owes for the cycle in XAF */
  amountDue: number;
  /** Amount actually received (may differ if partial payment) */
  amountPaid: number;
  status: TenantShareStatus;
  /** MoMo phone number used to receive the payment request */
  momoPhone?: string;
  momoProvider?: MoMoProvider;
  /** External MoMo transaction reference returned by the gateway */
  momoTransactionId?: string;
  paidAt?: Date;
  dueDate: Date;
}

// ─── Schema ───────────────────────────────────────────────────────────────────

/**
 * SplitPayment
 *
 * One document per billing cycle per property.
 * Tracks each tenant's share independently so partial payments are visible.
 * When all shares reach PAID → status flips to COMPLETE → disbursement to landlord.
 */
@Schema({ timestamps: true })
export class SplitPayment {
  @Prop({ type: Types.ObjectId, ref: 'Property', required: true, index: true })
  propertyId: Types.ObjectId;

  /** The lease this payment cycle belongs to */
  @Prop({ type: Types.ObjectId, ref: 'DigitalLease', required: true, index: true })
  leaseId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  landlordUserId: Types.ObjectId;

  /** Human-readable label e.g. "September 2025" */
  @Prop({ required: true, trim: true })
  cycleLabel: string;

  /** First day of the billing cycle */
  @Prop({ required: true, index: true })
  cycleStart: Date;

  /** Last day of the billing cycle */
  @Prop({ required: true })
  cycleEnd: Date;

  /** Total rent for the property this cycle in XAF */
  @Prop({ required: true, min: 0 })
  totalRent: number;

  /** Per-tenant breakdown */
  @Prop({
    type: [
      {
        tenantUserId: { type: Types.ObjectId, ref: 'User', required: true },
        tenantName: { type: String, required: true },
        tenantPhone: { type: String },
        amountDue: { type: Number, required: true, min: 0 },
        amountPaid: { type: Number, default: 0, min: 0 },
        status: {
          type: String,
          enum: Object.values(TenantShareStatus),
          default: TenantShareStatus.UNPAID,
        },
        momoPhone: { type: String },
        momoProvider: { type: String, enum: Object.values(MoMoProvider) },
        momoTransactionId: { type: String },
        paidAt: { type: Date },
        dueDate: { type: Date, required: true },
      },
    ],
    required: true,
  })
  tenantShares: TenantShare[];

  @Prop({
    type: String,
    enum: Object.values(SplitPaymentStatus),
    default: SplitPaymentStatus.PENDING,
    index: true,
  })
  status: SplitPaymentStatus;

  /** Running total of what has been collected across all tenants */
  @Prop({ default: 0, min: 0 })
  totalCollected: number;

  /** Date the landlord was paid out */
  @Prop()
  disbursedAt?: Date;

  /** MoMo transaction ID for the landlord disbursement */
  @Prop()
  disbursementTransactionId?: string;

  createdAt: Date;
  updatedAt: Date;
}

export const SplitPaymentSchema = SchemaFactory.createForClass(SplitPayment);

SplitPaymentSchema.index({ leaseId: 1, cycleStart: 1 }, { unique: true });
SplitPaymentSchema.index({ landlordUserId: 1, status: 1, cycleStart: -1 });
SplitPaymentSchema.index({ 'tenantShares.tenantUserId': 1, status: 1 });
// Cron index: find overdue unpaid shares
SplitPaymentSchema.index({ status: 1, 'tenantShares.dueDate': 1 });