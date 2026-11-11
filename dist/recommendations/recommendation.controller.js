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
var RecommendationController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RecommendationController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const jwt_auth_guard_1 = require("../auth/guards/jwt.auth.guard");
const recommendation_service_1 = require("./recommendation.service");
const ml_sync_service_1 = require("./ml-sync.service");
const flask_ml_service_1 = require("./flask-ml.service");
let RecommendationController = RecommendationController_1 = class RecommendationController {
    recommendationService;
    mlSyncService;
    flaskMLService;
    logger = new common_1.Logger(RecommendationController_1.name);
    constructor(recommendationService, mlSyncService, flaskMLService) {
        this.recommendationService = recommendationService;
        this.mlSyncService = mlSyncService;
        this.flaskMLService = flaskMLService;
    }
    async getRecommendations(req, algorithm, limit, excludePropertyIds, contentWeight, collaborativeWeight, popularityWeight, minScore, locationWeight, priceWeight, amenitiesWeight, boostRecentViews, boostSimilarProperties, preferredPropertyType) {
        try {
            const request = {
                userId: req.user._id.toString(),
                algorithm: algorithm || 'hybrid',
                limit: limit ? parseInt(limit) : 20,
                excludePropertyIds: excludePropertyIds ? excludePropertyIds.split(',') : undefined,
                options: {
                    contentWeight: contentWeight ? parseFloat(contentWeight) : undefined,
                    collaborativeWeight: collaborativeWeight ? parseFloat(collaborativeWeight) : undefined,
                    popularityWeight: popularityWeight ? parseFloat(popularityWeight) : undefined,
                    minScore: minScore ? parseFloat(minScore) : undefined,
                    locationWeight: locationWeight ? parseFloat(locationWeight) : undefined,
                    priceWeight: priceWeight ? parseFloat(priceWeight) : undefined,
                    amenitiesWeight: amenitiesWeight ? parseFloat(amenitiesWeight) : undefined,
                    boostRecentViews: boostRecentViews === 'true',
                    boostSimilarProperties: boostSimilarProperties === 'true',
                    preferredPropertyType,
                },
            };
            const result = await this.recommendationService.getRecommendations(request);
            return {
                success: true,
                data: result.data,
            };
        }
        catch (error) {
            this.logger.error('Error getting recommendations:', error);
            throw error;
        }
    }
    async getFlaskMLRecommendations(req, limit, excludePropertyIds, preferredPropertyType) {
        try {
            const request = {
                userId: req.user._id.toString(),
                algorithm: 'flask-ml',
                limit: limit ? parseInt(limit) : 20,
                excludePropertyIds: excludePropertyIds ? excludePropertyIds.split(',') : undefined,
                options: {
                    preferredPropertyType,
                },
            };
            const result = await this.recommendationService.getRecommendations(request);
            return {
                success: true,
                data: result.data,
            };
        }
        catch (error) {
            this.logger.error('Error getting Flask ML recommendations:', error);
            throw error;
        }
    }
    async getRecommendationStats(req) {
        try {
            const stats = await this.recommendationService.getRecommendationStats(req.user._id.toString());
            return {
                success: true,
                data: stats,
            };
        }
        catch (error) {
            this.logger.error('Error getting recommendation stats:', error);
            throw error;
        }
    }
    async submitFeedback(body, req) {
        try {
            if (body.rating < 1 || body.rating > 5) {
                throw new common_1.BadRequestException('Rating must be between 1 and 5');
            }
            await this.recommendationService.updateRecommendationWeights(req.user._id.toString(), body);
            return {
                success: true,
                message: 'Feedback submitted successfully. Recommendations will improve over time.',
            };
        }
        catch (error) {
            this.logger.error('Error submitting feedback:', error);
            throw error;
        }
    }
    async trainMLModel(force) {
        try {
            const result = await this.mlSyncService.syncAndTrainModel(force === 'true');
            return {
                success: result.success,
                message: result.message,
                data: result.stats,
            };
        }
        catch (error) {
            this.logger.error('Error training ML model:', error);
            throw error;
        }
    }
    async getMLStatus() {
        try {
            const syncStatus = this.mlSyncService.getStatus();
            const flaskHealthy = await this.flaskMLService.healthCheck();
            return {
                success: true,
                data: {
                    flaskService: {
                        healthy: flaskHealthy,
                        status: flaskHealthy ? 'online' : 'offline',
                    },
                    sync: syncStatus,
                },
            };
        }
        catch (error) {
            this.logger.error('Error getting ML status:', error);
            throw error;
        }
    }
    async getContentBasedRecommendations(req, limit, excludePropertyIds, minScore, locationWeight, priceWeight, amenitiesWeight) {
        try {
            const request = {
                userId: req.user._id.toString(),
                algorithm: 'content-based',
                limit: limit ? parseInt(limit) : 20,
                excludePropertyIds: excludePropertyIds ? excludePropertyIds.split(',') : undefined,
                options: {
                    minScore: minScore ? parseFloat(minScore) : undefined,
                    locationWeight: locationWeight ? parseFloat(locationWeight) : undefined,
                    priceWeight: priceWeight ? parseFloat(priceWeight) : undefined,
                    amenitiesWeight: amenitiesWeight ? parseFloat(amenitiesWeight) : undefined,
                },
            };
            const result = await this.recommendationService.getRecommendations(request);
            return {
                success: true,
                data: result.data,
            };
        }
        catch (error) {
            this.logger.error('Error getting content-based recommendations:', error);
            throw error;
        }
    }
    async getCollaborativeRecommendations(req, limit, excludePropertyIds) {
        try {
            const request = {
                userId: req.user._id.toString(),
                algorithm: 'collaborative',
                limit: limit ? parseInt(limit) : 20,
                excludePropertyIds: excludePropertyIds ? excludePropertyIds.split(',') : undefined,
            };
            const result = await this.recommendationService.getRecommendations(request);
            return {
                success: true,
                data: result.data,
            };
        }
        catch (error) {
            this.logger.error('Error getting collaborative recommendations:', error);
            throw error;
        }
    }
    async getPopularityRecommendations(req, limit, excludePropertyIds) {
        try {
            const request = {
                userId: req.user._id.toString(),
                algorithm: 'popularity',
                limit: limit ? parseInt(limit) : 20,
                excludePropertyIds: excludePropertyIds ? excludePropertyIds.split(',') : undefined,
            };
            const result = await this.recommendationService.getRecommendations(request);
            return {
                success: true,
                data: result.data,
            };
        }
        catch (error) {
            this.logger.error('Error getting popularity recommendations:', error);
            throw error;
        }
    }
    async getHybridRecommendations(req, limit, excludePropertyIds, contentWeight, collaborativeWeight, popularityWeight, minScore) {
        try {
            const request = {
                userId: req.user._id.toString(),
                algorithm: 'hybrid',
                limit: limit ? parseInt(limit) : 20,
                excludePropertyIds: excludePropertyIds ? excludePropertyIds.split(',') : undefined,
                options: {
                    contentWeight: contentWeight ? parseFloat(contentWeight) : 0.5,
                    collaborativeWeight: collaborativeWeight ? parseFloat(collaborativeWeight) : 0.3,
                    popularityWeight: popularityWeight ? parseFloat(popularityWeight) : 0.2,
                    minScore: minScore ? parseFloat(minScore) : undefined,
                },
            };
            const result = await this.recommendationService.getRecommendations(request);
            return {
                success: true,
                data: result.data,
            };
        }
        catch (error) {
            this.logger.error('Error getting hybrid recommendations:', error);
            throw error;
        }
    }
};
exports.RecommendationController = RecommendationController;
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: 'Get personalized property recommendations' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Recommendations retrieved successfully.' }),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Query)('algorithm')),
    __param(2, (0, common_1.Query)('limit')),
    __param(3, (0, common_1.Query)('excludePropertyIds')),
    __param(4, (0, common_1.Query)('contentWeight')),
    __param(5, (0, common_1.Query)('collaborativeWeight')),
    __param(6, (0, common_1.Query)('popularityWeight')),
    __param(7, (0, common_1.Query)('minScore')),
    __param(8, (0, common_1.Query)('locationWeight')),
    __param(9, (0, common_1.Query)('priceWeight')),
    __param(10, (0, common_1.Query)('amenitiesWeight')),
    __param(11, (0, common_1.Query)('boostRecentViews')),
    __param(12, (0, common_1.Query)('boostSimilarProperties')),
    __param(13, (0, common_1.Query)('preferredPropertyType')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String, String, String, String, String, String, String, String, String, String, String]),
    __metadata("design:returntype", Promise)
], RecommendationController.prototype, "getRecommendations", null);
__decorate([
    (0, common_1.Get)('flask-ml'),
    (0, swagger_1.ApiOperation)({ summary: 'Get Flask ML-powered recommendations' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'ML recommendations retrieved successfully.' }),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Query)('limit')),
    __param(2, (0, common_1.Query)('excludePropertyIds')),
    __param(3, (0, common_1.Query)('preferredPropertyType')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String]),
    __metadata("design:returntype", Promise)
], RecommendationController.prototype, "getFlaskMLRecommendations", null);
__decorate([
    (0, common_1.Get)('stats'),
    (0, swagger_1.ApiOperation)({ summary: 'Get user recommendation statistics and profile' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Recommendation stats retrieved successfully.' }),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], RecommendationController.prototype, "getRecommendationStats", null);
__decorate([
    (0, common_1.Post)('feedback'),
    (0, swagger_1.ApiOperation)({ summary: 'Submit feedback on recommendations to improve future suggestions' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Feedback submitted successfully.' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], RecommendationController.prototype, "submitFeedback", null);
__decorate([
    (0, common_1.Post)('ml/train'),
    (0, swagger_1.ApiOperation)({ summary: 'Manually trigger ML model training' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'ML model training initiated.' }),
    __param(0, (0, common_1.Query)('force')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], RecommendationController.prototype, "trainMLModel", null);
__decorate([
    (0, common_1.Get)('ml/status'),
    (0, swagger_1.ApiOperation)({ summary: 'Get ML service status' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'ML service status retrieved.' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], RecommendationController.prototype, "getMLStatus", null);
__decorate([
    (0, common_1.Get)('content-based'),
    (0, swagger_1.ApiOperation)({ summary: 'Get content-based recommendations only' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Content-based recommendations retrieved successfully.' }),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Query)('limit')),
    __param(2, (0, common_1.Query)('excludePropertyIds')),
    __param(3, (0, common_1.Query)('minScore')),
    __param(4, (0, common_1.Query)('locationWeight')),
    __param(5, (0, common_1.Query)('priceWeight')),
    __param(6, (0, common_1.Query)('amenitiesWeight')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String, String, String, String]),
    __metadata("design:returntype", Promise)
], RecommendationController.prototype, "getContentBasedRecommendations", null);
__decorate([
    (0, common_1.Get)('collaborative'),
    (0, swagger_1.ApiOperation)({ summary: 'Get collaborative filtering recommendations only' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Collaborative recommendations retrieved successfully.' }),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Query)('limit')),
    __param(2, (0, common_1.Query)('excludePropertyIds')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], RecommendationController.prototype, "getCollaborativeRecommendations", null);
__decorate([
    (0, common_1.Get)('popularity'),
    (0, swagger_1.ApiOperation)({ summary: 'Get popularity-based recommendations only' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Popularity-based recommendations retrieved successfully.' }),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Query)('limit')),
    __param(2, (0, common_1.Query)('excludePropertyIds')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], RecommendationController.prototype, "getPopularityRecommendations", null);
__decorate([
    (0, common_1.Get)('hybrid'),
    (0, swagger_1.ApiOperation)({ summary: 'Get hybrid recommendations combining all algorithms' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Hybrid recommendations retrieved successfully.' }),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Query)('limit')),
    __param(2, (0, common_1.Query)('excludePropertyIds')),
    __param(3, (0, common_1.Query)('contentWeight')),
    __param(4, (0, common_1.Query)('collaborativeWeight')),
    __param(5, (0, common_1.Query)('popularityWeight')),
    __param(6, (0, common_1.Query)('minScore')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String, String, String, String]),
    __metadata("design:returntype", Promise)
], RecommendationController.prototype, "getHybridRecommendations", null);
exports.RecommendationController = RecommendationController = RecommendationController_1 = __decorate([
    (0, swagger_1.ApiTags)('recommendations'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('recommendations'),
    __metadata("design:paramtypes", [recommendation_service_1.RecommendationService,
        ml_sync_service_1.MLSyncService,
        flask_ml_service_1.FlaskMLService])
], RecommendationController);
//# sourceMappingURL=recommendation.controller.js.map