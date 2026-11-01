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
var HybridRecommendationService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.HybridRecommendationService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const property_schema_1 = require("../properties/schemas/property.schema");
const user_interactions_service_1 = require("../user-interactions/user-interactions.service");
const content_based_service_1 = require("./content-based.service");
let HybridRecommendationService = HybridRecommendationService_1 = class HybridRecommendationService {
    propertyModel;
    contentBasedService;
    userInteractionsService;
    logger = new common_1.Logger(HybridRecommendationService_1.name);
    constructor(propertyModel, contentBasedService, userInteractionsService) {
        this.propertyModel = propertyModel;
        this.contentBasedService = contentBasedService;
        this.userInteractionsService = userInteractionsService;
    }
    async getHybridRecommendations(userId, options = {}) {
        const startTime = Date.now();
        const userObjectId = new mongoose_2.Types.ObjectId(userId);
        try {
            const weights = {
                contentWeight: options.contentWeight || 0.5,
                collaborativeWeight: options.collaborativeWeight || 0.3,
                popularityWeight: options.popularityWeight || 0.2,
            };
            const [contentBased, collaborative, popularity] = await Promise.all([
                this.getContentBasedScores(userObjectId, options),
                this.getCollaborativeScores(userObjectId, options),
                this.getPopularityScores(userObjectId, options),
            ]);
            const hybridRecommendations = this.combineRecommendations(contentBased, collaborative, popularity, weights);
            const finalRecommendations = hybridRecommendations
                .sort((a, b) => b.finalScore - a.finalScore)
                .slice(0, options.limit || 20);
            const processingTime = Date.now() - startTime;
            const result = {
                recommendations: finalRecommendations,
                metadata: {
                    totalCandidates: Math.max(contentBased.size, collaborative.size, popularity.size),
                    contentBasedCount: contentBased.size,
                    collaborativeCount: collaborative.size,
                    popularityCount: popularity.size,
                    processingTime,
                    userProfileStrength: await this.calculateProfileStrength(userObjectId),
                },
            };
            this.logger.log(`Generated ${finalRecommendations.length} hybrid recommendations for user ${userId} in ${processingTime}ms`);
            return result;
        }
        catch (error) {
            this.logger.error('Error generating hybrid recommendations:', error);
            throw error;
        }
    }
    async getContentBasedScores(userId, options) {
        try {
            const recommendations = await this.contentBasedService.getContentBasedRecommendations(userId, options);
            const scores = new Map();
            recommendations.forEach(rec => {
                scores.set(rec.propertyId.toString(), {
                    score: rec.score,
                    reasons: rec.reasons,
                });
            });
            return scores;
        }
        catch (error) {
            this.logger.error('Error getting content-based scores:', error);
            return new Map();
        }
    }
    async getCollaborativeScores(userId, options) {
        try {
            const similarUsers = await this.userInteractionsService.getSimilarUsers(userId.toString(), 10);
            if (similarUsers.length === 0) {
                return new Map();
            }
            const recommendedProperties = await this.userInteractionsService.getRecommendedProperties(userId.toString(), 50, options.excludePropertyIds);
            const scores = new Map();
            for (const propertyId of recommendedProperties) {
                const score = await this.calculateCollaborativeScore(propertyId, similarUsers);
                scores.set(propertyId.toString(), {
                    score,
                    reasons: ['Users with similar taste liked this property'],
                });
            }
            return scores;
        }
        catch (error) {
            this.logger.error('Error getting collaborative scores:', error);
            return new Map();
        }
    }
    async getPopularityScores(userId, options) {
        try {
            const popularProperties = await this.propertyModel
                .find({
                isActive: true,
                availability: 'active',
                _id: { $nin: options.excludePropertyIds || [] },
            })
                .sort({
                viewsCount: -1,
                favoritesCount: -1,
                inquiriesCount: -1,
                averageRating: -1,
            })
                .limit(50)
                .exec();
            const scores = new Map();
            popularProperties.forEach(property => {
                const maxViews = Math.max(...popularProperties.map(p => p.viewsCount || 0));
                const maxFavorites = Math.max(...popularProperties.map(p => p.favoritesCount || 0));
                const maxInquiries = Math.max(...popularProperties.map(p => p.inquiriesCount || 0));
                const viewScore = (property.viewsCount || 0) / maxViews;
                const favoriteScore = (property.favoritesCount || 0) / maxFavorites;
                const inquiryScore = (property.inquiriesCount || 0) / maxInquiries;
                const ratingScore = (property.averageRating || 0) / 5;
                const popularityScore = (viewScore * 0.3 + favoriteScore * 0.3 + inquiryScore * 0.2 + ratingScore * 0.2);
                const reasons = [];
                if (viewScore > 0.7)
                    reasons.push('Highly viewed property');
                if (favoriteScore > 0.7)
                    reasons.push('Popular among users');
                if (ratingScore > 0.8)
                    reasons.push('Excellent ratings');
                scores.set(property._id.toString(), {
                    score: popularityScore,
                    reasons,
                });
            });
            return scores;
        }
        catch (error) {
            this.logger.error('Error getting popularity scores:', error);
            return new Map();
        }
    }
    combineRecommendations(contentBased, collaborative, popularity, weights) {
        const combinedRecommendations = [];
        const allPropertyIds = new Set([
            ...contentBased.keys(),
            ...collaborative.keys(),
            ...popularity.keys(),
        ]);
        allPropertyIds.forEach(propertyId => {
            const contentScore = contentBased.get(propertyId)?.score || 0;
            const collaborativeScore = collaborative.get(propertyId)?.score || 0;
            const popularityScore = popularity.get(propertyId)?.score || 0;
            const finalScore = contentScore * weights.contentWeight +
                collaborativeScore * weights.collaborativeWeight +
                popularityScore * weights.popularityWeight;
            const reasons = [
                ...(contentBased.get(propertyId)?.reasons || []),
                ...(collaborative.get(propertyId)?.reasons || []),
                ...(popularity.get(propertyId)?.reasons || []),
            ];
            combinedRecommendations.push({
                propertyId: new mongoose_2.Types.ObjectId(propertyId),
                finalScore,
                contentBasedScore: contentScore,
                collaborativeScore,
                popularityScore,
                reasons: [...new Set(reasons)],
                methodology: weights,
            });
        });
        return combinedRecommendations;
    }
    async calculateCollaborativeScore(propertyId, similarUsers) {
        try {
            const interactions = await this.userInteractionsService.getUserInteractions({
                userId: similarUsers[0].toString(),
                propertyId: propertyId.toString(),
                limit: 100,
            });
            if (interactions.length === 0) {
                return 0;
            }
            let totalScore = 0;
            interactions.forEach(interaction => {
                const weight = this.getInteractionWeight(interaction.interactionType);
                totalScore += weight;
            });
            const maxPossibleScore = interactions.length * 5;
            return Math.min(totalScore / maxPossibleScore, 1.0);
        }
        catch (error) {
            this.logger.error('Error calculating collaborative score:', error);
            return 0;
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
    getInteractionWeight(interactionType) {
        const weights = {
            property_view: 1,
            property_favorite: 3,
            property_inquiry: 5,
            property_share: 2,
            schedule_viewing: 6,
            contact_agent: 5,
        };
        return weights[interactionType] || 1;
    }
    async getRecommendationsWithDetails(userId, options = {}) {
        try {
            const result = await this.getHybridRecommendations(userId, options);
            if (result.recommendations.length === 0) {
                return [];
            }
            const propertyIds = result.recommendations.map(r => r.propertyId);
            const properties = await this.propertyModel
                .find({ _id: { $in: propertyIds } })
                .populate('ownerId', 'name profilePicture')
                .populate('agentId', 'name profilePicture agency')
                .exec();
            return result.recommendations.map(rec => {
                const property = properties.find(p => p._id.toString() === rec.propertyId.toString());
                return {
                    ...rec,
                    property,
                    metadata: result.metadata,
                };
            });
        }
        catch (error) {
            this.logger.error('Error getting recommendations with details:', error);
            throw error;
        }
    }
};
exports.HybridRecommendationService = HybridRecommendationService;
exports.HybridRecommendationService = HybridRecommendationService = HybridRecommendationService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(property_schema_1.Property.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        content_based_service_1.ContentBasedRecommendationService,
        user_interactions_service_1.UserInteractionsService])
], HybridRecommendationService);
//# sourceMappingURL=hybrid.service.js.map