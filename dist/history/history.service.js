"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var HistoryService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.LogActivityDto = exports.HistoryService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const history_schema_1 = require("./schemas/history.schema");
const log_activity_dto_1 = require("./dto/log-activity.dto");
Object.defineProperty(exports, "LogActivityDto", { enumerable: true, get: function () { return log_activity_dto_1.LogActivityDto; } });
let HistoryService = HistoryService_1 = class HistoryService {
    historyModel;
    logger = new common_1.Logger(HistoryService_1.name);
    constructor(historyModel) {
        this.historyModel = historyModel;
    }
    async logActivity(activityData) {
        try {
            const history = new this.historyModel(activityData);
            await history.save();
            this.logger.debug(`Activity logged: ${activityData.activityType} for user ${activityData.userId}`);
            return history;
        }
        catch (error) {
            this.logger.error('Failed to log activity:', error.message);
            return null;
        }
    }
    async getPopularCities(limit = 10, timeframe = 30) {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - timeframe);
        return this.historyModel.aggregate([
            {
                $match: {
                    activityType: { $in: [history_schema_1.ActivityType.PROPERTY_VIEW, history_schema_1.ActivityType.SEARCH] },
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
    async getMostViewedProperties(limit = 10, timeframe = 30) {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - timeframe);
        return this.historyModel.aggregate([
            {
                $match: {
                    activityType: history_schema_1.ActivityType.PROPERTY_VIEW,
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
    async getSearchTrends(timeframe = 7, limit = 20) {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - timeframe);
        return this.historyModel.aggregate([
            {
                $match: {
                    activityType: history_schema_1.ActivityType.SEARCH,
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
    async getUserActivity(userId, timeframe = 30) {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - timeframe);
        const activity = await this.historyModel.aggregate([
            {
                $match: {
                    userId: new mongoose_2.Types.ObjectId(userId),
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
            userId: new mongoose_2.Types.ObjectId(userId),
            createdAt: { $gte: startDate },
        });
        return {
            totalActivity,
            byType: activity,
            timeframe,
        };
    }
    async getPropertyAnalytics(propertyId, timeframe = 30) {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - timeframe);
        const [views, favorites, inquiries, dailyViews] = await Promise.all([
            this.historyModel.countDocuments({
                activityType: history_schema_1.ActivityType.PROPERTY_VIEW,
                propertyId: new mongoose_2.Types.ObjectId(propertyId),
                createdAt: { $gte: startDate },
            }),
            this.historyModel.countDocuments({
                activityType: history_schema_1.ActivityType.FAVORITE_ADD,
                propertyId: new mongoose_2.Types.ObjectId(propertyId),
                createdAt: { $gte: startDate },
            }),
            this.historyModel.countDocuments({
                activityType: history_schema_1.ActivityType.PROPERTY_INQUIRY,
                propertyId: new mongoose_2.Types.ObjectId(propertyId),
                createdAt: { $gte: startDate },
            }),
            this.historyModel.aggregate([
                {
                    $match: {
                        activityType: history_schema_1.ActivityType.PROPERTY_VIEW,
                        propertyId: new mongoose_2.Types.ObjectId(propertyId),
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
    async getAgentAnalytics(agentId, timeframe = 30) {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - timeframe);
        return this.historyModel.aggregate([
            {
                $match: {
                    activityType: history_schema_1.ActivityType.AGENT_CONTACT,
                    agentId: new mongoose_2.Types.ObjectId(agentId),
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
    async getDashboardStats(timeframe = 30) {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - timeframe);
        const sparklineDate = new Date();
        sparklineDate.setDate(sparklineDate.getDate() - 7);
        const [totalViews, totalSearches, totalUsers, totalFavorites, topCities, topSearches, dailyActivity, sparklineData,] = await Promise.all([
            this.historyModel.countDocuments({
                activityType: history_schema_1.ActivityType.PROPERTY_VIEW,
                createdAt: { $gte: startDate },
            }),
            this.historyModel.countDocuments({
                activityType: history_schema_1.ActivityType.SEARCH,
                createdAt: { $gte: startDate },
            }),
            this.historyModel.distinct('userId', {
                createdAt: { $gte: startDate },
            }).then(users => users.length),
            this.historyModel.countDocuments({
                activityType: history_schema_1.ActivityType.FAVORITE_ADD,
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
        const last7Days = Array.from({ length: 7 }, (_, i) => {
            const date = new Date();
            date.setDate(date.getDate() - (6 - i));
            return date.toISOString().split('T')[0];
        });
        const getCountsForDays = (activityType) => {
            const typeData = sparklineData.find(d => d.activityType === activityType);
            if (!typeData)
                return Array(7).fill(0);
            return last7Days.map(date => {
                const dayData = typeData.dailyCounts.find((d) => d.date === date);
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
            history: {
                views: getCountsForDays(history_schema_1.ActivityType.PROPERTY_VIEW),
                searches: getCountsForDays(history_schema_1.ActivityType.SEARCH),
                favorites: getCountsForDays(history_schema_1.ActivityType.FAVORITE_ADD),
                inquiries: getCountsForDays(history_schema_1.ActivityType.PROPERTY_INQUIRY),
            },
        };
    }
    async getAllHistory(query) {
        const { page = 1, limit = 20, activityType, userId, city, ipAddress, startDate, endDate, sortBy = 'createdAt', sortOrder = 'desc', } = query;
        const skip = (page - 1) * limit;
        const filter = {};
        if (activityType)
            filter.activityType = activityType;
        if (userId)
            filter.userId = new mongoose_2.Types.ObjectId(userId);
        if (city)
            filter.city = new RegExp(city, 'i');
        if (ipAddress)
            filter.ipAddress = ipAddress;
        if (startDate || endDate) {
            filter.createdAt = {};
            if (startDate)
                filter.createdAt.$gte = new Date(startDate);
            if (endDate)
                filter.createdAt.$lte = new Date(endDate);
        }
        const sort = {};
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
    async cleanOldData(daysToKeep = 365) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
        const result = await this.historyModel.deleteMany({
            createdAt: { $lt: cutoffDate },
        });
        this.logger.log(`🗑️ Cleaned ${result.deletedCount} old history records`);
        return result.deletedCount;
    }
};
exports.HistoryService = HistoryService;
exports.HistoryService = HistoryService = HistoryService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(history_schema_1.History.name)),
    __metadata("design:paramtypes", [mongoose_2.Model])
], HistoryService);
//# sourceMappingURL=history.service.js.map