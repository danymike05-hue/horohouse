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
var AnalyticsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnalyticsService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const user_schema_1 = require("../users/schemas/user.schema");
const property_schema_1 = require("../properties/schemas/property.schema");
const inquiry_schema_1 = require("../properties/schemas/inquiry.schema");
const history_schema_1 = require("../history/schemas/history.schema");
let AnalyticsService = AnalyticsService_1 = class AnalyticsService {
    userModel;
    propertyModel;
    inquiryModel;
    historyModel;
    logger = new common_1.Logger(AnalyticsService_1.name);
    constructor(userModel, propertyModel, inquiryModel, historyModel) {
        this.userModel = userModel;
        this.propertyModel = propertyModel;
        this.inquiryModel = inquiryModel;
        this.historyModel = historyModel;
    }
    async getAnalytics(userId, dateRange) {
        this.logger.log(`Fetching analytics for user ${userId} with range ${dateRange.startDate} - ${dateRange.endDate}`);
        const user = await this.userModel.findById(userId);
        if (!user) {
            throw new Error('User not found');
        }
        if (user.role === user_schema_1.UserRole.AGENT) {
            return this.getAgentAnalytics(userId, dateRange);
        }
        else {
            return this.getRegularUserAnalytics(userId, dateRange);
        }
    }
    async getRegularUserAnalytics(userId, dateRange) {
        const userObjectId = new mongoose_2.Types.ObjectId(userId);
        const user = await this.userModel.findById(userId).populate('favorites');
        const savedProperties = user?.favorites?.length || 0;
        const recentlyViewed = user?.recentlyViewed?.length || 0;
        const contactedAgents = await this.inquiryModel.countDocuments({
            userId: userObjectId,
            createdAt: { $gte: dateRange.startDate, $lte: dateRange.endDate },
        });
        const completedTransactions = await this.inquiryModel.countDocuments({
            userId: userObjectId,
            status: 'closed',
            createdAt: { $gte: dateRange.startDate, $lte: dateRange.endDate },
        });
        const engagementOverTime = await this.getEngagementOverTime(userObjectId, dateRange, 'user');
        const propertyTypeInterest = await this.getPropertyTypeInterest(userObjectId, dateRange);
        const recentActivity = await this.getRecentActivity(userObjectId, 5);
        const insights = await this.generateUserInsights(userObjectId, dateRange, savedProperties, recentlyViewed);
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
    async getAgentAnalytics(agentId, dateRange) {
        const agentObjectId = new mongoose_2.Types.ObjectId(agentId);
        const properties = await this.propertyModel.find({
            $or: [{ ownerId: agentObjectId }, { agentId: agentObjectId }],
        });
        const propertyIds = properties.map(p => p._id);
        const totalViews = await this.historyModel.countDocuments({
            agentId: agentObjectId,
            activityType: history_schema_1.ActivityType.PROPERTY_VIEW,
            createdAt: { $gte: dateRange.startDate, $lte: dateRange.endDate },
        });
        const savedProperties = properties.reduce((sum, p) => sum + (p.favoritesCount || 0), 0);
        const activeListings = properties.filter(p => p.isActive && p.availability === 'active').length;
        const inquiriesReceived = await this.inquiryModel.countDocuments({
            agentId: agentObjectId,
            createdAt: { $gte: dateRange.startDate, $lte: dateRange.endDate },
        });
        const estimatedRevenue = await this.calculateEstimatedRevenue(agentObjectId, dateRange);
        const engagementOverTime = await this.getEngagementOverTime(agentObjectId, dateRange, 'agent');
        const topPerformingListings = await this.getTopPerformingListings(propertyIds, 5);
        const engagementByCity = await this.getEngagementByCity(propertyIds);
        const conversionRate = await this.getConversionRate(agentObjectId, dateRange);
        const revenueByMonth = await this.getRevenueByMonth(agentObjectId, dateRange);
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
    async getEngagementOverTime(userId, dateRange, userType) {
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
            searches: day.activities.find((a) => a.type === history_schema_1.ActivityType.SEARCH)?.count || 0,
            views: day.activities.find((a) => a.type === history_schema_1.ActivityType.PROPERTY_VIEW)?.count || 0,
            saves: day.activities.find((a) => a.type === history_schema_1.ActivityType.FAVORITE_ADD)?.count || 0,
            inquiries: day.activities.find((a) => a.type === history_schema_1.ActivityType.PROPERTY_INQUIRY)?.count || 0,
        }));
    }
    async getPropertyTypeInterest(userId, dateRange) {
        const viewedProperties = await this.historyModel.aggregate([
            {
                $match: {
                    userId,
                    activityType: history_schema_1.ActivityType.PROPERTY_VIEW,
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
    async getRecentActivity(userId, limit) {
        const activities = await this.historyModel
            .find({ userId })
            .sort({ createdAt: -1 })
            .limit(limit)
            .populate('propertyId', 'title city images')
            .exec();
        return activities.map(activity => {
            const property = activity.propertyId;
            return {
                id: activity._id.toString(),
                type: activity.activityType,
                propertyTitle: property?.title || 'Unknown Property',
                timestamp: activity.createdAt,
                city: property?.city || activity.city || 'Unknown',
            };
        });
    }
    async getTopPerformingListings(propertyIds, limit) {
        const properties = await this.propertyModel
            .find({ _id: { $in: propertyIds } })
            .sort({ viewsCount: -1 })
            .limit(limit)
            .exec();
        return Promise.all(properties.map(async (property) => {
            const inquiries = await this.inquiryModel.countDocuments({
                propertyId: property._id,
            });
            return {
                id: property._id.toString(),
                title: property.title,
                views: property.viewsCount || 0,
                inquiries,
                saves: property.favoritesCount || 0,
                price: property.price,
                image: property.images?.[0]?.url || '',
            };
        }));
    }
    async getEngagementByCity(propertyIds) {
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
        return Promise.all(cityEngagement.map(async (city) => {
            const inquiries = await this.inquiryModel.countDocuments({
                propertyId: { $in: propertyIds },
            });
            return {
                city: city._id,
                views: city.views,
                inquiries,
            };
        }));
    }
    async getConversionRate(agentId, dateRange) {
        const totalInquiries = await this.inquiryModel.countDocuments({
            agentId,
            createdAt: { $gte: dateRange.startDate, $lte: dateRange.endDate },
        });
        const responded = await this.inquiryModel.countDocuments({
            agentId,
            status: 'responded',
            createdAt: { $gte: dateRange.startDate, $lte: dateRange.endDate },
        });
        const closed = await this.inquiryModel.countDocuments({
            agentId,
            status: 'closed',
            createdAt: { $gte: dateRange.startDate, $lte: dateRange.endDate },
        });
        return {
            totalInquiries,
            responded,
            closed,
            conversionPercentage: totalInquiries > 0 ? Math.round((closed / totalInquiries) * 100) : 0,
        };
    }
    async calculateEstimatedRevenue(agentId, dateRange) {
        const soldProperties = await this.propertyModel.find({
            $or: [{ ownerId: agentId }, { agentId }],
            availability: { $in: ['sold', 'rented'] },
            updatedAt: { $gte: dateRange.startDate, $lte: dateRange.endDate },
        });
        return soldProperties.reduce((sum, property) => sum + property.price, 0);
    }
    async getRevenueByMonth(agentId, dateRange) {
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
    async generateUserInsights(userId, dateRange, savedProperties, recentlyViewed) {
        const insights = [];
        const periodLength = dateRange.endDate.getTime() - dateRange.startDate.getTime();
        const previousPeriodStart = new Date(dateRange.startDate.getTime() - periodLength);
        const currentViews = await this.historyModel.countDocuments({
            userId,
            activityType: history_schema_1.ActivityType.PROPERTY_VIEW,
            createdAt: { $gte: dateRange.startDate, $lte: dateRange.endDate },
        });
        const previousViews = await this.historyModel.countDocuments({
            userId,
            activityType: history_schema_1.ActivityType.PROPERTY_VIEW,
            createdAt: { $gte: previousPeriodStart, $lt: dateRange.startDate },
        });
        if (previousViews > 0) {
            const percentChange = Math.round(((currentViews - previousViews) / previousViews) * 100);
            if (percentChange > 0) {
                insights.push(`You've viewed ${currentViews} properties this period — ${percentChange}% more than last period.`);
            }
            else if (percentChange < 0) {
                insights.push(`Your property views decreased by ${Math.abs(percentChange)}% compared to last period.`);
            }
        }
        const topType = await this.historyModel.aggregate([
            {
                $match: {
                    userId,
                    activityType: history_schema_1.ActivityType.PROPERTY_VIEW,
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
        if (savedProperties > 5) {
            insights.push(`You have ${savedProperties} saved properties. Ready to schedule viewings?`);
        }
        return insights;
    }
    async exportAnalytics(userId, dateRange, format) {
        const analytics = await this.getAnalytics(userId, dateRange);
        if (format === 'json') {
            return analytics;
        }
        return this.convertToCSV(analytics);
    }
    convertToCSV(data) {
        return JSON.stringify(data);
    }
};
exports.AnalyticsService = AnalyticsService;
exports.AnalyticsService = AnalyticsService = AnalyticsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(user_schema_1.User.name)),
    __param(1, (0, mongoose_1.InjectModel)(property_schema_1.Property.name)),
    __param(2, (0, mongoose_1.InjectModel)(inquiry_schema_1.Inquiry.name)),
    __param(3, (0, mongoose_1.InjectModel)(history_schema_1.History.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model])
], AnalyticsService);
//# sourceMappingURL=analytics.service.js.map