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
Object.defineProperty(exports, "__esModule", { value: true });
exports.RevenueAnalyticsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const revenue_analytics_service_1 = require("../services/revenue-analytics.service");
const jwt_auth_guard_1 = require("../../auth/guards/jwt.auth.guard");
const roles_guard_1 = require("../../auth/guards/roles.guard");
const roles_guard_2 = require("../../auth/guards/roles.guard");
const user_schema_1 = require("../../users/schemas/user.schema");
let RevenueAnalyticsController = class RevenueAnalyticsController {
    revenueAnalyticsService;
    constructor(revenueAnalyticsService) {
        this.revenueAnalyticsService = revenueAnalyticsService;
    }
    async getRevenueOverview() {
        return this.revenueAnalyticsService.getRevenueAnalytics();
    }
    async getMonthlyRevenueChart(months) {
        return this.revenueAnalyticsService.getMonthlyRevenueChart(months);
    }
    async getSubscriptionAnalytics() {
        return this.revenueAnalyticsService.getSubscriptionAnalytics();
    }
    async getBoostAnalytics() {
        return this.revenueAnalyticsService.getBoostAnalytics();
    }
    async getTopRevenueUsers(limit) {
        return this.revenueAnalyticsService.getTopRevenueUsers(limit);
    }
    async getAnalyticsSummary() {
        const [revenue, subscriptions, boosts] = await Promise.all([
            this.revenueAnalyticsService.getRevenueAnalytics(),
            this.revenueAnalyticsService.getSubscriptionAnalytics(),
            this.revenueAnalyticsService.getBoostAnalytics(),
        ]);
        return {
            revenue: {
                total: revenue.totalRevenue,
                monthly: revenue.monthlyRevenue,
                yearly: revenue.yearlyRevenue,
                today: revenue.todayRevenue,
                mrr: revenue.mrr,
                arr: revenue.arr,
                growth: revenue.revenueGrowth,
            },
            transactions: {
                total: revenue.totalTransactions,
                successful: revenue.successfulTransactions,
                failed: revenue.failedTransactions,
                pending: revenue.pendingTransactions,
                conversionRate: revenue.conversionRate,
                averageValue: revenue.averageTransactionValue,
            },
            subscriptions: {
                active: subscriptions.activeSubscriptions,
                expired: subscriptions.expiredSubscriptions,
                cancelled: subscriptions.cancelledSubscriptions,
                churnRate: subscriptions.churnRate,
                byPlan: subscriptions.subscriptionsByPlan,
            },
            boosts: {
                total: boosts.totalBoosts,
                active: boosts.activeBoosts,
                revenue: boosts.boostRevenue,
                impressions: boosts.totalImpressions,
                clicks: boosts.totalClicks,
                ctr: boosts.averageCTR,
                byType: boosts.boostsByType,
            },
            revenueBreakdown: revenue.revenueByType,
            paymentMethods: revenue.paymentMethodsDistribution,
            metrics: {
                arpu: revenue.arpu,
                ltv: revenue.arpu * 12,
            },
        };
    }
};
exports.RevenueAnalyticsController = RevenueAnalyticsController;
__decorate([
    (0, common_1.Get)('overview'),
    (0, roles_guard_2.Roles)(user_schema_1.UserRole.ADMIN),
    (0, swagger_1.ApiOperation)({
        summary: 'Get comprehensive revenue analytics overview',
        description: 'Returns detailed revenue metrics including MRR, ARR, ARPU, conversion rates, and revenue breakdown by type and payment method. Admin only.',
    }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'Revenue analytics retrieved successfully',
        schema: {
            type: 'object',
            properties: {
                totalRevenue: { type: 'number', example: 5000000 },
                monthlyRevenue: { type: 'number', example: 450000 },
                yearlyRevenue: { type: 'number', example: 4800000 },
                todayRevenue: { type: 'number', example: 25000 },
                totalTransactions: { type: 'number', example: 1250 },
                successfulTransactions: { type: 'number', example: 1100 },
                failedTransactions: { type: 'number', example: 100 },
                pendingTransactions: { type: 'number', example: 50 },
                averageTransactionValue: { type: 'number', example: 4545.45 },
                revenueByType: {
                    type: 'object',
                    properties: {
                        subscriptions: { type: 'number' },
                        listingFees: { type: 'number' },
                        boosts: { type: 'number' },
                        commissions: { type: 'number' },
                        digitalServices: { type: 'number' },
                    },
                },
                mrr: { type: 'number', example: 125000, description: 'Monthly Recurring Revenue' },
                arr: { type: 'number', example: 1500000, description: 'Annual Recurring Revenue' },
                arpu: { type: 'number', example: 5000, description: 'Average Revenue Per User' },
                conversionRate: { type: 'number', example: 88.5, description: 'Percentage' },
                revenueGrowth: { type: 'number', example: 15.3, description: 'Month-over-month growth %' },
                paymentMethodsDistribution: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            method: { type: 'string' },
                            count: { type: 'number' },
                            revenue: { type: 'number' },
                            percentage: { type: 'number' },
                        },
                    },
                },
            },
        },
    }),
    (0, swagger_1.ApiResponse)({ status: 403, description: 'Forbidden - Admin access required' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], RevenueAnalyticsController.prototype, "getRevenueOverview", null);
