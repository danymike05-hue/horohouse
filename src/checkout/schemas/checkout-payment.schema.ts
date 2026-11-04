import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type CheckoutMethod = 'mobile_money' | 'card';
export type MomoOperator = 'orange_money' | 'mtn_momo';
export type CheckoutStatus = 'pending' | 'paid' | 'failed' | 'expired';

export const CHECKOUT_STATUSES: CheckoutStatus[] = ['pending', 'paid', 'failed', 'expired'];

/**
 * One row per payment attempt. A booking can have several attempts
 * (failed → retry), but at most ONE pending attempt at a time (partial unique index).
 *
 * Lifecycle:
 *   pending ──webhook completed──▶ paid
 *   pending ──webhook failed / user cancel──▶ failed
 *   pending ──expiry job──▶ expired
 *   failed | expired ──late webhook completed──▶ paid   (money really moved; never ignore it)
 */
@Schema({ collection: 'checkout_payments', timestamps: true })
export class CheckoutPayment {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  bookingId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ type: String, enum: ['mobile_money', 'card'], required: true })
  method!: CheckoutMethod;

  /** Mobile Money only. */
  @Prop({ type: String, enum: ['orange_money', 'mtn_momo'] })
  operator?: MomoOperator;

  /** Mobile Money only — 9 local digits, no +237. */
  @Prop({ type: String })
  phone?: string;

  /** Always computed server-side from the booking, never trusted from the client. */
  @Prop({ type: Number, required: true, min: 1 })
  amount!: number;

  @Prop({ type: String, enum: ['XAF'], default: 'XAF' })
  currency!: 'XAF';

  @Prop({ type: String, enum: CHECKOUT_STATUSES, default: 'pending', index: true })
  status!: CheckoutStatus;

  /** Our reference sent to CamerPay as merchant_invoice_id ("HH-<_id>"). */
  @Prop({ type: String, required: true, unique: true })
  merchantInvoiceId!: string;

  /** CamerPay transaction_uuid. */
  @Prop({ type: String })
  providerReference?: string;

  /** Last raw status seen from CamerPay (pending/processing/completed/failed/cancelled/refunded). */
  @Prop({ type: String })
  providerStatus?: string;

  /** CamerPay hosted page (card checkout, or Mobile Money fallback). */
  @Prop({ type: String })
  payUrl?: string;

  /** Where the app/browser is sent after the hosted page (validated allowlist). */
  @Prop({ type: String })
  appReturnUrl?: string;

  @Prop({ type: Date, required: true })
  expiresAt!: Date;

  @Prop({ type: Date }) paidAt?: Date;
  @Prop({ type: Date }) failedAt?: Date;
  @Prop({ type: Date }) expiredAt?: Date;
  @Prop({ type: Date }) refundedAt?: Date;
  /** Set once the booking has been confirmed for this payment (makes fulfilment retry-safe). */
  @Prop({ type: Date }) fulfilledAt?: Date;
  /** Short-lived lock so two concurrent webhooks can't both credit the host wallet. */
  @Prop({ type: Date }) fulfillingAt?: Date;
  @Prop({ type: Date }) lastWebhookAt?: Date;

  @Prop({ type: String })
  failureReason?: string;

  /** Something needs a human: amount mismatch, duplicate payment, paid after booking closed… */
  @Prop({ type: Boolean, default: false, index: true })
  needsReview!: boolean;

  @Prop({ type: String })
  reviewReason?: string;

  createdAt?: Date;
  updatedAt?: Date;
}

export type CheckoutPaymentDocument = HydratedDocument<CheckoutPayment>;
export const CheckoutPaymentSchema = SchemaFactory.createForClass(CheckoutPayment);

CheckoutPaymentSchema.index({ providerReference: 1 }, { unique: true, sparse: true });
CheckoutPaymentSchema.index({ status: 1, expiresAt: 1 });
// At most one pending attempt per booking — protects against double taps / two devices.
CheckoutPaymentSchema.index(
  { bookingId: 1 },
  { unique: true, partialFilterExpression: { status: 'pending' }, name: 'one_pending_per_booking' },
);
