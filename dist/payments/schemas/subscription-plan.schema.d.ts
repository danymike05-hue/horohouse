import { Document } from 'mongoose';
import { SubscriptionFeatures, SubscriptionPlan } from './subscription.schema';
import { BillingCycle } from './transaction.schema';
export type SubscriptionPlanDocument = SubscriptionPlanModel & Document;
export declare class SubscriptionPlanModel {
    name: SubscriptionPlan;
    displayName: string;
    description: string;
    highlights: string[];
    pricing: {
        [BillingCycle.MONTHLY]?: number;
        [BillingCycle.QUARTERLY]?: number;
        [BillingCycle.YEARLY]?: number;
    };
    currency: string;
    features: SubscriptionFeatures;
    hasTrialPeriod: boolean;
    trialDurationDays?: number;
    isActive: boolean;
    isPublic: boolean;
    displayOrder: number;
    currentDiscount?: number;
    discountEndDate?: Date;
    isPopular: boolean;
    metadata?: {
        color?: string;
        icon?: string;
        badge?: string;
        [key: string]: any;
    };
    createdAt: Date;
    updatedAt: Date;
}
export declare const SubscriptionPlanSchema: import("mongoose").Schema<SubscriptionPlanModel, import("mongoose").Model<SubscriptionPlanModel, any, any, any, Document<unknown, any, SubscriptionPlanModel, any, {}> & SubscriptionPlanModel & {
    _id: import("mongoose").Types.ObjectId;
} & {
    __v: number;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, SubscriptionPlanModel, Document<unknown, {}, import("mongoose").FlatRecord<SubscriptionPlanModel>, {}, import("mongoose").DefaultSchemaOptions> & import("mongoose").FlatRecord<SubscriptionPlanModel> & {
    _id: import("mongoose").Types.ObjectId;
} & {
    __v: number;
}>;
