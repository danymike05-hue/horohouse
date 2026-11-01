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
exports.HistoryController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const history_service_1 = require("./history.service");
const user_schema_1 = require("../users/schemas/user.schema");
const roles_guard_1 = require("../auth/guards/roles.guard");
const roles_guard_2 = require("../auth/guards/roles.guard");
const jwt_auth_guard_1 = require("../auth/guards/jwt.auth.guard");
let HistoryController = class HistoryController {
    historyService;
    constructor(historyService) {
        this.historyService = historyService;
    }
    async logActivity(activityData, req) {
        if (!activityData.userId && req.user) {
            activityData.userId = req.user.id;
        }
        return this.historyService.logActivity(activityData);
    }
    async getPopularCities(limit, timeframe) {
        return this.historyService.getPopularCities(limit ? parseInt(limit.toString()) : 10, timeframe ? parseInt(timeframe.toString()) : 30);
    }
    async getMostViewedProperties(limit, timeframe) {
        return this.historyService.getMostViewedProperties(limit ? parseInt(limit.toString()) : 10, timeframe ? parseInt(timeframe.toString()) : 30);
    }
    async getSearchTrends(timeframe, limit) {
        return this.historyService.getSearchTrends(timeframe ? parseInt(timeframe.toString()) : 7, limit ? parseInt(limit.toString()) : 20);
    }
    async getUserActivity(userId, timeframe) {
        return this.historyService.getUserActivity(userId, timeframe ? parseInt(timeframe.toString()) : 30);
    }
    async getMyActivity(req, timeframe) {
        if (!req.user || !req.user.id) {
            throw new common_1.UnauthorizedException('User not authenticated');
        }
        return this.historyService.getUserActivity(req.user.id, timeframe ? parseInt(timeframe.toString()) : 30);
    }
    async getPropertyAnalytics(propertyId, timeframe) {
        return this.historyService.getPropertyAnalytics(propertyId, timeframe ? parseInt(timeframe.toString()) : 30);
    }
    async getAgentAnalytics(agentId, timeframe) {
        return this.historyService.getAgentAnalytics(agentId, timeframe ? parseInt(timeframe.toString()) : 30);
    }
    async getDashboardStats(timeframe) {
        return this.historyService.getDashboardStats(timeframe ? parseInt(timeframe.toString()) : 30);
    }
    async getAllHistory(query) {
        return this.historyService.getAllHistory(query);
    }
};
exports.HistoryController = HistoryController;
__decorate([
    (0, common_1.Post)('activity'),
    (0, swagger_1.ApiOperation)({ summary: 'Log user activity' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [history_service_1.LogActivityDto, Object]),
    __metadata("design:returntype", Promise)
], HistoryController.prototype, "logActivity", null);
__decorate([
    (0, common_1.Get)('popular-cities'),
    (0, roles_guard_2.Public)(),
    (0, swagger_1.ApiOperation)({ summary: 'Get popular cities based on user activity' }),
    (0, swagger_1.ApiQuery)({ name: 'limit', required: false, type: Number, description: 'Number of cities to return' }),
    (0, swagger_1.ApiQuery)({ name: 'timeframe', required: false, type: Number, description: 'Timeframe in days' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Popular cities retrieved successfully' }),
    __param(0, (0, common_1.Query)('limit')),
    __param(1, (0, common_1.Query)('timeframe')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Number]),
    __metadata("design:returntype", Promise)
], HistoryController.prototype, "getPopularCities", null);
__decorate([
    (0, common_1.Get)('most-viewed-properties'),
    (0, roles_guard_2.Public)(),
    (0, swagger_1.ApiOperation)({ summary: 'Get most viewed properties' }),
    (0, swagger_1.ApiQuery)({ name: 'limit', required: false, type: Number }),
    (0, swagger_1.ApiQuery)({ name: 'timeframe', required: false, type: Number }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Most viewed properties retrieved successfully' }),
    __param(0, (0, common_1.Query)('limit')),
    __param(1, (0, common_1.Query)('timeframe')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Number]),
    __metadata("design:returntype", Promise)
], HistoryController.prototype, "getMostViewedProperties", null);
__decorate([
    (0, common_1.Get)('search-trends'),
    (0, roles_guard_1.Roles)(user_schema_1.UserRole.ADMIN, user_schema_1.UserRole.AGENT),
    (0, swagger_1.ApiOperation)({ summary: 'Get search trends and popular queries' }),
    (0, swagger_1.ApiQuery)({ name: 'timeframe', required: false, type: Number }),
    (0, swagger_1.ApiQuery)({ name: 'limit', required: false, type: Number }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Search trends retrieved successfully' }),
    __param(0, (0, common_1.Query)('timeframe')),
    __param(1, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Number]),
    __metadata("design:returntype", Promise)
], HistoryController.prototype, "getSearchTrends", null);
__decorate([
    (0, common_1.Get)('user/:userId/activity'),
    (0, roles_guard_1.Roles)(user_schema_1.UserRole.ADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Get user activity summary (Admin only)' }),
    (0, swagger_1.ApiQuery)({ name: 'timeframe', required: false, type: Number }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'User activity retrieved successfully' }),
    __param(0, (0, common_1.Param)('userId')),
    __param(1, (0, common_1.Query)('timeframe')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Number]),
    __metadata("design:returntype", Promise)
], HistoryController.prototype, "getUserActivity", null);
__decorate([
    (0, common_1.Get)('me/activity'),
    (0, swagger_1.ApiOperation)({ summary: 'Get current user activity summary' }),
    (0, swagger_1.ApiQuery)({ name: 'timeframe', required: false, type: Number }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'User activity retrieved successfully' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('timeframe')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number]),
    __metadata("design:returntype", Promise)
], HistoryController.prototype, "getMyActivity", null);
__decorate([
    (0, common_1.Get)('property/:propertyId/analytics'),
    (0, roles_guard_1.Roles)(user_schema_1.UserRole.ADMIN, user_schema_1.UserRole.AGENT),
    (0, swagger_1.ApiOperation)({ summary: 'Get property analytics' }),
    (0, swagger_1.ApiQuery)({ name: 'timeframe', required: false, type: Number }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Property analytics retrieved successfully' }),
    __param(0, (0, common_1.Param)('propertyId')),
    __param(1, (0, common_1.Query)('timeframe')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Number]),
    __metadata("design:returntype", Promise)
], HistoryController.prototype, "getPropertyAnalytics", null);
__decorate([
    (0, common_1.Get)('agent/:agentId/analytics'),
    (0, roles_guard_1.Roles)(user_schema_1.UserRole.ADMIN, user_schema_1.UserRole.AGENT),
    (0, swagger_1.ApiOperation)({ summary: 'Get agent performance analytics' }),
    (0, swagger_1.ApiQuery)({ name: 'timeframe', required: false, type: Number }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Agent analytics retrieved successfully' }),
    __param(0, (0, common_1.Param)('agentId')),
    __param(1, (0, common_1.Query)('timeframe')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Number]),
    __metadata("design:returntype", Promise)
], HistoryController.prototype, "getAgentAnalytics", null);
__decorate([
    (0, common_1.Get)('dashboard'),
    (0, roles_guard_1.Roles)(user_schema_1.UserRole.ADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Get dashboard statistics (Admin only)' }),
    (0, swagger_1.ApiQuery)({ name: 'timeframe', required: false, type: Number }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Dashboard statistics retrieved successfully' }),
    __param(0, (0, common_1.Query)('timeframe')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], HistoryController.prototype, "getDashboardStats", null);
__decorate([
    (0, common_1.Get)('all-activities'),
    (0, roles_guard_1.Roles)(user_schema_1.UserRole.ADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Get all history records with filtering and pagination (Admin only)' }),
    (0, swagger_1.ApiQuery)({ name: 'page', required: false, type: Number }),
    (0, swagger_1.ApiQuery)({ name: 'limit', required: false, type: Number }),
    (0, swagger_1.ApiQuery)({ name: 'activityType', required: false, type: String }),
    (0, swagger_1.ApiQuery)({ name: 'userId', required: false, type: String }),
    (0, swagger_1.ApiQuery)({ name: 'city', required: false, type: String }),
    (0, swagger_1.ApiQuery)({ name: 'ipAddress', required: false, type: String }),
    (0, swagger_1.ApiQuery)({ name: 'startDate', required: false, type: String }),
    (0, swagger_1.ApiQuery)({ name: 'endDate', required: false, type: String }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'History records retrieved successfully' }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], HistoryController.prototype, "getAllHistory", null);
exports.HistoryController = HistoryController = __decorate([
    (0, swagger_1.ApiTags)('History'),
    (0, swagger_1.ApiBearerAuth)('JWT-auth'),
    (0, common_1.Controller)('history'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [history_service_1.HistoryService])
], HistoryController);
//# sourceMappingURL=history.controller.js.map