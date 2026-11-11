import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

/** wallet = HoroHouse wallet balance; plan_credit = a free boost included in the host's plan */
export type CheckoutMethod = 'mobile_money' | 'card' | 'wallet' | 'plan_credit';
export const CHECKOUT_METHODS: CheckoutMethod[] = ['mobile_money', 'card', 'wallet', 'plan_credit'];
/** What the payment is for */
export type CheckoutPurpose = 'booking' | 'subscription' | 'boost' | 'date_change';

/** Subscription / boost details, fixed when the payment starts (price never comes from the app) */
export interface CheckoutPurchase {
  label?: string;
  planName?: string;
  billingCycle?: 'monthly' | 'quarterly' | 'yearly';
  propertyId?: string;
  propertyTitle?: string;
  boostType?: string;
  duration?: number; // hours
  /** Set during fulfilment, so a retry never activates twice */
  transactionId?: string;
  subscriptionId?: string;
  boostId?: string;
  endsAt?: Date;
  /** Date change: the request being paid for, and the booking it moves */
  changeId?: string;
  bookingId?: string;
  checkIn?: Date;
  checkOut?: Date;
}
export type MomoOperator = 'orange_money' | 'mtn_momo';
export type CheckoutStatus = 'pending' | 'paid' | 'failed' | 'expired';

export const CHECKOUT_STATUSES: CheckoutStatus[] = ['pending', 'paid', 'failed', 'expired'];

/** Admin follow-up of a flagged payment (admin "Payments to review") */
export type ReviewState = 'open' | 'refunding' | 'resolved';
export type ReviewResolution = 'refunded_camerpay' | 'refunded_manually' | 'no_refund_needed';

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
  @Prop({ type: String, enum: ['booking', 'subscription', 'boost', 'date_change'], default: 'booking', index: true })
  purpose!: CheckoutPurpose;

  /** Bookings only */
  @Prop({ type: Types.ObjectId, index: true })
  bookingId?: Types.ObjectId;

  /** Subscriptions / boosts only */
  @Prop({ type: Object })
  purchase?: CheckoutPurchase;

  /** One pending attempt per thing being bought: "sub:<userId>" or "boost:<propertyId>" */
  @Prop({ type: String })
  purchaseKey?: string;

  @Prop({ type: Types.ObjectId, required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ type: String, enum: CHECKOUT_METHODS, required: true })
  method!: CheckoutMethod;

  /** Mobile Money only. */
  @Prop({ type: String, enum: ['orange_money', 'mtn_momo'] })
  operator?: MomoOperator;

  /** Mobile Money only — 9 local digits, no +237. */
  @Prop({ type: String })
  phone?: string;

  /** Always computed server-side from the booking, never trusted from the client. */
  /** 0 only for a free boost included in the plan */
  @Prop({ type: Number, required: true, min: 0 })
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

  // ── Admin follow-up (set from the admin "Payments to review" screen) ──────
  /** open → refunding (CamerPay call in progress) → resolved */
  @Prop({ type: String, enum: ['open', 'refunding', 'resolved'] })
  reviewState?: ReviewState;

  @Prop({ type: String, enum: ['refunded_camerpay', 'refunded_manually', 'no_refund_needed'] })
  reviewResolution?: ReviewResolution;

  /** Amount given back to the guest (XAF) */
  @Prop({ type: Number })
  refundAmount?: number;

  @Prop({ type: String })
  reviewNote?: string;

  /** Who handled it (audit trail) */
  @Prop({ type: Types.ObjectId })
  reviewedBy?: Types.ObjectId;

  @Prop({ type: String })
  reviewedByName?: string;

  @Prop({ type: Date })
  reviewedAt?: Date;

  /** Last error from a refund attempt through CamerPay */
  @Prop({ type: String })
  reviewError?: string;

  createdAt?: Date;
  updatedAt?: Date;
}

export type CheckoutPaymentDocument = HydratedDocument<CheckoutPayment>;
export const CheckoutPaymentSchema = SchemaFactory.createForClass(CheckoutPayment);

CheckoutPaymentSchema.index({ providerReference: 1 }, { unique: true, sparse: true });
CheckoutPaymentSchema.index({ status: 1, expiresAt: 1 });
CheckoutPaymentSchema.index({ reviewState: 1, reviewedAt: -1 }, { sparse: true });
// At most one pending attempt per booking — protects against double taps / two devices.
// (v2: only rows that have a bookingId; the old index treated every purchase as the
// same "null" booking. CheckoutService drops the old one at startup.)
CheckoutPaymentSchema.index(
  { bookingId: 1 },
  {
    unique: true,
    partialFilterExpression: { status: 'pending', bookingId: { $exists: true } },
    name: 'one_pending_per_booking_v2',
  },
);
// Same for subscriptions / boosts
CheckoutPaymentSchema.index(
  { purchaseKey: 1 },
  {
    unique: true,
    partialFilterExpression: { status: 'pending', purchaseKey: { $exists: true } },
    name: 'one_pending_per_purchase',
  },
);
