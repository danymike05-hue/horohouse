import { HydratedDocument, Types } from 'mongoose';
export type CheckoutMethod = 'mobile_money' | 'card';
export type MomoOperator = 'orange_money' | 'mtn_momo';
export type CheckoutStatus = 'pending' | 'paid' | 'failed' | 'expired';
export declare const CHECKOUT_STATUSES: CheckoutStatus[];
export declare class CheckoutPayment {
    bookingId: Types.ObjectId;
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
