import { Model } from 'mongoose';
import { BookingDocument } from '../bookings/schema/booking.schema';
import { PropertyDocument } from '../properties/schemas/property.schema';
import { ReviewDocument } from '../reviews/schemas/review.schema';
import { UserDocument } from '../users/schemas/user.schema';
import { AdminDashboardAnalytics, PlatformKPIs, RevenueDataPoint, OccupancyDataPoint, TopProperty, BookingStatusBreakdown, PropertyTypeBreakdown, CityPerformance, HostLeaderboard } from './dto/admin-analytics.dto';
export interface DateRange {
    startDate: Date;
    endDate: Date;
}
export declare class AdminAnalyticsService {
    private bookingModel;
    private propertyModel;
    private reviewModel;
    private userModel;
    private readonly logger;
    constructor(bookingModel: Model<BookingDocument>, propertyModel: Model<PropertyDocument>, reviewModel: Model<ReviewDocument>, userModel: Model<UserDocument>);
    getAdminDashboard(dateRange: DateRange, granularity?: 'day' | 'week' | 'month'): Promise<AdminDashboardAnalytics>;
    getPlatformKPIs(dateRange: DateRange): Promise<PlatformKPIs>;
    getRevenueOverTime(dateRange: DateRange, granularity?: 'day' | 'week' | 'month', filters?: {
        hostId?: string;
        propertyType?: string;
    }): Promise<RevenueDataPoint[]>;
    getOccupancyOverTime(dateRange: DateRange, granularity?: 'day' | 'week' | 'month', filters?: {
        propertyId?: string;
        city?: string;
    }): Promise<OccupancyDataPoint[]>;
    getBookingStatusBreakdown(dateRange: DateRange): Promise<BookingStatusBreakdown[]>;
    getPropertyTypeBreakdown(dateRange: DateRange): Promise<PropertyTypeBreakdown[]>;
    getTopProperties(dateRange: DateRange, limit?: number): Promise<TopProperty[]>;
    getCityPerformance(dateRange: DateRange, limit?: number): Promise<CityPerformance[]>;
    getHostLeaderboard(dateRange: DateRange, limit?: number): Promise<HostLeaderboard[]>;
    getKPIComparison(dateRange: DateRange): Promise<{
        current: PlatformKPIs;
        previous: PlatformKPIs;
        comparison: Record<string, {
            current: number;
            previous: number;
            change: number;
            percentChange: number;
            trend: 'up' | 'down' | 'stable';
        }>;
    }>;
}
