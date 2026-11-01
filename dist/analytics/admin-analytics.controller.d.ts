import { AdminAnalyticsService } from './admin-analytics.service';
import { AdminAnalyticsQueryDto, OccupancyQueryDto, RevenueQueryDto, AdminDateRangeDto } from './dto/admin-analytics.dto';
export declare class AdminAnalyticsController {
    private readonly adminAnalyticsService;
    constructor(adminAnalyticsService: AdminAnalyticsService);
    getDashboard(query: AdminAnalyticsQueryDto): Promise<import("./dto/admin-analytics.dto").AdminDashboardAnalytics>;
    getKPIs(query: AdminDateRangeDto): Promise<import("./dto/admin-analytics.dto").PlatformKPIs>;
    getRevenue(query: RevenueQueryDto): Promise<import("./dto/admin-analytics.dto").RevenueDataPoint[]>;
    getOccupancy(query: OccupancyQueryDto): Promise<import("./dto/admin-analytics.dto").OccupancyDataPoint[]>;
    getStatusBreakdown(query: AdminDateRangeDto): Promise<import("./dto/admin-analytics.dto").BookingStatusBreakdown[]>;
    getPropertyTypeBreakdown(query: AdminDateRangeDto): Promise<import("./dto/admin-analytics.dto").PropertyTypeBreakdown[]>;
    getTopProperties(query: AdminDateRangeDto & {
        limit?: string;
    }): Promise<import("./dto/admin-analytics.dto").TopProperty[]>;
    getCityPerformance(query: AdminDateRangeDto & {
        limit?: string;
    }): Promise<import("./dto/admin-analytics.dto").CityPerformance[]>;
    getHostLeaderboard(query: AdminDateRangeDto & {
        limit?: string;
    }): Promise<import("./dto/admin-analytics.dto").HostLeaderboard[]>;
    getComparison(query: AdminDateRangeDto): Promise<{
        current: import("./dto/admin-analytics.dto").PlatformKPIs;
        previous: import("./dto/admin-analytics.dto").PlatformKPIs;
        comparison: Record<string, {
            current: number;
            previous: number;
            change: number;
            percentChange: number;
            trend: "up" | "down" | "stable";
        }>;
    }>;
}
