import { SubscriptionsService } from '../services/subscriptions.service';
import { PaymentsService } from '../services/payments.service';
import { CreateSubscriptionDto, CancelSubscriptionDto } from '../dto/payment.dto';
export declare class SubscriptionsController {
    private readonly subscriptionsService;
    private readonly paymentsService;
    private readonly logger;
    constructor(subscriptionsService: SubscriptionsService, paymentsService: PaymentsService);
    getPlans(): Promise<import("../schemas/subscription-plan.schema").SubscriptionPlanModel[]>;
    getMySubscription(req: any): Promise<{
        message: string;
        subscription: null;
        plan: string;
    } | {
        subscription: import("../schemas/subscription.schema").SubscriptionDocument;
        message?: undefined;
        plan?: undefined;
    }>;
    subscribe(createSubscriptionDto: CreateSubscriptionDto, req: any): Promise<{
        message: string;
        transaction: import("../schemas/transaction.schema").TransactionDocument;
        paymentLink: string;
        plan: {
            name: string;
            price: number;
            billingCycle: import("../schemas/transaction.schema").BillingCycle;
        };
    }>;
    activateSubscription(transactionId: string, req: any): Promise<{
        message: string;
        status: import("../schemas/transaction.schema").TransactionStatus.PENDING | import("../schemas/transaction.schema").TransactionStatus.FAILED | import("../schemas/transaction.schema").TransactionStatus.CANCELLED | import("../schemas/transaction.schema").TransactionStatus.REFUNDED;
        subscription?: undefined;
    } | {
        message: string;
        subscription: import("../schemas/subscription.schema").SubscriptionDocument;
        status?: undefined;
    }>;
    cancelSubscription(cancelDto: CancelSubscriptionDto, req: any): Promise<{
        message: string;
        subscription: import("../schemas/subscription.schema").SubscriptionDocument;
        endsAt: Date | undefined;
    }>;
    getUsage(req: any): Promise<{
        subscription: {
            plan: import("../schemas/subscription.schema").SubscriptionPlan;
            status: import("../schemas/subscription.schema").SubscriptionStatus;
            endDate: Date | undefined;
        };
        usage: {
            listings: {
                used: number;
                limit: number;
                remaining: string | number;
            };
            boosts: {
                used: number;
                limit: number;
                remaining: string | number;
            };
        };
    } | {
        message: string;
        usage: null;
    }>;
    checkLimit(resourceType: 'listings' | 'boosts', req: any): Promise<{
        canUse: boolean;
        remaining: number;
        limit: number;
    }>;
}
