import { RevenueAnalyticsService } from '../services/revenue-analytics.service';
export declare class RevenueAnalyticsController {
    private readonly revenueAnalyticsService;
    constructor(revenueAnalyticsService: RevenueAnalyticsService);
    getRevenueOverview(): Promise<import("../services/revenue-analytics.service").RevenueAnalytics>;
    getMonthlyRevenueChart(months: number): Promise<import("../services/revenue-analytics.service").MonthlyRevenue[]>;
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
    getTopRevenueUsers(limit: number): Promise<any[]>;
    getAnalyticsSummary(): Promise<{
        revenue: {
            total: number;
            monthly: number;
            yearly: number;
            today: number;
            mrr: number;
            arr: number;
            growth: number;
        };
        transactions: {
            total: number;
            successful: number;
            failed: number;
            pending: number;
            conversionRate: number;
            averageValue: number;
        };
        subscriptions: {
            active: number;
            expired: number;
            cancelled: number;
            churnRate: number;
            byPlan: any[];
        };
        boosts: {
            total: number;
            active: number;
            revenue: any;
            impressions: number;
            clicks: number;
            ctr: number;
            byType: any[];
        };
        revenueBreakdown: {
            subscriptions: number;
            listingFees: number;
            boosts: number;
            commissions: number;
            digitalServices: number;
        };
        paymentMethods: {
            method: string;
            count: number;
            revenue: number;
            percentage: number;
        }[];
        metrics: {
            arpu: number;
            ltv: number;
        };
    }>;
}
