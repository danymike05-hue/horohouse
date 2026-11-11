export declare class AdminDateRangeDto {
    startDate?: string;
    endDate?: string;
}
export declare class AdminAnalyticsQueryDto extends AdminDateRangeDto {
    granularity?: 'day' | 'week' | 'month';
}
export declare class OccupancyQueryDto extends AdminDateRangeDto {
    propertyId?: string;
    city?: string;
    granularity?: 'day' | 'week' | 'month';
}
export declare class RevenueQueryDto extends AdminDateRangeDto {
    granularity?: 'day' | 'week' | 'month';
    hostId?: string;
    propertyType?: string;
}
export interface PlatformKPIs {
    totalBookings: number;
    confirmedBookings: number;
    cancelledBookings: number;
    completedBookings: number;
    pendingBookings: number;
    cancellationRate: number;
    grossRevenue: number;
    platformFeeRevenue: number;
    averageBookingValue: number;
    averageOccupancyRate: number;
    averageNightsBooked: number;
    averageLeadTime: number;
    totalGuests: number;
    totalHosts: number;
    newGuestsThisPeriod: number;
    totalReviews: number;
    averageRating: number;
    reviewCompletionRate: number;
}
export interface RevenueDataPoint {
    period: string;
    grossRevenue: number;
    platformFees: number;
    bookingCount: number;
    averageValue: number;
}
export interface OccupancyDataPoint {
    period: string;
    occupancyRate: number;
    nightsBooked: number;
    nightsAvailable: number;
    propertyCount: number;
}
export interface TopProperty {
    propertyId: string;
    title: string;
    city: string;
    type: string;
    hostName: string;
    bookingCount: number;
    revenue: number;
    occupancyRate: number;
    averageRating: number;
    reviewCount: number;
}
export interface BookingStatusBreakdown {
    status: string;
    count: number;
    percentage: number;
    revenue: number;
}
export interface PropertyTypeBreakdown {
    type: string;
    bookingCount: number;
    revenue: number;
    occupancyRate: number;
    averageRating: number;
    percentage: number;
}
export interface CityPerformance {
    city: string;
    bookingCount: number;
    revenue: number;
    propertyCount: number;
    averageRating: number;
    occupancyRate: number;
}
export interface HostLeaderboard {
    hostId: string;
    hostName: string;
    bookingCount: number;
    revenue: number;
    averageRating: number;
    propertyCount: number;
    cancellationRate: number;
}
export interface AdminDashboardAnalytics {
    kpis: PlatformKPIs;
    revenueOverTime: RevenueDataPoint[];
    occupancyOverTime: OccupancyDataPoint[];
    bookingStatusBreakdown: BookingStatusBreakdown[];
    propertyTypeBreakdown: PropertyTypeBreakdown[];
    topProperties: TopProperty[];
    cityPerformance: CityPerformance[];
    hostLeaderboard: HostLeaderboard[];
    period: {
        startDate: string;
        endDate: string;
    };
}
