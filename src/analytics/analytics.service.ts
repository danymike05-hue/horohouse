import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument, UserRole } from '../users/schemas/user.schema';
import { Property, PropertyDocument } from '../properties/schemas/property.schema';
import { Inquiry, InquiryDocument } from '../properties/schemas/inquiry.schema';
import { History, HistoryDocument, ActivityType } from '../history/schemas/history.schema';

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

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Property.name) private propertyModel: Model<PropertyDocument>,
    @InjectModel(Inquiry.name) private inquiryModel: Model<InquiryDocument>,
    @InjectModel(History.name) private historyModel: Model<HistoryDocument>,
  ) { }

  /**
   * Get analytics based on user role
   */
  async getAnalytics(
    userId: string,
    dateRange: DateRange,
  ): Promise<RegularUserAnalytics | AgentAnalytics> {
    this.logger.log(`Fetching analytics for user ${userId} with range ${dateRange.startDate} - ${dateRange.endDate}`);
    const user = await this.userModel.findById(userId);

    if (!user) {
      throw new Error('User not found');
    }

    if (user.role === UserRole.AGENT) {
      return this.getAgentAnalytics(userId, dateRange);
    } else {
      return this.getRegularUserAnalytics(userId, dateRange);
    }
  }

  /**
   * Get analytics for regular users (buyers/renters)
   */
  private async getRegularUserAnalytics(
    userId: string,
    dateRange: DateRange,
  ): Promise<RegularUserAnalytics> {
    const userObjectId = new Types.ObjectId(userId);

    // Get user data
    const user = await this.userModel.findById(userId).populate('favorites');

    // KPIs
    const savedProperties = user?.favorites?.length || 0;
    const recentlyViewed = user?.recentlyViewed?.length || 0;

    const contactedAgents = await this.inquiryModel.countDocuments({
      userId: userObjectId,
      createdAt: { $gte: dateRange.startDate, $lte: dateRange.endDate },
    });

    // Count closed inquiries as completed transactions
    const completedTransactions = await this.inquiryModel.countDocuments({
      userId: userObjectId,
      status: 'closed',
      createdAt: { $gte: dateRange.startDate, $lte: dateRange.endDate },
    } as any);

    // Engagement over time
    const engagementOverTime = await this.getEngagementOverTime(
      userObjectId,
      dateRange,
      'user',
    );

    // Property type interest
    const propertyTypeInterest = await this.getPropertyTypeInterest(
      userObjectId,
      dateRange,
    );

    // Recent activity
    const recentActivity = await this.getRecentActivity(userObjectId, 5);

    // Generate insights
    const insights = await this.generateUserInsights(
      userObjectId,
      dateRange,
      savedProperties,
      recentlyViewed,
    );

    return {
      kpis: {
        savedProperties,
        recentlyViewed,
        contactedAgents,
        completedTransactions,
      },
      engagementOverTime,
      propertyTypeInterest,
      recentActivity,
      insights,
    };
  }

  /**
   * Get analytics for agents (property listers/sellers)
   */
  private async getAgentAnalytics(
    agentId: string,
    dateRange: DateRange,
  ): Promise<AgentAnalytics> {
    const agentObjectId = new Types.ObjectId(agentId);

    // Get agent properties
    const properties = await this.propertyModel.find({
      $or: [{ ownerId: agentObjectId }, { agentId: agentObjectId }],
    });

    // FIX: Cast _id to Types.ObjectId explicitly
    const propertyIds = properties.map(p => p._id as Types.ObjectId);

    // KPIs
    // FIX: Calculate totalViews based on history within date range to match chart
    const totalViews = await this.historyModel.countDocuments({
      agentId: agentObjectId,
      activityType: ActivityType.PROPERTY_VIEW,
      createdAt: { $gte: dateRange.startDate, $lte: dateRange.endDate },
    });
    const savedProperties = properties.reduce((sum, p) => sum + (p.favoritesCount || 0), 0);
    const activeListings = properties.filter(p => p.isActive && p.availability === 'active').length;

    const inquiriesReceived = await this.inquiryModel.countDocuments({
      agentId: agentObjectId,
      createdAt: { $gte: dateRange.startDate, $lte: dateRange.endDate },
    });

    // Calculate estimated revenue from sold/rented properties
    const estimatedRevenue = await this.calculateEstimatedRevenue(
      agentObjectId,
      dateRange,
    );

    // Engagement over time
    const engagementOverTime = await this.getEngagementOverTime(
      agentObjectId,
      dateRange,
      'agent',
    );

    // Top performing listings
    const topPerformingListings = await this.getTopPerformingListings(
      propertyIds,
      5,
    );

    // Engagement by city
    const engagementByCity = await this.getEngagementByCity(propertyIds);

    // Conversion rate
    const conversionRate = await this.getConversionRate(
      agentObjectId,
      dateRange,
    );

    // Revenue by month
    const revenueByMonth = await this.getRevenueByMonth(
      agentObjectId,
      dateRange,
    );

    return {
      kpis: {
        totalViews,
        inquiriesReceived,
        savedProperties,
        activeListings,
        estimatedRevenue,
      },
      engagementOverTime,
      topPerformingListings,
      engagementByCity,
      conversionRate,
      revenueByMonth,
    };
  }

  /**
   * Get engagement over time (daily or weekly aggregation)
   */
  private async getEngagementOverTime(
    userId: Types.ObjectId,
    dateRange: DateRange,
    userType: 'user' | 'agent',
  ) {
    const matchQuery = userType === 'agent'
      ? { $or: [{ agentId: userId }, { 'metadata.agentId': userId }] }
      : { userId };

    const engagement = await this.historyModel.aggregate([
      {
        $match: {
          ...matchQuery,
          createdAt: { $gte: dateRange.startDate, $lte: dateRange.endDate },
        },
      },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            type: '$activityType',
          },
          count: { $sum: 1 },
        },
      },
      {
        $group: {
          _id: '$_id.date',
          activities: {
            $push: {
              type: '$_id.type',
              count: '$count',
            },
          },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    return engagement.map(day => ({
      date: day._id,
      searches: day.activities.find((a: any) => a.type === ActivityType.SEARCH)?.count || 0,
      views: day.activities.find((a: any) => a.type === ActivityType.PROPERTY_VIEW)?.count || 0,
      saves: day.activities.find((a: any) => a.type === ActivityType.FAVORITE_ADD)?.count || 0,
      inquiries: day.activities.find((a: any) => a.type === ActivityType.PROPERTY_INQUIRY)?.count || 0,
    }));
  }

  /**
   * Get property type interest for regular users
   */
  private async getPropertyTypeInterest(
    userId: Types.ObjectId,
    dateRange: DateRange,
  ) {
    const viewedProperties = await this.historyModel.aggregate([
      {
        $match: {
          userId,
          activityType: ActivityType.PROPERTY_VIEW,
          createdAt: { $gte: dateRange.startDate, $lte: dateRange.endDate },
        },
      },
      {
        $lookup: {
          from: 'properties',
          localField: 'propertyId',
          foreignField: '_id',
          as: 'property',
        },
      },
      { $unwind: '$property' },
      {
        $group: {
          _id: '$property.type',
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ]);

    const total = viewedProperties.reduce((sum, item) => sum + item.count, 0);

    return viewedProperties.map(item => ({
      type: item._id,
      count: item.count,
      percentage: total > 0 ? Math.round((item.count / total) * 100) : 0,
    }));
  }

  /**
   * Get recent activity for regular users
   */
  private async getRecentActivity(userId: Types.ObjectId, limit: number) {
    const activities = await this.historyModel
      .find({ userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('propertyId', 'title city images')
      .exec();

    return activities.map(activity => {
      // FIX: Type guard for populated propertyId
      const property = activity.propertyId as any;

      return {
        id: (activity._id as Types.ObjectId).toString(),
        type: activity.activityType,
        propertyTitle: property?.title || 'Unknown Property',
        timestamp: activity.createdAt,
        city: property?.city || activity.city || 'Unknown',
      };
    });
  }

  /**
   * Get top performing listings for agents
   */
  private async getTopPerformingListings(propertyIds: Types.ObjectId[], limit: number) {
    const properties = await this.propertyModel
      .find({ _id: { $in: propertyIds } })
      .sort({ viewsCount: -1 })
      .limit(limit)
      .exec();

    return Promise.all(
      properties.map(async property => {
        const inquiries = await this.inquiryModel.countDocuments({
          propertyId: property._id as Types.ObjectId,
        });

        return {
          id: (property._id as Types.ObjectId).toString(),
          title: property.title,
          views: property.viewsCount || 0,
          inquiries,
          saves: property.favoritesCount || 0,
          price: property.price,
          image: property.images?.[0]?.url || '',
        };
      }),
    );
  }

  /**
   * Get engagement by city for agents
   */
  private async getEngagementByCity(propertyIds: Types.ObjectId[]) {
    const cityEngagement = await this.propertyModel.aggregate([
      { $match: { _id: { $in: propertyIds } } },
      {
        $group: {
          _id: '$city',
          views: { $sum: '$viewsCount' },
          properties: { $sum: 1 },
        },
      },
      { $sort: { views: -1 } },
      { $limit: 10 },
    ]);

    return Promise.all(
      cityEngagement.map(async city => {
        const inquiries = await this.inquiryModel.countDocuments({
          propertyId: { $in: propertyIds },
        });

        return {
          city: city._id,
          views: city.views,
          inquiries,
        };
      }),
    );
  }

  /**
   * Calculate conversion rate for agents
   */
  private async getConversionRate(agentId: Types.ObjectId, dateRange: DateRange) {
    const totalInquiries = await this.inquiryModel.countDocuments({
      agentId,
      createdAt: { $gte: dateRange.startDate, $lte: dateRange.endDate },
    });

    const responded = await this.inquiryModel.countDocuments({
      agentId,
      status: 'responded',
      createdAt: { $gte: dateRange.startDate, $lte: dateRange.endDate },
    } as any);

    const closed = await this.inquiryModel.countDocuments({
      agentId,
      status: 'closed',
      createdAt: { $gte: dateRange.startDate, $lte: dateRange.endDate },
    } as any);

    return {
      totalInquiries,
      responded,
      closed,
      conversionPercentage: totalInquiries > 0 ? Math.round((closed / totalInquiries) * 100) : 0,
    };
  }

  /**
   * Calculate estimated revenue for agents
   */
  private async calculateEstimatedRevenue(
    agentId: Types.ObjectId,
    dateRange: DateRange,
  ): Promise<number> {
    const soldProperties = await this.propertyModel.find({
      $or: [{ ownerId: agentId }, { agentId }],
      availability: { $in: ['sold', 'rented'] },
      updatedAt: { $gte: dateRange.startDate, $lte: dateRange.endDate },
    } as any);

    return soldProperties.reduce((sum, property) => sum + property.price, 0);
  }

  /**
   * Get revenue by month for agents
   */
  private async getRevenueByMonth(agentId: Types.ObjectId, dateRange: DateRange) {
    const revenueData = await this.propertyModel.aggregate([
      {
        $match: {
          $or: [{ ownerId: agentId }, { agentId }],
          availability: { $in: ['sold', 'rented'] },
          updatedAt: { $gte: dateRange.startDate, $lte: dateRange.endDate },
        },
      },
      {
        $group: {
          _id: {
            month: { $month: '$updatedAt' },
            year: { $year: '$updatedAt' },
          },
          revenue: { $sum: '$price' },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);

    return revenueData.map(item => ({
      month: `${item._id.year}-${String(item._id.month).padStart(2, '0')}`,
      revenue: item.revenue,
    }));
  }

  /**
   * Generate insights for regular users
   */
  private async generateUserInsights(
    userId: Types.ObjectId,
    dateRange: DateRange,
    savedProperties: number,
    recentlyViewed: number,
  ): Promise<string[]> {
    const insights: string[] = [];

    // Calculate views this period vs previous period
    const periodLength = dateRange.endDate.getTime() - dateRange.startDate.getTime();
    const previousPeriodStart = new Date(dateRange.startDate.getTime() - periodLength);

    const currentViews = await this.historyModel.countDocuments({
      userId,
      activityType: ActivityType.PROPERTY_VIEW,
      createdAt: { $gte: dateRange.startDate, $lte: dateRange.endDate },
    });

    const previousViews = await this.historyModel.countDocuments({
      userId,
      activityType: ActivityType.PROPERTY_VIEW,
      createdAt: { $gte: previousPeriodStart, $lt: dateRange.startDate },
    });

    if (previousViews > 0) {
      const percentChange = Math.round(((currentViews - previousViews) / previousViews) * 100);
      if (percentChange > 0) {
        insights.push(`You've viewed ${currentViews} properties this period — ${percentChange}% more than last period.`);
      } else if (percentChange < 0) {
        insights.push(`Your property views decreased by ${Math.abs(percentChange)}% compared to last period.`);
      }
    }

    // Trending property types
    const topType = await this.historyModel.aggregate([
      {
        $match: {
          userId,
          activityType: ActivityType.PROPERTY_VIEW,
          createdAt: { $gte: dateRange.startDate, $lte: dateRange.endDate },
        },
      },
      {
        $lookup: {
          from: 'properties',
          localField: 'propertyId',
          foreignField: '_id',
          as: 'property',
        },
      },
      { $unwind: '$property' },
      {
        $group: {
          _id: '$property.type',
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 1 },
    ]);

    if (topType.length > 0) {
      insights.push(`You're most interested in ${topType[0]._id}s — we have ${topType[0].count} new listings you might like.`);
    }

    // Saved properties insight
    if (savedProperties > 5) {
      insights.push(`You have ${savedProperties} saved properties. Ready to schedule viewings?`);
    }

    return insights;
  }

  /**
   * Export analytics data
   */
  async exportAnalytics(
    userId: string,
    dateRange: DateRange,
    format: 'csv' | 'json',
  ): Promise<any> {
    const analytics = await this.getAnalytics(userId, dateRange);

    if (format === 'json') {
      return analytics;
    }

    // Convert to CSV format
    // Implementation depends on specific requirements
    return this.convertToCSV(analytics);
  }

  private convertToCSV(data: any): string {
    // Simple CSV conversion - can be enhanced
    return JSON.stringify(data);
  }
}