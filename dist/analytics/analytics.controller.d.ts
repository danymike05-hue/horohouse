import { AnalyticsService } from './analytics.service';
export declare class AnalyticsController {
    private readonly analyticsService;
    constructor(analyticsService: AnalyticsService);
    getDashboard(req: any, startDate?: string, endDate?: string): Promise<import("./analytics.service").RegularUserAnalytics | import("./analytics.service").AgentAnalytics>;
    getEngagement(req: any, startDate?: string, endDate?: string, granularity?: 'day' | 'week' | 'month'): Promise<{
        engagementOverTime: {
            date: string;
            searches: number;
            views: number;
            saves: number;
        }[] | {
            date: string;
            views: number;
            inquiries: number;
            saves: number;
        }[];
        granularity: "week" | "day" | "month";
    }>;
    getKPIs(req: any, startDate?: string, endDate?: string): Promise<{
        savedProperties: number;
        recentlyViewed: number;
        contactedAgents: number;
        completedTransactions: number;
    } | {
        totalViews: number;
        inquiriesReceived: number;
        savedProperties: number;
        activeListings: number;
        estimatedRevenue: number;
    }>;
    exportData(req: any, startDate?: string, endDate?: string, format?: 'csv' | 'json'): Promise<any>;
    getComparison(req: any, startDate?: string, endDate?: string): Promise<{
        current: import("./analytics.service").RegularUserAnalytics | import("./analytics.service").AgentAnalytics;
        previous: import("./analytics.service").RegularUserAnalytics | import("./analytics.service").AgentAnalytics;
        comparison: any;
    }>;
    private parseDateRange;
    private calculateComparison;
}
