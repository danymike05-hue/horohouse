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
var UserInteractionsController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserInteractionsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const jwt_auth_guard_1 = require("../auth/guards/jwt.auth.guard");
const user_interactions_service_1 = require("./user-interactions.service");
const user_interaction_schema_1 = require("./schemas/user-interaction.schema");
let UserInteractionsController = UserInteractionsController_1 = class UserInteractionsController {
    userInteractionsService;
    logger = new common_1.Logger(UserInteractionsController_1.name);
    constructor(userInteractionsService) {
        this.userInteractionsService = userInteractionsService;
    }
    async trackInteraction(createInteractionDto, req) {
        try {
            if (createInteractionDto.userId.toString() !== req.user._id.toString()) {
                throw new common_1.BadRequestException('You can only track interactions for yourself');
            }
            const interaction = await this.userInteractionsService.trackInteraction(createInteractionDto);
            return {
                success: true,
                message: 'Interaction tracked successfully',
                data: interaction,
            };
        }
        catch (error) {
            this.logger.error('Error tracking interaction:', error);
            throw error;
        }
    }
    async trackBulkInteractions(body, req) {
        try {
            const userId = req.user._id.toString();
            for (const interaction of body.interactions) {
                if (interaction.userId.toString() !== userId) {
                    throw new common_1.BadRequestException('You can only track interactions for yourself');
                }
            }
            const interactions = await this.userInteractionsService.trackBulkInteractions(body.interactions);
            return {
                success: true,
                message: `${interactions.length} interactions tracked successfully`,
                data: interactions,
            };
        }
        catch (error) {
            this.logger.error('Error tracking bulk interactions:', error);
            throw error;
        }
    }
    async getUserInteractions(query, req) {
        try {
            if (query.userId && query.userId.toString() !== req.user._id.toString()) {
                throw new common_1.BadRequestException('You can only view your own interactions');
            }
            const interactions = await this.userInteractionsService.getUserInteractions({
                ...query,
                userId: query.userId || req.user._id,
            });
            return {
                success: true,
                data: interactions,
                count: interactions.length,
            };
        }
        catch (error) {
            this.logger.error('Error getting user interactions:', error);
            throw error;
        }
    }
    async getRecommendationProfile(req) {
        try {
            const profile = await this.userInteractionsService.getUserRecommendationProfile(req.user._id);
            return {
                success: true,
                data: profile,
            };
        }
        catch (error) {
            this.logger.error('Error getting recommendation profile:', error);
            throw error;
        }
    }
    async getSimilarUsers(limit, req) {
        try {
            const similarUsers = await this.userInteractionsService.getSimilarUsers(req.user._id, limit ? parseInt(limit) : 10);
            return {
                success: true,
                data: similarUsers,
                count: similarUsers.length,
            };
        }
        catch (error) {
            this.logger.error('Error getting similar users:', error);
            throw error;
        }
    }
    async getRecommendedProperties(limit, excludePropertyIds, req) {
        try {
            const excludeIds = excludePropertyIds ? excludePropertyIds.split(',') : undefined;
            const recommendations = await this.userInteractionsService.getRecommendedProperties(req.user._id, limit ? parseInt(limit) : 20, excludeIds);
            return {
                success: true,
                data: recommendations,
                count: recommendations.length,
            };
        }
        catch (error) {
            this.logger.error('Error getting recommended properties:', error);
            throw error;
        }
    }
    async trackPropertyView(body, req) {
        try {
            const interaction = await this.userInteractionsService.trackInteraction({
                userId: req.user._id,
                interactionType: user_interaction_schema_1.InteractionType.PROPERTY_VIEW,
                propertyId: body.propertyId,
                source: body.source,
                metadata: body.metadata,
                ...body.propertyDetails,
            });
            return {
                success: true,
                message: 'Property view tracked successfully',
                data: interaction,
            };
        }
        catch (error) {
            this.logger.error('Error tracking property view:', error);
            throw error;
        }
    }
    async trackPropertyFavorite(body, req) {
        try {
            const interaction = await this.userInteractionsService.trackInteraction({
                userId: req.user._id,
                interactionType: user_interaction_schema_1.InteractionType.PROPERTY_FAVORITE,
                propertyId: body.propertyId,
                source: body.source,
                metadata: body.metadata,
                ...body.propertyDetails,
            });
            return {
                success: true,
                message: 'Property favorite tracked successfully',
                data: interaction,
            };
        }
        catch (error) {
            this.logger.error('Error tracking property favorite:', error);
            throw error;
        }
    }
    async trackPropertyInquiry(body, req) {
        try {
            const interaction = await this.userInteractionsService.trackInteraction({
                userId: req.user._id,
                interactionType: user_interaction_schema_1.InteractionType.PROPERTY_INQUIRY,
                propertyId: body.propertyId,
                agentId: body.agentId,
                source: body.source,
                metadata: body.metadata,
                ...body.propertyDetails,
            });
            return {
                success: true,
                message: 'Property inquiry tracked successfully',
                data: interaction,
            };
        }
        catch (error) {
            this.logger.error('Error tracking property inquiry:', error);
            throw error;
        }
    }
    async trackSearch(body, req) {
        try {
            const interaction = await this.userInteractionsService.trackInteraction({
                userId: req.user._id,
                interactionType: user_interaction_schema_1.InteractionType.SEARCH,
                source: body.source,
                metadata: {
                    ...body.metadata,
                    searchQuery: body.searchQuery,
                    searchFilters: body.searchFilters,
                    resultsCount: body.resultsCount,
                },
                location: body.userLocation,
                city: body.city,
            });
            return {
                success: true,
                message: 'Search tracked successfully',
                data: interaction,
            };
        }
        catch (error) {
            this.logger.error('Error tracking search:', error);
            throw error;
        }
    }
    async trackRecommendationClick(body, req) {
        try {
            const interaction = await this.userInteractionsService.trackInteraction({
                userId: req.user._id,
                interactionType: user_interaction_schema_1.InteractionType.RECOMMENDATION_CLICK,
                propertyId: body.propertyId,
                source: user_interaction_schema_1.InteractionSource.RECOMMENDATIONS,
                metadata: {
                    ...body.metadata,
                    recommendationScore: body.recommendationScore,
                    recommendationReason: body.recommendationReason,
                },
                ...body.propertyDetails,
            });
            return {
                success: true,
                message: 'Recommendation click tracked successfully',
                data: interaction,
            };
        }
        catch (error) {
            this.logger.error('Error tracking recommendation click:', error);
            throw error;
        }
    }
    async getAnalyticsSummary(req) {
        try {
            const userId = req.user._id;
            const [totalInteractions, propertyViews, favorites, inquiries, searches,] = await Promise.all([
                this.userInteractionsService.getUserInteractions({ userId, limit: 1 }),
                this.userInteractionsService.getUserInteractions({
                    userId,
                    interactionTypes: [user_interaction_schema_1.InteractionType.PROPERTY_VIEW],
                    limit: 1
                }),
                this.userInteractionsService.getUserInteractions({
                    userId,
                    interactionTypes: [user_interaction_schema_1.InteractionType.PROPERTY_FAVORITE],
                    limit: 1
                }),
                this.userInteractionsService.getUserInteractions({
                    userId,
                    interactionTypes: [user_interaction_schema_1.InteractionType.PROPERTY_INQUIRY],
                    limit: 1
                }),
                this.userInteractionsService.getUserInteractions({
                    userId,
                    interactionTypes: [user_interaction_schema_1.InteractionType.SEARCH],
                    limit: 1
                }),
            ]);
            const profile = await this.userInteractionsService.getUserRecommendationProfile(userId);
            return {
                success: true,
                data: {
                    totalInteractions: totalInteractions.length,
                    propertyViews: propertyViews.length,
                    favorites: favorites.length,
                    inquiries: inquiries.length,
                    searches: searches.length,
                    topCities: profile.preferredCities.slice(0, 5),
                    topPropertyTypes: profile.preferredPropertyTypes.slice(0, 5),
                    priceRange: profile.priceRange,
                    interactionPatterns: profile.interactionPatterns,
                },
            };
        }
        catch (error) {
            this.logger.error('Error getting analytics summary:', error);
            throw error;
        }
    }
};
exports.UserInteractionsController = UserInteractionsController;
__decorate([
    (0, common_1.Post)(),
    (0, swagger_1.ApiOperation)({ summary: 'Track a user interaction' }),
    (0, swagger_1.ApiResponse)({ status: 201, description: 'Interaction tracked successfully.' }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Bad request.' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], UserInteractionsController.prototype, "trackInteraction", null);
__decorate([
    (0, common_1.Post)('bulk'),
    (0, swagger_1.ApiOperation)({ summary: 'Track multiple user interactions in bulk' }),
    (0, swagger_1.ApiResponse)({ status: 201, description: 'Interactions tracked successfully.' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], UserInteractionsController.prototype, "trackBulkInteractions", null);
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: 'Get user interactions with filtering' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Interactions retrieved successfully.' }),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], UserInteractionsController.prototype, "getUserInteractions", null);
__decorate([
    (0, common_1.Get)('profile'),
    (0, swagger_1.ApiOperation)({ summary: 'Get user recommendation profile' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Recommendation profile retrieved successfully.' }),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], UserInteractionsController.prototype, "getRecommendationProfile", null);
__decorate([
    (0, common_1.Get)('similar-users'),
    (0, swagger_1.ApiOperation)({ summary: 'Get similar users based on interaction patterns' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Similar users retrieved successfully.' }),
    __param(0, (0, common_1.Query)('limit')),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], UserInteractionsController.prototype, "getSimilarUsers", null);
__decorate([
    (0, common_1.Get)('recommendations'),
    (0, swagger_1.ApiOperation)({ summary: 'Get recommended properties based on user interactions' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Recommended properties retrieved successfully.' }),
    __param(0, (0, common_1.Query)('limit')),
    __param(1, (0, common_1.Query)('excludePropertyIds')),
    __param(2, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", Promise)
], UserInteractionsController.prototype, "getRecommendedProperties", null);
__decorate([
    (0, common_1.Post)('track-property-view'),
    (0, swagger_1.ApiOperation)({ summary: 'Track property view interaction' }),
    (0, swagger_1.ApiResponse)({ status: 201, description: 'Property view tracked successfully.' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], UserInteractionsController.prototype, "trackPropertyView", null);
__decorate([
    (0, common_1.Post)('track-property-favorite'),
    (0, swagger_1.ApiOperation)({ summary: 'Track property favorite interaction' }),
    (0, swagger_1.ApiResponse)({ status: 201, description: 'Property favorite tracked successfully.' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], UserInteractionsController.prototype, "trackPropertyFavorite", null);
__decorate([
    (0, common_1.Post)('track-property-inquiry'),
    (0, swagger_1.ApiOperation)({ summary: 'Track property inquiry interaction' }),
    (0, swagger_1.ApiResponse)({ status: 201, description: 'Property inquiry tracked successfully.' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], UserInteractionsController.prototype, "trackPropertyInquiry", null);
__decorate([
    (0, common_1.Post)('track-search'),
    (0, swagger_1.ApiOperation)({ summary: 'Track search interaction' }),
    (0, swagger_1.ApiResponse)({ status: 201, description: 'Search tracked successfully.' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], UserInteractionsController.prototype, "trackSearch", null);
__decorate([
    (0, common_1.Post)('track-recommendation-click'),
    (0, swagger_1.ApiOperation)({ summary: 'Track recommendation click interaction' }),
    (0, swagger_1.ApiResponse)({ status: 201, description: 'Recommendation click tracked successfully.' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], UserInteractionsController.prototype, "trackRecommendationClick", null);
__decorate([
    (0, common_1.Get)('analytics/summary'),
    (0, swagger_1.ApiOperation)({ summary: 'Get user interaction analytics summary' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Analytics summary retrieved successfully.' }),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], UserInteractionsController.prototype, "getAnalyticsSummary", null);
exports.UserInteractionsController = UserInteractionsController = UserInteractionsController_1 = __decorate([
    (0, swagger_1.ApiTags)('user-interactions'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('user-interactions'),
    __metadata("design:paramtypes", [user_interactions_service_1.UserInteractionsService])
], UserInteractionsController);
//# sourceMappingURL=user-interactions.controller.js.map