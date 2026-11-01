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
exports.ReviewsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const reviews_service_1 = require("./reviews.service");
const dto_1 = require("./dto");
const jwt_auth_guard_1 = require("../auth/guards/jwt.auth.guard");
const roles_guard_1 = require("../auth/guards/roles.guard");
const user_schema_1 = require("../users/schemas/user.schema");
const review_schema_1 = require("./schemas/review.schema");
let ReviewsController = class ReviewsController {
    reviewsService;
    constructor(reviewsService) {
        this.reviewsService = reviewsService;
    }
    async create(dto, req) {
        return this.reviewsService.create(dto, req.user);
    }
    async findAll(query) {
        const filters = {
            reviewType: query.reviewType,
            propertyId: query.propertyId,
            agentId: query.agentId,
            bookingId: query.bookingId,
            reviewedUserId: query.reviewedUserId,
            minRating: query.minRating ? parseFloat(query.minRating) : undefined,
            maxRating: query.maxRating ? parseFloat(query.maxRating) : undefined,
            verified: query.verified === 'true' ? true : query.verified === 'false' ? false : undefined,
        };
        const options = {
            page: query.page ? parseInt(query.page) : 1,
            limit: query.limit ? parseInt(query.limit) : 20,
            sortBy: query.sortBy || 'createdAt',
            sortOrder: query.sortOrder || 'desc',
        };
        return this.reviewsService.findAll(filters, options);
    }
    async getPropertyReviews(propertyId, query) {
        return this.reviewsService.getPropertyReviews(propertyId, {
            page: query.page ? parseInt(query.page) : 1,
            limit: query.limit ? parseInt(query.limit) : 20,
            sortBy: query.sortBy || 'createdAt',
            sortOrder: query.sortOrder || 'desc',
        });
    }
    async getPropertyReviewStats(propertyId) {
        return this.reviewsService.getPropertyReviewStats(propertyId);
    }
    async getInsightReviews(insightId, query) {
        return this.reviewsService.getInsightReviews(insightId, {
            page: query.page ? parseInt(query.page) : 1,
            limit: query.limit ? parseInt(query.limit) : 20,
            sortBy: query.sortBy || 'createdAt',
            sortOrder: query.sortOrder || 'desc',
        });
    }
    async getAgentReviews(agentId, query) {
        return this.reviewsService.getAgentReviews(agentId, {
            page: query.page ? parseInt(query.page) : 1,
            limit: query.limit ? parseInt(query.limit) : 20,
            sortBy: query.sortBy || 'createdAt',
            sortOrder: query.sortOrder || 'desc',
        });
    }
    async getAgentReviewStats(agentId) {
        return this.reviewsService.getAgentReviewStats(agentId);
    }
    async getBookingReviews(bookingId) {
        return this.reviewsService.getBookingReviews(bookingId);
    }
    async getGuestReviews(userId, query) {
        return this.reviewsService.getGuestReviews(userId, {
            page: query.page ? parseInt(query.page) : 1,
            limit: query.limit ? parseInt(query.limit) : 20,
            sortOrder: query.sortOrder || 'desc',
        });
    }
    async getMyReviews(req, query) {
        return this.reviewsService.getUserReviews(req.user.id, {
            page: query.page ? parseInt(query.page) : 1,
            limit: query.limit ? parseInt(query.limit) : 20,
            sortBy: query.sortBy || 'createdAt',
            sortOrder: query.sortOrder || 'desc',
        });
    }
    async findOne(id) {
        return this.reviewsService.findOne(id);
    }
    async update(id, dto, req) {
        return this.reviewsService.update(id, dto, req.user);
    }
    async respondToReview(id, dto, req) {
        return this.reviewsService.respondToReview(id, dto, req.user);
    }
    async markAsHelpful(id, req) {
        return this.reviewsService.markAsHelpful(id, req.user);
    }
    async remove(id, req) {
        await this.reviewsService.remove(id, req.user);
        return { message: 'Review deleted successfully' };
    }
};
exports.ReviewsController = ReviewsController;
__decorate([
    (0, common_1.Post)(),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({
        summary: 'Create a review',
        description: 'reviewType = property | agent — standard reviews (unchanged).\n' +
            'reviewType = stay — guest reviews the property after a completed booking.\n' +
            'reviewType = guest — host reviews the guest after a completed booking.\n' +
            'Stay and guest reviews require bookingId and are gated behind a completed booking check.',
    }),
    (0, swagger_1.ApiResponse)({ status: 201, description: 'Review created' }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Validation error or review window closed' }),
    (0, swagger_1.ApiResponse)({ status: 403, description: 'Not the guest or host of this booking' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Booking / property / agent not found' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.CreateReviewDto, Object]),
    __metadata("design:returntype", Promise)
], ReviewsController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    (0, roles_guard_1.Public)(),
    (0, swagger_1.ApiOperation)({ summary: 'Get all reviews with filters' }),
    (0, swagger_1.ApiQuery)({ name: 'page', required: false, type: Number }),
    (0, swagger_1.ApiQuery)({ name: 'limit', required: false, type: Number }),
    (0, swagger_1.ApiQuery)({ name: 'reviewType', required: false, enum: review_schema_1.ReviewType }),
    (0, swagger_1.ApiQuery)({ name: 'propertyId', required: false, type: String }),
    (0, swagger_1.ApiQuery)({ name: 'agentId', required: false, type: String }),
    (0, swagger_1.ApiQuery)({ name: 'bookingId', required: false, type: String }),
    (0, swagger_1.ApiQuery)({ name: 'reviewedUserId', required: false, type: String }),
    (0, swagger_1.ApiQuery)({ name: 'minRating', required: false, type: Number }),
    (0, swagger_1.ApiQuery)({ name: 'maxRating', required: false, type: Number }),
    (0, swagger_1.ApiQuery)({ name: 'verified', required: false, type: Boolean }),
    (0, swagger_1.ApiQuery)({ name: 'sortBy', required: false, type: String }),
    (0, swagger_1.ApiQuery)({ name: 'sortOrder', required: false, enum: ['asc', 'desc'] }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Reviews retrieved' }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ReviewsController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)('property/:propertyId'),
    (0, roles_guard_1.Public)(),
    (0, swagger_1.ApiOperation)({ summary: 'Get reviews for a property (includes stay reviews)' }),
    (0, swagger_1.ApiParam)({ name: 'propertyId' }),
    (0, swagger_1.ApiQuery)({ name: 'page', required: false, type: Number }),
    (0, swagger_1.ApiQuery)({ name: 'limit', required: false, type: Number }),
    (0, swagger_1.ApiQuery)({ name: 'sortBy', required: false, type: String }),
    (0, swagger_1.ApiQuery)({ name: 'sortOrder', required: false, enum: ['asc', 'desc'] }),
    __param(0, (0, common_1.Param)('propertyId')),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ReviewsController.prototype, "getPropertyReviews", null);
__decorate([
    (0, common_1.Get)('property/:propertyId/stats'),
    (0, roles_guard_1.Public)(),
    (0, swagger_1.ApiOperation)({ summary: 'Get review stats for a property (includes sub-rating averages)' }),
    (0, swagger_1.ApiParam)({ name: 'propertyId' }),
    __param(0, (0, common_1.Param)('propertyId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ReviewsController.prototype, "getPropertyReviewStats", null);
__decorate([
    (0, common_1.Get)('insight/:insightId'),
    (0, roles_guard_1.Public)(),
    (0, swagger_1.ApiOperation)({ summary: 'Get comments/reviews for an insight (article)' }),
    (0, swagger_1.ApiParam)({ name: 'insightId' }),
    (0, swagger_1.ApiQuery)({ name: 'page', required: false, type: Number }),
    (0, swagger_1.ApiQuery)({ name: 'limit', required: false, type: Number }),
    (0, swagger_1.ApiQuery)({ name: 'sortBy', required: false, type: String }),
    (0, swagger_1.ApiQuery)({ name: 'sortOrder', required: false, enum: ['asc', 'desc'] }),
    __param(0, (0, common_1.Param)('insightId')),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ReviewsController.prototype, "getInsightReviews", null);
__decorate([
    (0, common_1.Get)('agent/:agentId'),
    (0, roles_guard_1.Public)(),
    (0, swagger_1.ApiOperation)({ summary: 'Get reviews for an agent' }),
    (0, swagger_1.ApiParam)({ name: 'agentId' }),
    (0, swagger_1.ApiQuery)({ name: 'page', required: false, type: Number }),
    (0, swagger_1.ApiQuery)({ name: 'limit', required: false, type: Number }),
    (0, swagger_1.ApiQuery)({ name: 'sortBy', required: false, type: String }),
    (0, swagger_1.ApiQuery)({ name: 'sortOrder', required: false, enum: ['asc', 'desc'] }),
    __param(0, (0, common_1.Param)('agentId')),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ReviewsController.prototype, "getAgentReviews", null);
__decorate([
    (0, common_1.Get)('agent/:agentId/stats'),
    (0, roles_guard_1.Public)(),
    (0, swagger_1.ApiOperation)({ summary: 'Get review stats for an agent' }),
    (0, swagger_1.ApiParam)({ name: 'agentId' }),
    __param(0, (0, common_1.Param)('agentId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ReviewsController.prototype, "getAgentReviewStats", null);
__decorate([
    (0, common_1.Get)('booking/:bookingId'),
    (0, roles_guard_1.Public)(),
    (0, swagger_1.ApiOperation)({
        summary: 'Get both sides of a booking review (stay review + guest review)',
    }),
    (0, swagger_1.ApiParam)({ name: 'bookingId', description: 'Booking ID' }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'Returns { stayReview, guestReview } — either can be null if not yet submitted',
    }),
    __param(0, (0, common_1.Param)('bookingId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ReviewsController.prototype, "getBookingReviews", null);
__decorate([
    (0, common_1.Get)('user/:userId/as-guest'),
    (0, roles_guard_1.Public)(),
    (0, swagger_1.ApiOperation)({ summary: 'Get reviews received by a user as a guest' }),
    (0, swagger_1.ApiParam)({ name: 'userId', description: 'User ID' }),
    (0, swagger_1.ApiQuery)({ name: 'page', required: false, type: Number }),
    (0, swagger_1.ApiQuery)({ name: 'limit', required: false, type: Number }),
    (0, swagger_1.ApiQuery)({ name: 'sortOrder', required: false, enum: ['asc', 'desc'] }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Guest reputation reviews' }),
    __param(0, (0, common_1.Param)('userId')),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ReviewsController.prototype, "getGuestReviews", null);
__decorate([
    (0, common_1.Get)('my-reviews'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({ summary: "Get current user's reviews" }),
    (0, swagger_1.ApiQuery)({ name: 'page', required: false, type: Number }),
    (0, swagger_1.ApiQuery)({ name: 'limit', required: false, type: Number }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ReviewsController.prototype, "getMyReviews", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, roles_guard_1.Public)(),
    (0, swagger_1.ApiOperation)({ summary: 'Get review by ID' }),
    (0, swagger_1.ApiParam)({ name: 'id' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Review not found' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ReviewsController.prototype, "findOne", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({ summary: 'Update review (own reviews only)' }),
    (0, swagger_1.ApiParam)({ name: 'id' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, dto_1.UpdateReviewDto, Object]),
    __metadata("design:returntype", Promise)
], ReviewsController.prototype, "update", null);
__decorate([
    (0, common_1.Post)(':id/respond'),
    (0, roles_guard_1.Roles)(user_schema_1.UserRole.HOST, user_schema_1.UserRole.AGENT, user_schema_1.UserRole.LANDLORD, user_schema_1.UserRole.ADMIN),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({ summary: 'Respond to a review (host, agent, or admin)' }),
    (0, swagger_1.ApiParam)({ name: 'id' }),
    (0, swagger_1.ApiResponse)({ status: 403, description: 'Can only respond to reviews about yourself / your property' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, dto_1.RespondReviewDto, Object]),
    __metadata("design:returntype", Promise)
], ReviewsController.prototype, "respondToReview", null);
__decorate([
    (0, common_1.Post)(':id/helpful'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({ summary: 'Toggle helpful flag on a review' }),
    (0, swagger_1.ApiParam)({ name: 'id' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ReviewsController.prototype, "markAsHelpful", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({ summary: 'Delete review (own or admin)' }),
    (0, swagger_1.ApiParam)({ name: 'id' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ReviewsController.prototype, "remove", null);
exports.ReviewsController = ReviewsController = __decorate([
    (0, swagger_1.ApiTags)('Reviews'),
    (0, common_1.Controller)('reviews'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    __metadata("design:paramtypes", [reviews_service_1.ReviewsService])
], ReviewsController);
//# sourceMappingURL=reviews.controller.js.map