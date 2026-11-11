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
exports.AnalyticsController = void 0;
const common_1 = require("@nestjs/common");
const analytics_service_1 = require("./analytics.service");
const jwt_auth_guard_1 = require("../auth/guards/jwt.auth.guard");
let AnalyticsController = class AnalyticsController {
    analyticsService;
    constructor(analyticsService) {
        this.analyticsService = analyticsService;
    }
    async getDashboard(req, startDate, endDate) {
        const userId = req.user.userId || req.user.id;
        const dateRange = this.parseDateRange(startDate, endDate);
        return this.analyticsService.getAnalytics(userId, dateRange);
    }
    async getEngagement(req, startDate, endDate, granularity = 'day') {
        const userId = req.user.userId || req.user.id;
        const dateRange = this.parseDateRange(startDate, endDate);
        const analytics = await this.analyticsService.getAnalytics(userId, dateRange);
        return {
            engagementOverTime: analytics.engagementOverTime,
            granularity,
        };
    }
    async getKPIs(req, startDate, endDate) {
        const userId = req.user.userId || req.user.id;
        const dateRange = this.parseDateRange(startDate, endDate);
        const analytics = await this.analyticsService.getAnalytics(userId, dateRange);
        return analytics.kpis;
    }
    async exportData(req, startDate, endDate, format = 'json') {
        const userId = req.user.userId || req.user.id;
        const dateRange = this.parseDateRange(startDate, endDate);
        return this.analyticsService.exportAnalytics(userId, dateRange, format);
    }
    async getComparison(req, startDate, endDate) {
        const userId = req.user.userId || req.user.id;
        const dateRange = this.parseDateRange(startDate, endDate);
        const periodLength = dateRange.endDate.getTime() - dateRange.startDate.getTime();
        const previousPeriodEnd = new Date(dateRange.startDate.getTime() - 1);
        const previousPeriodStart = new Date(previousPeriodEnd.getTime() - periodLength);
        const [currentPeriod, previousPeriod] = await Promise.all([
            this.analyticsService.getAnalytics(userId, dateRange),
            this.analyticsService.getAnalytics(userId, {
                startDate: previousPeriodStart,
                endDate: previousPeriodEnd,
            }),
        ]);
        return {
            current: currentPeriod,
            previous: previousPeriod,
            comparison: this.calculateComparison(currentPeriod.kpis, previousPeriod.kpis),
        };
    }
    parseDateRange(startDate, endDate) {
        const end = endDate ? new Date(endDate) : new Date();
        const start = startDate
            ? new Date(startDate)
            : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
        if (isNaN(start.getTime())) {
            throw new common_1.BadRequestException('Invalid startDate format');
        }
        if (isNaN(end.getTime())) {
            throw new common_1.BadRequestException('Invalid endDate format');
        }
        if (start > end) {
            throw new common_1.BadRequestException('startDate must be before endDate');
        }
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        return { startDate: start, endDate: end };
    }
    calculateComparison(current, previous) {
        const comparison = {};
        for (const key in current) {
            if (typeof current[key] === 'number' && typeof previous[key] === 'number') {
                const currentValue = current[key];
                const previousValue = previous[key];
                const change = currentValue - previousValue;
                const percentChange = previousValue !== 0
                    ? Math.round((change / previousValue) * 100)
                    : currentValue > 0
                        ? 100
                        : 0;
                comparison[key] = {
                    current: currentValue,
                    previous: previousValue,
                    change,
                    percentChange,
                    trend: change > 0 ? 'up' : change < 0 ? 'down' : 'stable',
                };
            }
        }
        return comparison;
    }
};
exports.AnalyticsController = AnalyticsController;
__decorate([
    (0, common_1.Get)('dashboard'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Query)('startDate')),
    __param(2, (0, common_1.Query)('endDate')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], AnalyticsController.prototype, "getDashboard", null);
__decorate([
    (0, common_1.Get)('engagement'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Query)('startDate')),
    __param(2, (0, common_1.Query)('endDate')),
    __param(3, (0, common_1.Query)('granularity')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String]),
    __metadata("design:returntype", Promise)
], AnalyticsController.prototype, "getEngagement", null);
__decorate([
    (0, common_1.Get)('kpis'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Query)('startDate')),
    __param(2, (0, common_1.Query)('endDate')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], AnalyticsController.prototype, "getKPIs", null);
__decorate([
    (0, common_1.Get)('export'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Query)('startDate')),
    __param(2, (0, common_1.Query)('endDate')),
    __param(3, (0, common_1.Query)('format')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String]),
    __metadata("design:returntype", Promise)
], AnalyticsController.prototype, "exportData", null);
__decorate([
    (0, common_1.Get)('comparison'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Query)('startDate')),
    __param(2, (0, common_1.Query)('endDate')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], AnalyticsController.prototype, "getComparison", null);
exports.AnalyticsController = AnalyticsController = __decorate([
    (0, common_1.Controller)('analytics'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [analytics_service_1.AnalyticsService])
], AnalyticsController);
//# sourceMappingURL=analytics.controller.js.map