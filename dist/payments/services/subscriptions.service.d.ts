import { Model } from 'mongoose';
import { OnModuleInit } from '@nestjs/common';
import { SubscriptionDocument } from '../schemas/subscription.schema';
import { SubscriptionPlanModel, SubscriptionPlanDocument } from '../schemas/subscription-plan.schema';
import { TransactionDocument } from '../schemas/transaction.schema';
import { CancelSubscriptionDto } from '../dto/payment.dto';
export declare class SubscriptionsService implements OnModuleInit {
    private subscriptionModel;
    private subscriptionPlanModel;
    private transactionModel;
    private readonly logger;
    constructor(subscriptionModel: Model<SubscriptionDocument>, subscriptionPlanModel: Model<SubscriptionPlanDocument>, transactionModel: Model<TransactionDocument>);
    onModuleInit(): Promise<void>;
    private initializeDefaultPlans;
    private getDefaultPlans;
    getPlans(): Promise<SubscriptionPlanModel[]>;
    getUserSubscription(userId: string): Promise<SubscriptionDocument | null>;
    getPendingSubscription(userId: string): Promise<SubscriptionDocument | null>;
    activateSubscription(transactionId: string): Promise<SubscriptionDocument>;
    cancelSubscription(userId: string, cancelDto: CancelSubscriptionDto): Promise<SubscriptionDocument>;
    checkUsageLimit(userId: string, resourceType: 'listings' | 'boosts'): Promise<{
        canUse: boolean;
        remaining: number;
        limit: number;
    }>;
    private countFreeUsageThisMonth;
    incrementUsage(userId: string, resourceType: 'listings' | 'boosts'): Promise<void>;
    checkExpiredSubscriptions(): Promise<void>;
    resetMonthlyUsage(): Promise<void>;
    private calculateEndDate;
}
