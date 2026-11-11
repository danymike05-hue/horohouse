import { Document, Types } from 'mongoose';
export type TransactionDocument = Transaction & Document;
export declare enum TransactionType {
    SUBSCRIPTION = "subscription",
    LISTING_FEE = "listing_fee",
    BOOST_LISTING = "boost_listing",
    COMMISSION = "commission",
    DIGITAL_SERVICE = "digital_service",
    REFUND = "refund",
    WALLET_TOPUP = "wallet_topup",
    WALLET_WITHDRAWAL = "wallet_withdrawal",
    BOOKING = "booking"
}
export declare enum TransactionStatus {
    PENDING = "pending",
    SUCCESS = "success",
    FAILED = "failed",
    CANCELLED = "cancelled",
    REFUNDED = "refunded"
}
export declare enum PaymentMethod {
    MTN_MOMO = "mtn_momo",
    ORANGE_MONEY = "orange_money",
    CARD = "card",
    BANK_TRANSFER = "bank_transfer",
    WALLET = "wallet"
}
export declare enum Currency {
    XAF = "XAF",
    XOF = "XOF",
    USD = "USD",
    EUR = "EUR"
}
export declare enum BillingCycle {
    MONTHLY = "monthly",
    QUARTERLY = "quarterly",
    YEARLY = "yearly"
}
export declare class Transaction {
    userId: Types.ObjectId;
    amount: number;
    currency: Currency;
    type: TransactionType;
    status: TransactionStatus;
    paymentMethod: PaymentMethod;
    flutterwaveTransactionId?: string;
    flutterwaveReference?: string;
    flutterwavePaymentLink?: string;
    paymentProviderResponse?: Record<string, any>;
    propertyId?: Types.ObjectId;
    bookingId?: Types.ObjectId;
    subscriptionId?: Types.ObjectId;
    boostId?: Types.ObjectId;
    description?: string;
    metadata?: {
        serviceName?: string;
        duration?: string;
        planName?: string;
        propertyTitle?: string;
        [key: string]: any;
    };
    platformFee?: number;
    paymentProcessingFee?: number;
    netAmount?: number;
    customerName?: string;
    customerEmail?: string;
    customerPhone?: string;
    refundedAt?: Date;
    refundReason?: string;
    refundTransactionId?: Types.ObjectId;
    failureReason?: string;
    retryCount?: number;
    completedAt?: Date;
    cancelledAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}
export declare const TransactionSchema: import("mongoose").Schema<Transaction, import("mongoose").Model<Transaction, any, any, any, Document<unknown, any, Transaction, any, {}> & Transaction & {
    _id: Types.ObjectId;
} & {
    __v: number;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, Transaction, Document<unknown, {}, import("mongoose").FlatRecord<Transaction>, {}, import("mongoose").DefaultSchemaOptions> & import("mongoose").FlatRecord<Transaction> & {
    _id: Types.ObjectId;
} & {
    __v: number;
}>;