__decorate([
    (0, common_1.Get)('monthly-chart'),
    (0, swagger_1.ApiOperation)({
        summary: 'Get monthly revenue chart data',
        description: 'Returns revenue data for the specified number of months for chart visualization.',
    }),
    (0, swagger_1.ApiQuery)({
        name: 'months',
        required: false,
        type: Number,
        description: 'Number of months to retrieve (default: 12)',
        example: 12,
    }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'Monthly revenue data retrieved successfully',
        schema: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    month: { type: 'string', example: 'Jan 2024' },
                    revenue: { type: 'number', example: 450000 },
                    transactions: { type: 'number', example: 95 },
                    avgTransactionValue: { type: 'number', example: 4736.84 },
                },
            },
        },
    }),
    (0, swagger_1.ApiResponse)({ status: 403, description: 'Forbidden - Admin access required' }),
    __param(0, (0, common_1.Query)('months', new common_1.DefaultValuePipe(12), common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], RevenueAnalyticsController.prototype, "getMonthlyRevenueChart", null);
__decorate([
    (0, common_1.Get)('subscriptions'),
    (0, roles_guard_2.Roles)(user_schema_1.UserRole.ADMIN),
    (0, swagger_1.ApiOperation)({
        summary: 'Get subscription analytics',
        description: 'Returns subscription metrics including active/expired/cancelled counts, distribution by plan, and churn rate. Admin only.',
    }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'Subscription analytics retrieved successfully',
        schema: {
            type: 'object',
            properties: {
                activeSubscriptions: { type: 'number', example: 250 },
                expiredSubscriptions: { type: 'number', example: 45 },
                cancelledSubscriptions: { type: 'number', example: 30 },
                subscriptionsByPlan: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            _id: { type: 'string', example: 'professional' },
                            count: { type: 'number', example: 120 },
                        },
                    },
                },
                churnRate: { type: 'number', example: 9.23, description: 'Percentage' },
            },
        },
    }),
    (0, swagger_1.ApiResponse)({ status: 403, description: 'Forbidden - Admin access required' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], RevenueAnalyticsController.prototype, "getSubscriptionAnalytics", null);
__decorate([
    (0, common_1.Get)('boosts'),
    (0, roles_guard_2.Roles)(user_schema_1.UserRole.ADMIN),
    (0, swagger_1.ApiOperation)({
        summary: 'Get listing boost analytics',
        description: 'Returns boost metrics including total/active boosts, revenue, impressions, clicks, and CTR. Admin only.',
    }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'Boost analytics retrieved successfully',
        schema: {
            type: 'object',
            properties: {
                totalBoosts: { type: 'number', example: 450 },
                activeBoosts: { type: 'number', example: 120 },
                boostsByType: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            _id: { type: 'string', example: 'premium' },
                            count: { type: 'number', example: 75 },
                        },
                    },
                },
                boostRevenue: { type: 'number', example: 850000 },
                totalImpressions: { type: 'number', example: 125000 },
                totalClicks: { type: 'number', example: 8500 },
                averageCTR: { type: 'number', example: 6.8, description: 'Click-through rate %' },
            },
        },
    }),
    (0, swagger_1.ApiResponse)({ status: 403, description: 'Forbidden - Admin access required' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], RevenueAnalyticsController.prototype, "getBoostAnalytics", null);
__decorate([
    (0, common_1.Get)('top-users'),
    (0, roles_guard_2.Roles)(user_schema_1.UserRole.ADMIN),
    (0, swagger_1.ApiOperation)({
        summary: 'Get top revenue generating users',
        description: 'Returns the top users by total revenue generated. Admin only.',
    }),
    (0, swagger_1.ApiQuery)({
        name: 'limit',
        required: false,
        type: Number,
        description: 'Number of top users to retrieve (default: 10)',
        example: 10,
    }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'Top revenue users retrieved successfully',
        schema: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    userId: { type: 'string', example: '507f1f77bcf86cd799439011' },
                    userName: { type: 'string', example: 'John Doe' },
                    userEmail: { type: 'string', example: 'john@example.com' },
                    totalRevenue: { type: 'number', example: 250000 },
                    transactionCount: { type: 'number', example: 25 },
                },
            },
        },
    }),
    (0, swagger_1.ApiResponse)({ status: 403, description: 'Forbidden - Admin access required' }),
    __param(0, (0, common_1.Query)('limit', new common_1.DefaultValuePipe(10), common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], RevenueAnalyticsController.prototype, "getTopRevenueUsers", null);
__decorate([
    (0, common_1.Get)('summary'),
    (0, roles_guard_2.Roles)(user_schema_1.UserRole.ADMIN),
    (0, swagger_1.ApiOperation)({
        summary: 'Get consolidated analytics summary',
        description: 'Returns a consolidated view of revenue, subscriptions, and boost analytics. Admin only.',
    }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'Analytics summary retrieved successfully',
    }),
    (0, swagger_1.ApiResponse)({ status: 403, description: 'Forbidden - Admin access required' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], RevenueAnalyticsController.prototype, "getAnalyticsSummary", null);
exports.RevenueAnalyticsController = RevenueAnalyticsController = __decorate([
    (0, swagger_1.ApiTags)('Revenue Analytics'),
    (0, common_1.Controller)('analytics/revenue'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, swagger_1.ApiBearerAuth)('JWT-auth'),
    __metadata("design:paramtypes", [revenue_analytics_service_1.RevenueAnalyticsService])
], RevenueAnalyticsController);
//# sourceMappingURL=revenue-analytics.controller.js.map