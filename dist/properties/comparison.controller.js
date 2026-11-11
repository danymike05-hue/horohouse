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
exports.ComparisonController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const comparison_service_1 = require("./comparison.service");
const jwt_auth_guard_1 = require("../auth/guards/jwt.auth.guard");
const roles_guard_1 = require("../auth/guards/roles.guard");
const user_schema_1 = require("../users/schemas/user.schema");
let ComparisonController = class ComparisonController {
    comparisonService;
    constructor(comparisonService) {
        this.comparisonService = comparisonService;
    }
    async create(createComparisonDto, req) {
        return this.comparisonService.create(createComparisonDto, req.user);
    }
    async findAll(req) {
        return this.comparisonService.findAll(req.user);
    }
    async getPublicComparisons(limit) {
        const limitNum = limit ? parseInt(limit) : 10;
        return this.comparisonService.getPublicComparisons(limitNum);
    }
    async findByShareToken(shareToken) {
        return this.comparisonService.findByShareToken(shareToken);
    }
    async findOne(id, req) {
        return this.comparisonService.findOne(id, req.user);
    }
    async generateShareUrl(id, req) {
        return this.comparisonService.generateShareUrl(id, req.user);
    }
    async update(id, updateComparisonDto, req) {
        return this.comparisonService.update(id, updateComparisonDto, req.user);
    }
    async remove(id, req) {
        await this.comparisonService.remove(id, req.user);
        return { message: 'Comparison deleted successfully' };
    }
};
exports.ComparisonController = ComparisonController;
__decorate([
    (0, common_1.Post)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_guard_1.Roles)(user_schema_1.UserRole.REGISTERED_USER, user_schema_1.UserRole.AGENT, user_schema_1.UserRole.ADMIN),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({ summary: 'Create a new property comparison' }),
    (0, swagger_1.ApiResponse)({ status: 201, description: 'Comparison created successfully' }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Bad request - invalid property IDs or count' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ComparisonController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_guard_1.Roles)(user_schema_1.UserRole.REGISTERED_USER, user_schema_1.UserRole.AGENT, user_schema_1.UserRole.ADMIN),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({ summary: 'Get all comparisons for the authenticated user' }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ComparisonController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)('public'),
    (0, roles_guard_1.Public)(),
    (0, swagger_1.ApiOperation)({ summary: 'Get public property comparisons' }),
    (0, swagger_1.ApiQuery)({ name: 'limit', required: false, type: Number }),
    __param(0, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ComparisonController.prototype, "getPublicComparisons", null);
__decorate([
    (0, common_1.Get)('share/:shareToken'),
    (0, roles_guard_1.Public)(),
    (0, swagger_1.ApiOperation)({ summary: 'Get a comparison by share token' }),
    (0, swagger_1.ApiParam)({ name: 'shareToken', type: String }),
    __param(0, (0, common_1.Param)('shareToken')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ComparisonController.prototype, "findByShareToken", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({ summary: 'Get a specific comparison by ID' }),
    (0, swagger_1.ApiParam)({ name: 'id', type: String }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ComparisonController.prototype, "findOne", null);
__decorate([
    (0, common_1.Post)(':id/share'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_guard_1.Roles)(user_schema_1.UserRole.REGISTERED_USER, user_schema_1.UserRole.AGENT, user_schema_1.UserRole.ADMIN),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({ summary: 'Generate share URL for a comparison' }),
    (0, swagger_1.ApiParam)({ name: 'id', type: String }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ComparisonController.prototype, "generateShareUrl", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_guard_1.Roles)(user_schema_1.UserRole.REGISTERED_USER, user_schema_1.UserRole.AGENT, user_schema_1.UserRole.ADMIN),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({ summary: 'Update a comparison' }),
    (0, swagger_1.ApiParam)({ name: 'id', type: String }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], ComparisonController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_guard_1.Roles)(user_schema_1.UserRole.REGISTERED_USER, user_schema_1.UserRole.AGENT, user_schema_1.UserRole.ADMIN),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({ summary: 'Delete a comparison' }),
    (0, swagger_1.ApiParam)({ name: 'id', type: String }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ComparisonController.prototype, "remove", null);
exports.ComparisonController = ComparisonController = __decorate([
    (0, swagger_1.ApiTags)('comparisons'),
    (0, common_1.Controller)('comparisons'),
    __metadata("design:paramtypes", [comparison_service_1.ComparisonService])
], ComparisonController);
//# sourceMappingURL=comparison.controller.js.map