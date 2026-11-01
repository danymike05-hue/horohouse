import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { History, HistoryDocument, ActivityType, SearchFilters, DeviceInfo } from './schemas/history.schema';
import { LogActivityDto } from './dto/log-activity.dto';

@Injectable()
export class HistoryService {
  private readonly logger = new Logger(HistoryService.name);

  constructor(
    @InjectModel(History.name) private historyModel: Model<HistoryDocument>,
  ) { }

  /**
   * Log user activity
   */
  async logActivity(activityData: LogActivityDto): Promise<History | null> {
    try {
      const history = new this.historyModel(activityData);
      await history.save();

      this.logger.debug(`Activity logged: ${activityData.activityType} for user ${activityData.userId}`);
      return history;
    } catch (error) {
      this.logger.error('Failed to log activity:', error.message);
      // Don't throw error for analytics logging failures
      return null;
    }
  }

  /**
   * Get popular cities based on activity
   */
  async getPopularCities(limit = 10, timeframe = 30): Promise<any[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - timeframe);

    return this.historyModel.aggregate([
      {
        $match: {
          activityType: { $in: [ActivityType.PROPERTY_VIEW, ActivityType.SEARCH] },
          createdAt: { $gte: startDate },
          city: { $exists: true, $ne: null },
        },
      },
      {
        $group: {
          _id: '$city',
          count: { $sum: 1 },
          country: { $first: '$country' },
          uniqueUsers: { $addToSet: '$userId' },
        },
      },
      {
        $addFields: {
          uniqueUserCount: { $size: '$uniqueUsers' },
        },
      },
      {
        $sort: { count: -1 },
      },
      {
        $limit: limit,
      },
      {
        $project: {
          city: '$_id',
          country: 1,
          count: 1,
          uniqueUsers: '$uniqueUserCount',
          _id: 0,
        },
      },
    ]);
  }

  /**
   * Get most viewed properties
   */
  async getMostViewedProperties(limit = 10, timeframe = 30): Promise<any[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - timeframe);

    return this.historyModel.aggregate([
      {
        $match: {
          activityType: ActivityType.PROPERTY_VIEW,
          propertyId: { $exists: true, $ne: null },
          createdAt: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: '$propertyId',
          viewCount: { $sum: 1 },
          uniqueViewers: { $addToSet: '$userId' },
          avgViewDuration: { $avg: '$viewDuration' },
          lastViewed: { $max: '$createdAt' },
        },
      },
      {
        $addFields: {
          uniqueViewerCount: { $size: '$uniqueViewers' },
        },
      },
      {
        $lookup: {
          from: 'properties',
          localField: '_id',
          foreignField: '_id',
          as: 'property',
        },
      },
      {
        $match: {
          'property.0': { $exists: true },
        },
      },
      {
        $sort: { viewCount: -1 },
      },
      {
        $limit: limit,
      },
      {
        $project: {
          propertyId: '$_id',
          property: { $arrayElemAt: ['$property', 0] },
          viewCount: 1,
          uniqueViewers: '$uniqueViewerCount',
          avgViewDuration: 1,
          lastViewed: 1,
          _id: 0,
        },
      },
    ]);
  }

  /**
   * Get search trends and popular queries
   */
  async getSearchTrends(timeframe = 7, limit = 20): Promise<any[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - timeframe);

    return this.historyModel.aggregate([
      {
        $match: {
          activityType: ActivityType.SEARCH,
          createdAt: { $gte: startDate },
          searchQuery: { $exists: true, $nin: [null, ''] },
        },
      },
      {
        $group: {
          _id: { $toLower: '$searchQuery' },
          count: { $sum: 1 },
          avgResults: { $avg: '$resultsCount' },
          avgClicked: { $avg: '$resultsClicked' },
          lastSearched: { $max: '$createdAt' },
          uniqueUsers: { $addToSet: '$userId' },
        },
      },
      {
        $addFields: {
          uniqueUserCount: { $size: '$uniqueUsers' },
          clickThroughRate: {
            $cond: {
              if: { $gt: ['$avgResults', 0] },
              then: { $divide: ['$avgClicked', '$avgResults'] },
              else: 0,
            },
          },
        },
      },
      {
        $sort: { count: -1 },
      },
      {
        $limit: limit,
      },
      {
        $project: {
          query: '$_id',
          count: 1,
          avgResults: 1,
          avgClicked: 1,
          clickThroughRate: 1,
          uniqueUsers: '$uniqueUserCount',
          lastSearched: 1,
          _id: 0,
        },
      },
    ]);
  }

  /**
   * Get user activity summary
   */
  async getUserActivity(userId: string, timeframe = 30): Promise<any> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - timeframe);

    const activity = await this.historyModel.aggregate([
      {
        $match: {
          userId: new Types.ObjectId(userId),
          createdAt: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: '$activityType',
          count: { $sum: 1 },
          lastActivity: { $max: '$createdAt' },
        },
      },
      {
        $sort: { count: -1 },
      },
    ]);

    const totalActivity = await this.historyModel.countDocuments({
      userId: new Types.ObjectId(userId),
      createdAt: { $gte: startDate },
    });

    return {
      totalActivity,
      byType: activity,
      timeframe,
    };
  }

  /**
   * Get property analytics
   */
  async getPropertyAnalytics(propertyId: string, timeframe = 30): Promise<any> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - timeframe);

    const [views, favorites, inquiries, dailyViews] = await Promise.all([
      // Total views
      this.historyModel.countDocuments({
        activityType: ActivityType.PROPERTY_VIEW,
        propertyId: new Types.ObjectId(propertyId),
        createdAt: { $gte: startDate },
      }),

      // Favorites
      this.historyModel.countDocuments({
        activityType: ActivityType.FAVORITE_ADD,
        propertyId: new Types.ObjectId(propertyId),
        createdAt: { $gte: startDate },
      }),

      // Inquiries
      this.historyModel.countDocuments({
        activityType: ActivityType.PROPERTY_INQUIRY,
        propertyId: new Types.ObjectId(propertyId),
        createdAt: { $gte: startDate },
      }),

      // Daily views for chart
      this.historyModel.aggregate([
        {
          $match: {
            activityType: ActivityType.PROPERTY_VIEW,
            propertyId: new Types.ObjectId(propertyId),
            createdAt: { $gte: startDate },
          },
        },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
            },
            views: { $sum: 1 },
            uniqueUsers: { $addToSet: '$userId' },
          },
        },
        {
          $addFields: {
            uniqueUserCount: { $size: '$uniqueUsers' },
          },
        },
        {
          $sort: { _id: 1 },
        },
        {
          $project: {
            date: '$_id',
            views: 1,
            uniqueUsers: '$uniqueUserCount',
            _id: 0,
          },
        },
      ]),
    ]);

    return {
      views,
      favorites,
      inquiries,
      dailyViews,
      timeframe,
    };
  }

  /**
   * Get agent performance analytics
   */
  async getAgentAnalytics(agentId: string, timeframe = 30): Promise<any> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - timeframe);

    return this.historyModel.aggregate([
      {
        $match: {
          activityType: ActivityType.AGENT_CONTACT,
          agentId: new Types.ObjectId(agentId),
          createdAt: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
          },
          contacts: { $sum: 1 },
          uniqueUsers: { $addToSet: '$userId' },
        },
      },
      {
        $addFields: {
          uniqueUserCount: { $size: '$uniqueUsers' },
        },
      },
      {
        $sort: { _id: 1 },
      },
      {
        $project: {
          date: '$_id',
          contacts: 1,
          uniqueUsers: '$uniqueUserCount',
          _id: 0,
        },
      },
    ]);
  }

  /**
   * Get platform statistics dashboard
   */
  async getDashboardStats(timeframe = 30): Promise<any> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - timeframe);

    // Get last 7 days for sparklines
    const sparklineDate = new Date();
    sparklineDate.setDate(sparklineDate.getDate() - 7);

    const [
      totalViews,
      totalSearches,
      totalUsers,
      totalFavorites,
      topCities,
      topSearches,
      dailyActivity,
      sparklineData, // NEW
    ] = await Promise.all([
      this.historyModel.countDocuments({
        activityType: ActivityType.PROPERTY_VIEW,
        createdAt: { $gte: startDate },
      }),

      this.historyModel.countDocuments({
        activityType: ActivityType.SEARCH,
        createdAt: { $gte: startDate },
      }),

      this.historyModel.distinct('userId', {
        createdAt: { $gte: startDate },
      }).then(users => users.length),

      this.historyModel.countDocuments({
        activityType: ActivityType.FAVORITE_ADD,
        createdAt: { $gte: startDate },
      }),

      this.getPopularCities(5, timeframe),
      this.getSearchTrends(timeframe, 5),

      this.historyModel.aggregate([
        {
          $match: {
            createdAt: { $gte: startDate },
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
            total: { $sum: '$count' },
          },
        },
        {
          $sort: { _id: 1 },
        },
        {
          $project: {
            date: '$_id',
            activities: 1,
            total: 1,
            _id: 0,
          },
        },
      ]),

      // NEW: Get last 7 days sparkline data
      this.historyModel.aggregate([
        {
          $match: {
            createdAt: { $gte: sparklineDate },
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
            _id: '$_id.type',
            dailyCounts: {
              $push: {
                date: '$_id.date',
                count: '$count',
              },
            },
          },
        },
        {
          $project: {
            activityType: '$_id',
            dailyCounts: 1,
            _id: 0,
          },
        },
      ]),
    ]);

    // Process sparkline data into arrays
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - i));
      return date.toISOString().split('T')[0];
    });

    const getCountsForDays = (activityType: string) => {
      const typeData = sparklineData.find(d => d.activityType === activityType);
      if (!typeData) return Array(7).fill(0);

      return last7Days.map(date => {
        const dayData = typeData.dailyCounts.find((d: any) => d.date === date);
        return dayData ? dayData.count : 0;
      });
    };

    return {
      overview: {
        totalViews,
        totalSearches,
        activeUsers: totalUsers,
        totalFavorites,
      },
      topCities,
      topSearches,
      dailyActivity,
      timeframe,
      // NEW: Add sparkline history
      history: {
        views: getCountsForDays(ActivityType.PROPERTY_VIEW),
        searches: getCountsForDays(ActivityType.SEARCH),
        favorites: getCountsForDays(ActivityType.FAVORITE_ADD),
        inquiries: getCountsForDays(ActivityType.PROPERTY_INQUIRY),
      },
    };
  }

  /**
   * Get all history records with filtering and pagination (Admin only)
   */
  async getAllHistory(query: {
    page?: number;
    limit?: number;
    activityType?: string;
    userId?: string;
    city?: string;
    ipAddress?: string;
    startDate?: string;
    endDate?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<{ data: History[]; total: number; page: number; limit: number }> {
    const {
      page = 1,
      limit = 20,
      activityType,
      userId,
      city,
      ipAddress,
      startDate,
      endDate,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;

    const skip = (page - 1) * limit;
    const filter: any = {};

    if (activityType) filter.activityType = activityType;
    if (userId) filter.userId = new Types.ObjectId(userId);
    if (city) filter.city = new RegExp(city, 'i');
    if (ipAddress) filter.ipAddress = ipAddress;

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const sort: any = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const [data, total] = await Promise.all([
      this.historyModel
        .find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate('userId', 'name email')
        .populate('propertyId', 'title city')
        .exec(),
      this.historyModel.countDocuments(filter),
    ]);

    return {
      data,
      total,
      page,
      limit,
    };
  }

  /**
   * Clean old history data (for maintenance)
   */
  async cleanOldData(daysToKeep = 365): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = await this.historyModel.deleteMany({
      createdAt: { $lt: cutoffDate },
    });

    this.logger.log(`🗑️ Cleaned ${result.deletedCount} old history records`);
    return result.deletedCount;
  }
}

export { LogActivityDto };
