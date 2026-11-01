import { Model } from 'mongoose';
import { UserDocument } from '../users/schemas/user.schema';
import { PropertyDocument } from '../properties/schemas/property.schema';
import { InquiryDocument } from '../properties/schemas/inquiry.schema';
import { HistoryDocument } from '../history/schemas/history.schema';
export interface DateRange {
    startDate: Date;
    endDate: Date;
}
export interface RegularUserAnalytics {
    kpis: {
        savedProperties: number;
        recentlyViewed: number;
        contactedAgents: number;
        completedTransactions: number;
    };
    engagementOverTime: Array<{
        date: string;
        searches: number;
        views: number;
        saves: number;
    }>;
    propertyTypeInterest: Array<{
        type: string;
        count: number;
        percentage: number;
    }>;
    recentActivity: Array<{
        id: string;
        type: string;
        propertyTitle: string;
        timestamp: Date;
        city: string;
    }>;
    insights: string[];
}
export interface AgentAnalytics {
    kpis: {
        totalViews: number;
        inquiriesReceived: number;
        savedProperties: number;
        activeListings: number;
        estimatedRevenue: number;
    };
    engagementOverTime: Array<{
        date: string;
        views: number;
        inquiries: number;
        saves: number;
    }>;
    topPerformingListings: Array<{
        id: string;
        title: string;
        views: number;
        inquiries: number;
        saves: number;
        price: number;
        image: string;
    }>;
    engagementByCity: Array<{
        city: string;
        views: number;
        inquiries: number;
    }>;
    conversionRate: {
        totalInquiries: number;
        responded: number;
        closed: number;
        conversionPercentage: number;
    };
    revenueByMonth: Array<{
        month: string;
        revenue: number;
    }>;
}
export declare class AnalyticsService {
    private userModel;
    private propertyModel;
    private inquiryModel;
    private historyModel;
    private readonly logger;
    constructor(userModel: Model<UserDocument>, propertyModel: Model<PropertyDocument>, inquiryModel: Model<InquiryDocument>, historyModel: Model<HistoryDocument>);
    getAnalytics(userId: string, dateRange: DateRange): Promise<RegularUserAnalytics | AgentAnalytics>;
    private getRegularUserAnalytics;
    private getAgentAnalytics;
    private getEngagementOverTime;
    private getPropertyTypeInterest;
    private getRecentActivity;
    private getTopPerformingListings;
    private getEngagementByCity;
    private getConversionRate;
    private calculateEstimatedRevenue;
    private getRevenueByMonth;
    private generateUserInsights;
    exportAnalytics(userId: string, dateRange: DateRange, format: 'csv' | 'json'): Promise<any>;
    private convertToCSV;
}
