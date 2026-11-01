import { Document, Types } from 'mongoose';
export type SubscriptionDocument = Subscription & Document;
export declare enum BillingCycle {
    WEEKLY = "weekly",
    MONTHLY = "monthly",
    QUARTERLY = "quarterly",
    YEARLY = "yearly"
}
export declare enum SubscriptionPlan {
    STUDENT_FREE = "student_free",
    USER_FREE = "user_free",
    USER_PREMIUM = "user_premium",
    AGENT_FREE = "agent_free",
    AGENT_BASIC = "agent_basic",
    AGENT_PRO = "agent_pro",
    AGENT_ELITE = "agent_elite",
    LANDLORD_FREE = "landlord_free",
    LANDLORD_BASIC = "landlord_basic",
    LANDLORD_PRO = "landlord_pro",
    HOST_FREE = "host_free",
    HOST_STARTER = "host_starter",
    HOST_GROWTH = "host_growth",
    HOST_PRO = "host_pro",
    HOST_ELITE = "host_elite"
}
export declare enum SubscriptionStatus {
    PENDING = "pending",
    ACTIVE = "active",
    EXPIRED = "expired",
    CANCELLED = "cancelled",
    SUSPENDED = "suspended"
}
export type SubscriptionFeatures = {
    maxListings?: number;
    maxActiveListings?: number;
    canBoostListings?: boolean;
    boostsPerMonth?: number;
    prioritySupport?: boolean;
    analytics?: boolean;
    apiAccess?: boolean;
    teamMembers?: number;
    virtualTours?: boolean;
    professionalPhotography?: boolean;
    featuredListings?: number;
    socialMediaIntegration?: boolean;
    leadGeneration?: boolean;
    whiteLabel?: boolean;
    role?: 'landlord' | 'agent' | 'student' | 'user' | 'host';
    maxProperties?: number;
    bookingCalendar?: boolean;
    shortTermRentalSupport?: boolean;
    smartPricing?: boolean;
    maintenanceTracking?: boolean;
    premiumVisibility?: boolean;
    dedicatedSupport?: boolean;
    [key: string]: any;
};
export declare class Subscription {
    userId: Types.ObjectId;
    plan: SubscriptionPlan;
    status: SubscriptionStatus;
    billingCycle: BillingCycle;
    price: number;
    currency: string;
    features: SubscriptionFeatures;
    startDate?: Date;
    endDate?: Date;
    nextBillingDate?: Date;
    autoRenew: boolean;
    listingsUsed: number;
    boostsUsed: number;
    lastPaymentTransactionId?: Types.ObjectId;
    lastPaymentDate?: Date;
    cancelledAt?: Date;
    cancellationReason?: string;
    scheduledCancellationDate?: Date;
    previousSubscriptionId?: Types.ObjectId;
    upgradedFrom?: SubscriptionPlan;
    providerSubscriptionId?: string;
    metadata?: Record<string, any>;
    createdAt: Date;
    updatedAt: Date;
}
export declare const SubscriptionSchema: import("mongoose").Schema<Subscription, import("mongoose").Model<Subscription, any, any, any, Document<unknown, any, Subscription, any, {}> & Subscription & {
    _id: Types.ObjectId;
} & {
    __v: number;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, Subscription, Document<unknown, {}, import("mongoose").FlatRecord<Subscription>, {}, import("mongoose").DefaultSchemaOptions> & import("mongoose").FlatRecord<Subscription> & {
    _id: Types.ObjectId;
} & {
    __v: number;
}>;
