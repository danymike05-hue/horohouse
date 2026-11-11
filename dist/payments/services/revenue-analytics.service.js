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
var RevenueAnalyticsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RevenueAnalyticsService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const transaction_schema_1 = require("../schemas/transaction.schema");
const subscription_schema_1 = require("../schemas/subscription.schema");
const listing_boost_schema_1 = require("../schemas/listing-boost.schema");
let RevenueAnalyticsService = RevenueAnalyticsService_1 = class RevenueAnalyticsService {
    transactionModel;
    subscriptionModel;
    listingBoostModel;
    logger = new common_1.Logger(RevenueAnalyticsService_1.name);
    constructor(transactionModel, subscriptionModel, listingBoostModel) {
        this.transactionModel = transactionModel;
        this.subscriptionModel = subscriptionModel;
        this.listingBoostModel = listingBoostModel;
    }
    async getRevenueAnalytics() {
        try {
            this.logger.log('Generating revenue analytics');
            const now = new Date();
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            const startOfYear = new Date(now.getFullYear(), 0, 1);
            const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
            const successfulTransactions = await this.transactionModel.find({
                status: transaction_schema_1.TransactionStatus.SUCCESS,
            });
            const totalRevenue = successfulTransactions.reduce((sum, t) => sum + t.amount, 0);
            const monthlyTransactions = successfulTransactions.filter(t => t.completedAt && t.completedAt >= startOfMonth);
            const monthlyRevenue = monthlyTransactions.reduce((sum, t) => sum + t.amount, 0);
            const yearlyTransactions = successfulTransactions.filter(t => t.completedAt && t.completedAt >= startOfYear);
            const yearlyRevenue = yearlyTransactions.reduce((sum, t) => sum + t.amount, 0);
            const todayTransactions = successfulTransactions.filter(t => t.completedAt && t.completedAt >= startOfDay);
            const todayRevenue = todayTransactions.reduce((sum, t) => sum + t.amount, 0);
            const allTransactions = await this.transactionModel.countDocuments();
            const successful = successfulTransactions.length;
            const failed = await this.transactionModel.countDocuments({ status: transaction_schema_1.TransactionStatus.FAILED });
            const pending = await this.transactionModel.countDocuments({ status: transaction_schema_1.TransactionStatus.PENDING });
            const avgTransactionValue = successful > 0 ? totalRevenue / successful : 0;
            const revenueByType = {
                subscriptions: 0,
                listingFees: 0,
                boosts: 0,
                commissions: 0,
                digitalServices: 0,
            };
            successfulTransactions.forEach(t => {
                switch (t.type) {
                    case transaction_schema_1.TransactionType.SUBSCRIPTION:
                        revenueByType.subscriptions += t.amount;
                        break;
                    case transaction_schema_1.TransactionType.LISTING_FEE:
                        revenueByType.listingFees += t.amount;
                        break;
                    case transaction_schema_1.TransactionType.BOOST_LISTING:
                        revenueByType.boosts += t.amount;
                        break;
                    case transaction_schema_1.TransactionType.COMMISSION:
                        revenueByType.commissions += t.amount;
                        break;
                    case transaction_schema_1.TransactionType.DIGITAL_SERVICE:
                        revenueByType.digitalServices += t.amount;
                        break;
                }
            });
            const activeSubscriptions = await this.subscriptionModel.find({
                status: subscription_schema_1.SubscriptionStatus.ACTIVE,
            });
            const mrr = activeSubscriptions.reduce((sum, sub) => {
                let monthlyAmount = sub.price;
                if (sub.billingCycle === 'yearly') {
                    monthlyAmount = sub.price / 12;
                }
                else if (sub.billingCycle === 'quarterly') {
                    monthlyAmount = sub.price / 3;
                }
                return sum + monthlyAmount;
            }, 0);
            const arr = mrr * 12;
            const uniqueUserIds = new Set(successfulTransactions.map(t => t.userId.toString()));
            const totalUsers = uniqueUserIds.size;
            const arpu = totalUsers > 0 ? totalRevenue / totalUsers : 0;
            const conversionRate = allTransactions > 0 ? (successful / allTransactions) * 100 : 0;
            const lastMonthTransactions = await this.transactionModel.find({
                status: transaction_schema_1.TransactionStatus.SUCCESS,
                completedAt: { $gte: lastMonth, $lte: endOfLastMonth },
            });
            const lastMonthRevenue = lastMonthTransactions.reduce((sum, t) => sum + t.amount, 0);
            const revenueGrowth = lastMonthRevenue > 0
                ? ((monthlyRevenue - lastMonthRevenue) / lastMonthRevenue) * 100
                : 0;
            const paymentMethodsMap = new Map();
            successfulTransactions.forEach(t => {
                const method = t.paymentMethod;
                const existing = paymentMethodsMap.get(method) || { count: 0, revenue: 0 };
                existing.count += 1;
                existing.revenue += t.amount;
                paymentMethodsMap.set(method, existing);
            });
            const paymentMethodsDistribution = Array.from(paymentMethodsMap.entries()).map(([method, data]) => ({
                method,
                count: data.count,
                revenue: data.revenue,
                percentage: (data.revenue / totalRevenue) * 100,
            }));
            return {
                totalRevenue,
                monthlyRevenue,
                yearlyRevenue,
                todayRevenue,
                totalTransactions: allTransactions,
                successfulTransactions: successful,
                failedTransactions: failed,
                pendingTransactions: pending,
                averageTransactionValue: avgTransactionValue,
                revenueByType,
                mrr,
                arr,
                arpu,
                conversionRate,
                revenueGrowth,
                paymentMethodsDistribution,
            };
        }
        catch (error) {
            this.logger.error('Error generating revenue analytics:', error);
            throw error;
        }
    }
    async getMonthlyRevenueChart(months = 12) {
        try {
            const monthlyData = [];
            const now = new Date();
            for (let i = months - 1; i >= 0; i--) {
                const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
                const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
                const transactions = await this.transactionModel.find({
                    status: transaction_schema_1.TransactionStatus.SUCCESS,
                    completedAt: { $gte: monthStart, $lte: monthEnd },
                });
                const revenue = transactions.reduce((sum, t) => sum + t.amount, 0);
                const avgValue = transactions.length > 0 ? revenue / transactions.length : 0;
                monthlyData.push({
                    month: monthStart.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
                    revenue,
                    transactions: transactions.length,
                    avgTransactionValue: avgValue,
                });
            }
            return monthlyData;
        }
        catch (error) {
            this.logger.error('Error generating monthly revenue chart:', error);
            throw error;
        }
    }
    async getSubscriptionAnalytics() {
        try {
            const activeSubscriptions = await this.subscriptionModel.countDocuments({
                status: subscription_schema_1.SubscriptionStatus.ACTIVE,
            });
            const expiredSubscriptions = await this.subscriptionModel.countDocuments({
                status: subscription_schema_1.SubscriptionStatus.EXPIRED,
            });
            const cancelledSubscriptions = await this.subscriptionModel.countDocuments({
                status: subscription_schema_1.SubscriptionStatus.CANCELLED,
            });
            const subscriptionsByPlan = await this.subscriptionModel.aggregate([
                { $match: { status: subscription_schema_1.SubscriptionStatus.ACTIVE } },
                { $group: { _id: '$plan', count: { $sum: 1 } } },
            ]);
            const churnRate = (expiredSubscriptions + cancelledSubscriptions) > 0
                ? (cancelledSubscriptions / (activeSubscriptions + expiredSubscriptions + cancelledSubscriptions)) * 100
                : 0;
            return {
                activeSubscriptions,
                expiredSubscriptions,
                cancelledSubscriptions,
                subscriptionsByPlan,
                churnRate,
            };
        }
        catch (error) {
            this.logger.error('Error generating subscription analytics:', error);
            throw error;
        }
    }
    async getBoostAnalytics() {
        try {
            const totalBoosts = await this.listingBoostModel.countDocuments();
            const activeBoosts = await this.listingBoostModel.countDocuments({
                status: { $eq: 'active' },
            });
            const boostsByType = await this.listingBoostModel.aggregate([
                { $group: { _id: '$boostType', count: { $sum: 1 } } },
            ]);
            const boostRevenue = await this.transactionModel.aggregate([
                {
                    $match: {
                        type: transaction_schema_1.TransactionType.BOOST_LISTING,
                        status: transaction_schema_1.TransactionStatus.SUCCESS,
                    },
                },
                { $group: { _id: null, total: { $sum: '$amount' } } },
            ]);
            const boosts = await this.listingBoostModel.find({ status: { $eq: 'active' } });
            const totalImpressions = boosts.reduce((sum, b) => sum + (b.impressions ?? 0), 0);
            const totalClicks = boosts.reduce((sum, b) => sum + (b.clicks ?? 0), 0);
            const avgCTR = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
            return {
                totalBoosts,
                activeBoosts,
                boostsByType,
                boostRevenue: boostRevenue[0]?.total || 0,
                totalImpressions,
                totalClicks,
                averageCTR: avgCTR,
            };
        }
        catch (error) {
            this.logger.error('Error generating boost analytics:', error);
            throw error;
        }
    }
    async getTopRevenueUsers(limit = 10) {
        try {
            return this.transactionModel.aggregate([
                { $match: { status: transaction_schema_1.TransactionStatus.SUCCESS } },
                {
                    $group: {
                        _id: '$userId',
                        totalRevenue: { $sum: '$amount' },
                        transactionCount: { $sum: 1 },
                    },
                },
                { $sort: { totalRevenue: -1 } },
                { $limit: limit },
                {
                    $lookup: {
                        from: 'users',
                        localField: '_id',
                        foreignField: '_id',
                        as: 'user',
                    },
                },
                { $unwind: '$user' },
                {
                    $project: {
                        userId: '$_id',
                        userName: '$user.name',
                        userEmail: '$user.email',
                        totalRevenue: 1,
                        transactionCount: 1,
                    },
                },
            ]);
        }
        catch (error) {
            this.logger.error('Error getting top revenue users:', error);
            throw error;
        }
    }
};
exports.RevenueAnalyticsService = RevenueAnalyticsService;
exports.RevenueAnalyticsService = RevenueAnalyticsService = RevenueAnalyticsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(transaction_schema_1.Transaction.name)),
    __param(1, (0, mongoose_1.InjectModel)(subscription_schema_1.Subscription.name)),
    __param(2, (0, mongoose_1.InjectModel)(listing_boost_schema_1.ListingBoost.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model])
], RevenueAnalyticsService);
//# sourceMappingURL=revenue-analytics.service.js.map