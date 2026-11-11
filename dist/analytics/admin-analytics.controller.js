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
exports.AdminAnalyticsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const admin_analytics_service_1 = require("./admin-analytics.service");
const admin_analytics_dto_1 = require("./dto/admin-analytics.dto");
const jwt_auth_guard_1 = require("../auth/guards/jwt.auth.guard");
const roles_guard_1 = require("../auth/guards/roles.guard");
const user_schema_1 = require("../users/schemas/user.schema");
function parseDateRange(startDate, endDate) {
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate
        ? new Date(startDate)
        : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
    if (isNaN(start.getTime()))
        throw new common_1.BadRequestException('Invalid startDate');
    if (isNaN(end.getTime()))
        throw new common_1.BadRequestException('Invalid endDate');
    if (start > end)
        throw new common_1.BadRequestException('startDate must be before endDate');
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    return { startDate: start, endDate: end };
}
let AdminAnalyticsController = class AdminAnalyticsController {
    adminAnalyticsService;
    constructor(adminAnalyticsService) {
        this.adminAnalyticsService = adminAnalyticsService;
    }
    async getDashboard(query) {
        const dateRange = parseDateRange(query.startDate, query.endDate);
        const granularity = query.granularity ?? 'month';
        return this.adminAnalyticsService.getAdminDashboard(dateRange, granularity);
    }
    async getKPIs(query) {
        const dateRange = parseDateRange(query.startDate, query.endDate);
        return this.adminAnalyticsService.getPlatformKPIs(dateRange);
    }
    async getRevenue(query) {
        const dateRange = parseDateRange(query.startDate, query.endDate);
        return this.adminAnalyticsService.getRevenueOverTime(dateRange, query.granularity ?? 'month', { hostId: query.hostId, propertyType: query.propertyType });
    }
    async getOccupancy(query) {
        const dateRange = parseDateRange(query.startDate, query.endDate);
        return this.adminAnalyticsService.getOccupancyOverTime(dateRange, query.granularity ?? 'month', { propertyId: query.propertyId, city: query.city });
    }
    async getStatusBreakdown(query) {
        const dateRange = parseDateRange(query.startDate, query.endDate);
        return this.adminAnalyticsService.getBookingStatusBreakdown(dateRange);
    }
    async getPropertyTypeBreakdown(query) {
        const dateRange = parseDateRange(query.startDate, query.endDate);
        return this.adminAnalyticsService.getPropertyTypeBreakdown(dateRange);
    }
    async getTopProperties(query) {
        const dateRange = parseDateRange(query.startDate, query.endDate);
        const limit = query.limit ? parseInt(query.limit, 10) : 10;
        return this.adminAnalyticsService.getTopProperties(dateRange, limit);
    }
    async getCityPerformance(query) {
        const dateRange = parseDateRange(query.startDate, query.endDate);
        const limit = query.limit ? parseInt(query.limit, 10) : 10;
        return this.adminAnalyticsService.getCityPerformance(dateRange, limit);
    }
    async getHostLeaderboard(query) {
        const dateRange = parseDateRange(query.startDate, query.endDate);
        const limit = query.limit ? parseInt(query.limit, 10) : 10;
        return this.adminAnalyticsService.getHostLeaderboard(dateRange, limit);
    }
    async getComparison(query) {
        const dateRange = parseDateRange(query.startDate, query.endDate);
        return this.adminAnalyticsService.getKPIComparison(dateRange);
    }
};
exports.AdminAnalyticsController = AdminAnalyticsController;
__decorate([
    (0, common_1.Get)('dashboard'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({
        summary: 'Admin dashboard — full analytics snapshot',
        description: 'Returns all sections of the admin dashboard in a single call: ' +
            'platform KPIs, revenue over time, occupancy over time, status breakdown, ' +
            'property type breakdown, top properties, city performance, host leaderboard.',
    }),
    (0, swagger_1.ApiQuery)({ name: 'startDate', required: false, type: String, description: 'ISO date (default: 30 days ago)' }),
    (0, swagger_1.ApiQuery)({ name: 'endDate', required: false, type: String, description: 'ISO date (default: today)' }),
    (0, swagger_1.ApiQuery)({ name: 'granularity', required: false, enum: ['day', 'week', 'month'], description: 'Chart granularity (default: month)' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Full dashboard analytics' }),
    (0, swagger_1.ApiResponse)({ status: 403, description: 'Admin only' }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [admin_analytics_dto_1.AdminAnalyticsQueryDto]),
    __metadata("design:returntype", Promise)
], AdminAnalyticsController.prototype, "getDashboard", null);
__decorate([
    (0, common_1.Get)('kpis'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({
        summary: 'Platform KPIs',
        description: 'Total bookings, revenue, cancellation rate, occupancy rate, ' +
            'new guests, average booking value, review completion rate, etc.',
    }),
    (0, swagger_1.ApiQuery)({ name: 'startDate', required: false, type: String }),
    (0, swagger_1.ApiQuery)({ name: 'endDate', required: false, type: String }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Platform KPI object' }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [admin_analytics_dto_1.AdminDateRangeDto]),
    __metadata("design:returntype", Promise)
], AdminAnalyticsController.prototype, "getKPIs", null);
__decorate([
    (0, common_1.Get)('revenue'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({
        summary: 'Revenue over time',
        description: 'Gross revenue and platform fees per period bucket. ' +
            'Optionally filtered by hostId or property type.',
    }),
    (0, swagger_1.ApiQuery)({ name: 'startDate', required: false, type: String }),
    (0, swagger_1.ApiQuery)({ name: 'endDate', required: false, type: String }),
    (0, swagger_1.ApiQuery)({ name: 'granularity', required: false, enum: ['day', 'week', 'month'] }),
    (0, swagger_1.ApiQuery)({ name: 'hostId', required: false, type: String, description: 'Filter by host user ID' }),
    (0, swagger_1.ApiQuery)({ name: 'propertyType', required: false, type: String, description: 'Filter by property type slug' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Array of RevenueDataPoint' }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [admin_analytics_dto_1.RevenueQueryDto]),
    __metadata("design:returntype", Promise)
], AdminAnalyticsController.prototype, "getRevenue", null);
__decorate([
    (0, common_1.Get)('occupancy'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({
        summary: 'Occupancy rate over time',
        description: 'Nights booked vs available per period. ' +
            'Only counts short-term listings. ' +
            'Optionally filtered by propertyId or city.',
    }),
    (0, swagger_1.ApiQuery)({ name: 'startDate', required: false, type: String }),
    (0, swagger_1.ApiQuery)({ name: 'endDate', required: false, type: String }),
    (0, swagger_1.ApiQuery)({ name: 'granularity', required: false, enum: ['day', 'week', 'month'] }),
    (0, swagger_1.ApiQuery)({ name: 'propertyId', required: false, type: String }),
    (0, swagger_1.ApiQuery)({ name: 'city', required: false, type: String }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Array of OccupancyDataPoint' }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [admin_analytics_dto_1.OccupancyQueryDto]),
    __metadata("design:returntype", Promise)
], AdminAnalyticsController.prototype, "getOccupancy", null);
__decorate([
    (0, common_1.Get)('breakdown/status'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Booking status breakdown (confirmed, cancelled, completed, etc.)' }),
    (0, swagger_1.ApiQuery)({ name: 'startDate', required: false, type: String }),
    (0, swagger_1.ApiQuery)({ name: 'endDate', required: false, type: String }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Array of BookingStatusBreakdown' }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [admin_analytics_dto_1.AdminDateRangeDto]),
    __metadata("design:returntype", Promise)
], AdminAnalyticsController.prototype, "getStatusBreakdown", null);
__decorate([
    (0, common_1.Get)('breakdown/property-type'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Bookings and revenue broken down by property type' }),
    (0, swagger_1.ApiQuery)({ name: 'startDate', required: false, type: String }),
    (0, swagger_1.ApiQuery)({ name: 'endDate', required: false, type: String }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Array of PropertyTypeBreakdown' }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [admin_analytics_dto_1.AdminDateRangeDto]),
    __metadata("design:returntype", Promise)
], AdminAnalyticsController.prototype, "getPropertyTypeBreakdown", null);
__decorate([
    (0, common_1.Get)('top-properties'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Top properties by revenue in the period' }),
    (0, swagger_1.ApiQuery)({ name: 'startDate', required: false, type: String }),
    (0, swagger_1.ApiQuery)({ name: 'endDate', required: false, type: String }),
    (0, swagger_1.ApiQuery)({ name: 'limit', required: false, type: Number, description: 'Max results (default 10)' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Array of TopProperty' }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AdminAnalyticsController.prototype, "getTopProperties", null);
__decorate([
    (0, common_1.Get)('city-performance'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Booking volume and revenue by city' }),
    (0, swagger_1.ApiQuery)({ name: 'startDate', required: false, type: String }),
    (0, swagger_1.ApiQuery)({ name: 'endDate', required: false, type: String }),
    (0, swagger_1.ApiQuery)({ name: 'limit', required: false, type: Number, description: 'Max cities (default 10)' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Array of CityPerformance' }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AdminAnalyticsController.prototype, "getCityPerformance", null);
__decorate([
    (0, common_1.Get)('host-leaderboard'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Top hosts by revenue with booking count and rating' }),
    (0, swagger_1.ApiQuery)({ name: 'startDate', required: false, type: String }),
    (0, swagger_1.ApiQuery)({ name: 'endDate', required: false, type: String }),
    (0, swagger_1.ApiQuery)({ name: 'limit', required: false, type: Number, description: 'Max hosts (default 10)' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Array of HostLeaderboard' }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AdminAnalyticsController.prototype, "getHostLeaderboard", null);
__decorate([
    (0, common_1.Get)('comparison'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({
        summary: 'KPI comparison — current period vs previous period',
        description: 'Automatically calculates the previous period of equal length. ' +
            'Returns current, previous, and a per-metric diff object with trend direction.',
    }),
    (0, swagger_1.ApiQuery)({ name: 'startDate', required: false, type: String }),
    (0, swagger_1.ApiQuery)({ name: 'endDate', required: false, type: String }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'KPI comparison object' }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [admin_analytics_dto_1.AdminDateRangeDto]),
    __metadata("design:returntype", Promise)
], AdminAnalyticsController.prototype, "getComparison", null);
exports.AdminAnalyticsController = AdminAnalyticsController = __decorate([
    (0, swagger_1.ApiTags)('Admin Analytics'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('analytics/admin'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_guard_1.Roles)(user_schema_1.UserRole.ADMIN),
    __metadata("design:paramtypes", [admin_analytics_service_1.AdminAnalyticsService])
], AdminAnalyticsController);
//# sourceMappingURL=admin-analytics.controller.js.map