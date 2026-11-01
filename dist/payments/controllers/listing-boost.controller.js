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
exports.ListingBoostController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const listing_boost_service_1 = require("../services/listing-boost.service");
const jwt_auth_guard_1 = require("../../auth/guards/jwt.auth.guard");
const roles_guard_1 = require("../../auth/guards/roles.guard");
const user_schema_1 = require("../../users/schemas/user.schema");
const payment_dto_1 = require("../dto/payment.dto");
const listing_boost_schema_1 = require("../schemas/listing-boost.schema");
class PricingQuery {
    boostType;
    duration;
}
class CancelDto {
    reason;
}
let ListingBoostController = class ListingBoostController {
    listingBoostService;
    constructor(listingBoostService) {
        this.listingBoostService = listingBoostService;
    }
    getOptions() {
        return this.listingBoostService.getBoostOptions();
    }
    getPricing(q) {
        if (!q.boostType || !q.duration) {
            throw new common_1.BadRequestException('boostType and duration are required');
        }
        return { price: this.listingBoostService.getBoostPricing(q.boostType, q.duration) };
    }
    async createBoost(dto, req) {
        return this.listingBoostService.createBoostRequest(req.user.id, dto);
    }
    async activateBoost(transactionId) {
        return this.listingBoostService.activateBoost(transactionId);
    }
    async getUserBoosts(req, status) {
        return this.listingBoostService.getUserBoosts(req.user.id, status);
    }
    async getPropertyBoosts(propertyId) {
        return this.listingBoostService.getPropertyBoosts(propertyId);
    }
    async getActiveBoostedProperties(boostType, limit) {
        const l = limit ? parseInt(limit, 10) : 10;
        return this.listingBoostService.getActiveBoostedProperties(boostType, l);
    }
    async trackImpression(boostId) {
        await this.listingBoostService.trackImpression(boostId);
        return { status: 'ok' };
    }
    async trackClick(boostId) {
        await this.listingBoostService.trackClick(boostId);
        return { status: 'ok' };
    }
    async trackInquiry(boostId) {
        await this.listingBoostService.trackInquiry(boostId);
        return { status: 'ok' };
    }
    async cancelBoost(boostId, req, dto) {
        if (!dto || !dto.reason) {
            throw new common_1.BadRequestException('reason is required');
        }
        return this.listingBoostService.cancelBoost(boostId, req.user.id, dto.reason);
    }
};
exports.ListingBoostController = ListingBoostController;
__decorate([
    (0, common_1.Get)('options'),
    (0, swagger_1.ApiOperation)({ summary: 'Get available boost options and pricing' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Boost options returned' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ListingBoostController.prototype, "getOptions", null);
__decorate([
    (0, common_1.Get)('pricing'),
    (0, swagger_1.ApiOperation)({ summary: 'Get price for a boost type and duration' }),
    (0, swagger_1.ApiQuery)({ name: 'boostType', required: true }),
    (0, swagger_1.ApiQuery)({ name: 'duration', required: true, type: Number }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Price calculated' }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [PricingQuery]),
    __metadata("design:returntype", void 0)
], ListingBoostController.prototype, "getPricing", null);
__decorate([
    (0, common_1.Post)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiBearerAuth)('JWT-auth'),
    (0, swagger_1.ApiOperation)({ summary: 'Create a boost request for a property' }),
    (0, swagger_1.ApiResponse)({ status: 201, description: 'Boost request created' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [payment_dto_1.CreateListingBoostDto, Object]),
    __metadata("design:returntype", Promise)
], ListingBoostController.prototype, "createBoost", null);
__decorate([
    (0, common_1.Post)('activate/:transactionId'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, roles_guard_1.Roles)(user_schema_1.UserRole.ADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Activate boost after payment (admin)' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Boost activated' }),
    __param(0, (0, common_1.Param)('transactionId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ListingBoostController.prototype, "activateBoost", null);
__decorate([
    (0, common_1.Get)('user'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiOperation)({ summary: "Get current user's boosts" }),
    (0, swagger_1.ApiQuery)({ name: 'status', required: false }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'User boosts returned' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('status')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ListingBoostController.prototype, "getUserBoosts", null);
__decorate([
    (0, common_1.Get)('property/:propertyId'),
    (0, swagger_1.ApiOperation)({ summary: 'Get boost history for a property' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Property boosts returned' }),
    __param(0, (0, common_1.Param)('propertyId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ListingBoostController.prototype, "getPropertyBoosts", null);
__decorate([
    (0, common_1.Get)('active'),
    (0, swagger_1.ApiOperation)({ summary: 'Get active boosted properties' }),
    (0, swagger_1.ApiQuery)({ name: 'boostType', required: false }),
    (0, swagger_1.ApiQuery)({ name: 'limit', required: false, type: Number }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Active boosted properties returned' }),
    __param(0, (0, common_1.Query)('boostType')),
    __param(1, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], ListingBoostController.prototype, "getActiveBoostedProperties", null);
__decorate([
    (0, common_1.Post)('track/:boostId/impression'),
    (0, swagger_1.ApiOperation)({ summary: 'Track a boost impression' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Tracked' }),
    __param(0, (0, common_1.Param)('boostId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ListingBoostController.prototype, "trackImpression", null);
__decorate([
    (0, common_1.Post)('track/:boostId/click'),
    (0, swagger_1.ApiOperation)({ summary: 'Track a boost click' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Tracked' }),
    __param(0, (0, common_1.Param)('boostId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ListingBoostController.prototype, "trackClick", null);
__decorate([
    (0, common_1.Post)('track/:boostId/inquiry'),
    (0, swagger_1.ApiOperation)({ summary: 'Track a boost inquiry' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Tracked' }),
    __param(0, (0, common_1.Param)('boostId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ListingBoostController.prototype, "trackInquiry", null);
__decorate([
    (0, common_1.Post)(':boostId/cancel'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiOperation)({ summary: 'Cancel a boost' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Boost cancelled' }),
    __param(0, (0, common_1.Param)('boostId')),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, CancelDto]),
    __metadata("design:returntype", Promise)
], ListingBoostController.prototype, "cancelBoost", null);
exports.ListingBoostController = ListingBoostController = __decorate([
    (0, swagger_1.ApiTags)('Listing Boosts'),
    (0, common_1.Controller)('boosts'),
    __metadata("design:paramtypes", [listing_boost_service_1.ListingBoostService])
], ListingBoostController);
//# sourceMappingURL=listing-boost.controller.js.map