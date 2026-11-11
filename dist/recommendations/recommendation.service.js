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
var RecommendationService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RecommendationService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const property_schema_1 = require("../properties/schemas/property.schema");
const user_schema_1 = require("../users/schemas/user.schema");
const user_interactions_service_1 = require("../user-interactions/user-interactions.service");
const flask_ml_service_1 = require("./flask-ml.service");
let RecommendationService = RecommendationService_1 = class RecommendationService {
    propertyModel;
    userModel;
    userInteractionsService;
    flaskMLService;
    logger = new common_1.Logger(RecommendationService_1.name);
    constructor(propertyModel, userModel, userInteractionsService, flaskMLService) {
        this.propertyModel = propertyModel;
        this.userModel = userModel;
        this.userInteractionsService = userInteractionsService;
        this.flaskMLService = flaskMLService;
    }
    async getRecommendations(request) {
        const startTime = Date.now();
        try {
            const userId = new mongoose_2.Types.ObjectId(request.userId);
            const requestedAlgorithm = request.algorithm || 'hybrid';
            const algorithm = 'flask-ml';
            if (requestedAlgorithm !== algorithm) {
                this.logger.warn(`Requested algorithm "${requestedAlgorithm}" overridden to "${algorithm}" (Flask-only mode)`);
            }
            const limit = request.limit || 20;
            const user = await this.userModel.findById(userId).exec();
            if (!user) {
                throw new Error('User not found');
            }
            let recommendations = [];
            let metadata = {
                algorithm,
                totalCandidates: 0,
                userProfileStrength: 0,
                processingTime: 0,
            };
            recommendations = await this.getFlaskMLRecommendations(request.userId, limit, request.excludePropertyIds, request.options?.preferredPropertyType);
            metadata.source = 'Flask ML Service';
            metadata.userProfileStrength = await this.calculateProfileStrength(userId);
            metadata.processingTime = Date.now() - startTime;
            metadata.totalCandidates = recommendations.length;
            const servedFromFlask = metadata.source?.toLowerCase().includes('flask') ?? false;
            this.logger.log(`Recommendations for user ${request.userId} (algorithm=${algorithm}) servedFromFlask=${servedFromFlask} source=${metadata.source || 'unknown'}`);
            return {
                success: true,
                data: {
                    recommendations,
                    metadata,
                },
            };
        }
        catch (error) {
            this.logger.error('Error getting recommendations:', error);
            throw error;
        }
    }
    async getFlaskMLRecommendations(userId, limit, excludeIds = [], preferredPropertyType) {
        try {
            this.logger.log(`Getting Flask ML recommendations for user ${userId}`);
            let flaskRecommendations = await this.flaskMLService.getPersonalizedRecommendations(userId, limit, excludeIds, preferredPropertyType);
            const enrichedRecommendations = await this.enrichFlaskRecommendations(flaskRecommendations);
            return enrichedRecommendations;
        }
        catch (error) {
            this.logger.error('Error getting Flask ML recommendations:', error);
            throw error;
        }
    }
    async enrichFlaskRecommendations(flaskRecommendations) {
        try {
            if (flaskRecommendations.length === 0) {
                return [];
            }
            const propertyIds = flaskRecommendations
                .map(rec => rec._id || rec.propertyId)
                .filter(Boolean)
                .map(id => new mongoose_2.Types.ObjectId(id));
            const properties = await this.propertyModel
                .find({ _id: { $in: propertyIds } })
                .populate('ownerId', 'name profilePicture email')
                .populate('agentId', 'name profilePicture agency email')
                .exec();
            const propertyMap = new Map(properties.map(p => [p._id.toString(), p]));
            return flaskRecommendations
                .map(rec => {
                const propertyId = (rec._id || rec.propertyId)?.toString();
                const property = propertyMap.get(propertyId);
                if (!property) {
                    this.logger.warn(`Property ${propertyId} not found in database`);
                    return null;
                }
                return {
                    property,
                    propertyId: property._id,
                    finalScore: rec.similarity_score || rec.score || 0.5,
                    reasons: ['Recommended by ML model based on your preferences'],
                    methodology: {
                        algorithm: 'flask-ml',
                        source: 'Flask ML Service',
                    },
                };
            })
                .filter(Boolean);
        }
        catch (error) {
            this.logger.error('Error enriching Flask recommendations:', error);
            return [];
        }
    }
    async calculateProfileStrength(userId) {
        try {
            const interactions = await this.userInteractionsService.getUserInteractions({
                userId,
                limit: 1000,
            });
            if (interactions.length === 0) {
                return 0;
            }
            const uniqueProperties = new Set(interactions.map(i => i.propertyId).filter(Boolean)).size;
            const interactionTypes = new Set(interactions.map(i => i.interactionType)).size;
            const recencyScore = this.calculateRecencyScore(interactions);
            const strengthScore = (uniqueProperties / Math.min(interactions.length, 100)) * 0.4 +
                (interactionTypes / 10) * 0.3 +
                recencyScore * 0.3;
            return Math.min(strengthScore, 1.0);
        }
        catch (error) {
            this.logger.error('Error calculating profile strength:', error);
            return 0;
        }
    }
    calculateRecencyScore(interactions) {
        if (interactions.length === 0)
            return 0;
        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const recentInteractions = interactions.filter(i => new Date(i.createdAt) > thirtyDaysAgo).length;
        return recentInteractions / interactions.length;
    }
    async getRecommendationStats(userId) {
        try {
            const userObjectId = new mongoose_2.Types.ObjectId(userId);
            const profile = await this.userInteractionsService.getUserRecommendationProfile(userObjectId);
            const similarUsers = await this.userInteractionsService.getSimilarUsers(userId, 10);
            const flaskRecommendations = await this.flaskMLService.getPersonalizedRecommendations(userId, 100);
            const profileStrength = await this.calculateProfileStrength(userObjectId);
            const flaskHealthy = await this.flaskMLService.healthCheck();
            return {
                userProfile: {
                    preferredCities: profile.preferredCities.slice(0, 5),
                    preferredPropertyTypes: profile.preferredPropertyTypes.slice(0, 5),
                    priceRange: profile.priceRange,
                    interactionPatterns: profile.interactionPatterns,
                },
                similarUsersCount: similarUsers.length,
                recommendationCandidates: flaskRecommendations.length,
                profileStrength,
                mlServiceStatus: flaskHealthy ? 'available' : 'unavailable',
                lastUpdated: new Date(),
            };
        }
        catch (error) {
            this.logger.error('Error getting recommendation stats:', error);
            throw error;
        }
    }
    async updateRecommendationWeights(userId, feedback) {
        try {
            const userObjectId = new mongoose_2.Types.ObjectId(userId);
            const propertyObjectId = new mongoose_2.Types.ObjectId(feedback.propertyId);
            if (feedback.clicked) {
                await this.userInteractionsService.trackInteraction({
                    userId: userObjectId,
                    interactionType: 'recommendation_click',
                    propertyId: propertyObjectId,
                    source: 'recommendations',
                    metadata: { rating: feedback.rating },
                });
            }
            if (feedback.favorited) {
                await this.userInteractionsService.trackInteraction({
                    userId: userObjectId,
                    interactionType: 'property_favorite',
                    propertyId: propertyObjectId,
                    source: 'recommendations',
                    metadata: { rating: feedback.rating },
                });
            }
            if (feedback.inquired) {
                await this.userInteractionsService.trackInteraction({
                    userId: userObjectId,
                    interactionType: 'property_inquiry',
                    propertyId: propertyObjectId,
                    source: 'recommendations',
                    metadata: { rating: feedback.rating },
                });
            }
            this.logger.log(`Updated recommendation weights for user ${userId}`);
        }
        catch (error) {
            this.logger.error('Error updating recommendation weights:', error);
            throw error;
        }
    }
};
exports.RecommendationService = RecommendationService;
exports.RecommendationService = RecommendationService = RecommendationService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(property_schema_1.Property.name)),
    __param(1, (0, mongoose_1.InjectModel)(user_schema_1.User.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model,
        user_interactions_service_1.UserInteractionsService,
        flask_ml_service_1.FlaskMLService])
], RecommendationService);
//# sourceMappingURL=recommendation.service.js.map