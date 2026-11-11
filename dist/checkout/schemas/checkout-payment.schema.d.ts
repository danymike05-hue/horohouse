import { HydratedDocument, Types } from 'mongoose';
export type CheckoutMethod = 'mobile_money' | 'card' | 'wallet' | 'plan_credit';
export declare const CHECKOUT_METHODS: CheckoutMethod[];
export type CheckoutPurpose = 'booking' | 'subscription' | 'boost';
export interface CheckoutPurchase {
    label?: string;
    planName?: string;
    billingCycle?: 'monthly' | 'quarterly' | 'yearly';
    propertyId?: string;
    propertyTitle?: string;
    boostType?: string;
    duration?: number;
    transactionId?: string;
    subscriptionId?: string;
    boostId?: string;
    endsAt?: Date;
}
export type MomoOperator = 'orange_money' | 'mtn_momo';
export type CheckoutStatus = 'pending' | 'paid' | 'failed' | 'expired';
export declare const CHECKOUT_STATUSES: CheckoutStatus[];
export type ReviewState = 'open' | 'refunding' | 'resolved';
export type ReviewResolution = 'refunded_camerpay' | 'refunded_manually' | 'no_refund_needed';
export declare class CheckoutPayment {
    purpose: CheckoutPurpose;
    bookingId?: Types.ObjectId;
    purchase?: CheckoutPurchase;
    purchaseKey?: string;
    userId: Types.ObjectId;
    method: CheckoutMethod;
    operator?: MomoOperator;
    phone?: string;
    amount: number;
    currency: 'XAF';
    status: CheckoutStatus;
    merchantInvoiceId: string;
    providerReference?: string;
    providerStatus?: string;
    payUrl?: string;
    appReturnUrl?: string;
    expiresAt: Date;
    paidAt?: Date;
    failedAt?: Date;
    expiredAt?: Date;
    refundedAt?: Date;
    fulfilledAt?: Date;
    fulfillingAt?: Date;
    lastWebhookAt?: Date;
    failureReason?: string;
    needsReview: boolean;
    reviewReason?: string;
    reviewState?: ReviewState;
    reviewResolution?: ReviewResolution;
    refundAmount?: number;
    reviewNote?: string;
    reviewedBy?: Types.ObjectId;
    reviewedByName?: string;
    reviewedAt?: Date;
    reviewError?: string;
    createdAt?: Date;
    updatedAt?: Date;
}
export type CheckoutPaymentDocument = HydratedDocument<CheckoutPayment>;
export declare const CheckoutPaymentSchema: import("mongoose").Schema<CheckoutPayment, import("mongoose").Model<CheckoutPayment, any, any, any, import("mongoose").Document<unknown, any, CheckoutPayment, any, {}> & CheckoutPayment & {
    _id: Types.ObjectId;
} & {
    __v: number;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, CheckoutPayment, import("mongoose").Document<unknown, {}, import("mongoose").FlatRecord<CheckoutPayment>, {}, import("mongoose").DefaultSchemaOptions> & import("mongoose").FlatRecord<CheckoutPayment> & {
    _id: Types.ObjectId;
} & {
    __v: number;
}>;
