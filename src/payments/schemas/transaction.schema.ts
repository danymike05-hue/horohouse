import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type TransactionDocument = Transaction & Document;

export enum TransactionType {
  SUBSCRIPTION      = 'subscription',
  LISTING_FEE       = 'listing_fee',
  BOOST_LISTING     = 'boost_listing',
  COMMISSION        = 'commission',
  DIGITAL_SERVICE   = 'digital_service',
  REFUND            = 'refund',
  WALLET_TOPUP      = 'wallet_topup',
  WALLET_WITHDRAWAL = 'wallet_withdrawal',
  BOOKING           = 'booking',           // ← ADDED
}

export enum TransactionStatus {
  PENDING   = 'pending',
  SUCCESS   = 'success',
  FAILED    = 'failed',
  CANCELLED = 'cancelled',
  REFUNDED  = 'refunded',
}

export enum PaymentMethod {
  MTN_MOMO      = 'mtn_momo',
  ORANGE_MONEY  = 'orange_money',
  CARD          = 'card',
  BANK_TRANSFER = 'bank_transfer',
  WALLET        = 'wallet',
}

export enum Currency {
  XAF = 'XAF',
  XOF = 'XOF',
  USD = 'USD',
  EUR = 'EUR',
}

export enum BillingCycle {
  MONTHLY   = 'monthly',
  QUARTERLY = 'quarterly',
  YEARLY    = 'yearly',
}

@Schema({ timestamps: true })
export class Transaction {
  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  userId: Types.ObjectId;

  @Prop({ required: true })
  amount: number;

  @Prop({ type: String, enum: Currency, default: Currency.XAF })
  currency: Currency;

  @Prop({ type: String, enum: TransactionType, required: true })
  type: TransactionType;

  @Prop({ type: String, enum: TransactionStatus, default: TransactionStatus.PENDING })
  status: TransactionStatus;

  @Prop({ type: String, enum: PaymentMethod, required: true })
  paymentMethod: PaymentMethod;

  // Flutterwave specific fields
  @Prop({ unique: true, sparse: true })
  flutterwaveTransactionId?: string;

  @Prop()
  flutterwaveReference?: string;

  @Prop()
  flutterwavePaymentLink?: string;

  // Payment provider response
  @Prop({ type: Object })
  paymentProviderResponse?: Record<string, any>;

  // Related entities
  @Prop({ type: Types.ObjectId, ref: 'Property' })
  propertyId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Booking' })  // ← ADDED
  bookingId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Subscription' })
  subscriptionId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'ListingBoost' })
  boostId?: Types.ObjectId;

  // Transaction details
  @Prop()
  description?: string;

  @Prop({ type: Object })
  metadata?: {
    serviceName?: string;
    duration?: string;
    planName?: string;
    propertyTitle?: string;
    [key: string]: any;
  };

  // Fee breakdown
  @Prop()
  platformFee?: number;

  @Prop()
  paymentProcessingFee?: number;

  @Prop()
  netAmount?: number;

  // Customer details
  @Prop()
  customerName?: string;

  @Prop()
  customerEmail?: string;

  @Prop()
  customerPhone?: string;

  // Refund details
  @Prop()
  refundedAt?: Date;

  @Prop()
  refundReason?: string;

  @Prop({ type: Types.ObjectId, ref: 'Transaction' })
  refundTransactionId?: Types.ObjectId;

  // Failure details
  @Prop()
  failureReason?: string;

  @Prop({ default: 0 })
  retryCount?: number;

  // Timestamps
  @Prop()
  completedAt?: Date;

  @Prop()
  cancelledAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

export const TransactionSchema = SchemaFactory.createForClass(Transaction);

// Indexes
TransactionSchema.index({ userId: 1, createdAt: -1 });
TransactionSchema.index({ status: 1, createdAt: -1 });
TransactionSchema.index({ flutterwaveTransactionId: 1 });
TransactionSchema.index({ flutterwaveReference: 1 });
TransactionSchema.index({ type: 1, status: 1 });
TransactionSchema.index({ createdAt: -1 });
TransactionSchema.index({ propertyId: 1, status: 1 });
TransactionSchema.index({ subscriptionId: 1 });
TransactionSchema.index({ bookingId: 1 });              // ← ADDED