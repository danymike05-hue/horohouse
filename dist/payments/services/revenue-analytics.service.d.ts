import { Model } from 'mongoose';
import { TransactionDocument } from '../schemas/transaction.schema';
import { SubscriptionDocument } from '../schemas/subscription.schema';
import { ListingBoostDocument } from '../schemas/listing-boost.schema';
export interface RevenueAnalytics {
    totalRevenue: number;
    monthlyRevenue: number;
    yearlyRevenue: number;
    todayRevenue: number;
    totalTransactions: number;
    successfulTransactions: number;
    failedTransactions: number;
    pendingTransactions: number;
    averageTransactionValue: number;
    revenueByType: {
        subscriptions: number;
        listingFees: number;
        boosts: number;
        commissions: number;
        digitalServices: number;
    };
    mrr: number;
    arr: number;
    arpu: number;
    conversionRate: number;
    revenueGrowth: number;
    paymentMethodsDistribution: Array<{
        method: string;
        count: number;
        revenue: number;
        percentage: number;
    }>;
}
export interface MonthlyRevenue {
    month: string;
    revenue: number;
    transactions: number;
    avgTransactionValue: number;
}
export declare class RevenueAnalyticsService {
    private transactionModel;
    private subscriptionModel;
    private listingBoostModel;
    private readonly logger;
    constructor(transactionModel: Model<TransactionDocument>, subscriptionModel: Model<SubscriptionDocument>, listingBoostModel: Model<ListingBoostDocument>);
    getRevenueAnalytics(): Promise<RevenueAnalytics>;
    getMonthlyRevenueChart(months?: number): Promise<MonthlyRevenue[]>;
    getSubscriptionAnalytics(): Promise<{
        activeSubscriptions: number;
        expiredSubscriptions: number;
        cancelledSubscriptions: number;
        subscriptionsByPlan: any[];
        churnRate: number;
    }>;
    getBoostAnalytics(): Promise<{
        totalBoosts: number;
        activeBoosts: number;
        boostsByType: any[];
        boostRevenue: any;
        totalImpressions: number;
        totalClicks: number;
        averageCTR: number;
    }>;
    getTopRevenueUsers(limit?: number): Promise<any[]>;
}
