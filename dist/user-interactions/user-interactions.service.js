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
var UserInteractionsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserInteractionsService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const user_interaction_schema_1 = require("./schemas/user-interaction.schema");
const user_interaction_schema_2 = require("./schemas/user-interaction.schema");
let UserInteractionsService = UserInteractionsService_1 = class UserInteractionsService {
    userInteractionModel;
    logger = new common_1.Logger(UserInteractionsService_1.name);
    constructor(userInteractionModel) {
        this.userInteractionModel = userInteractionModel;
    }
    async trackInteraction(createInteractionDto) {
        try {
            const interaction = new this.userInteractionModel({
                ...createInteractionDto,
                userId: new mongoose_2.Types.ObjectId(createInteractionDto.userId),
                propertyId: createInteractionDto.propertyId
                    ? new mongoose_2.Types.ObjectId(createInteractionDto.propertyId)
                    : undefined,
                agentId: createInteractionDto.agentId
                    ? new mongoose_2.Types.ObjectId(createInteractionDto.agentId)
                    : undefined,
                weight: createInteractionDto.weight || this.calculateInteractionWeight(createInteractionDto.interactionType),
                metadata: createInteractionDto.metadata || {},
            });
            const savedInteraction = await interaction.save();
            this.logger.log(`Tracked interaction: ${createInteractionDto.interactionType} for user ${createInteractionDto.userId}`);
            return savedInteraction;
        }
        catch (error) {
            this.logger.error('Error tracking interaction:', error);
            throw error;
        }
    }
    async trackBulkInteractions(interactions) {
        try {
            const processedInteractions = interactions.map(dto => ({
                ...dto,
                userId: new mongoose_2.Types.ObjectId(dto.userId),
                propertyId: dto.propertyId ? new mongoose_2.Types.ObjectId(dto.propertyId) : undefined,
                agentId: dto.agentId ? new mongoose_2.Types.ObjectId(dto.agentId) : undefined,
                weight: dto.weight || this.calculateInteractionWeight(dto.interactionType),
                metadata: dto.metadata || {},
            }));
            const savedInteractions = await this.userInteractionModel.insertMany(processedInteractions);
            this.logger.log(`Tracked ${savedInteractions.length} bulk interactions`);
            return savedInteractions;
        }
        catch (error) {
            this.logger.error('Error tracking bulk interactions:', error);
            throw error;
        }
    }
    async getUserInteractions(query) {
        try {
            const { userId, interactionTypes, propertyId, source, city, propertyType, priceRange, bedrooms, bathrooms, startDate, endDate, limit = 100, sortBy = 'createdAt', sortOrder = 'desc', } = query;
            const filterQuery = {};
            if (userId) {
                filterQuery.userId = new mongoose_2.Types.ObjectId(userId);
            }
            if (interactionTypes && interactionTypes.length > 0) {
                filterQuery.interactionType = { $in: interactionTypes };
            }
            if (propertyId) {
                filterQuery.propertyId = new mongoose_2.Types.ObjectId(propertyId);
            }
            if (source) {
                filterQuery.source = source;
            }
            if (city) {
                filterQuery.city = city;
            }
            if (propertyType) {
                filterQuery.propertyType = propertyType;
            }
            if (priceRange) {
                filterQuery.price = {};
                if (priceRange.min)
                    filterQuery.price.$gte = priceRange.min;
                if (priceRange.max)
                    filterQuery.price.$lte = priceRange.max;
            }
            if (bedrooms) {
                filterQuery.bedrooms = bedrooms;
            }
            if (bathrooms) {
                filterQuery.bathrooms = bathrooms;
            }
            if (startDate || endDate) {
                filterQuery.createdAt = {};
                if (startDate)
                    filterQuery.createdAt.$gte = startDate;
                if (endDate)
                    filterQuery.createdAt.$lte = endDate;
            }
            const sort = {};
            sort[sortBy] = sortOrder === 'asc' ? 1 : -1;
            return this.userInteractionModel
                .find(filterQuery)
                .sort(sort)
                .limit(limit)
                .exec();
        }
        catch (error) {
            this.logger.error('Error getting user interactions:', error);
            throw error;
        }
    }
    async getUserRecommendationProfile(userId) {
        try {
            const userObjectId = new mongoose_2.Types.ObjectId(userId);
            const interactions = await this.userInteractionModel
                .find({ userId: userObjectId })
                .sort({ createdAt: -1 })
                .exec();
            const cityPreferences = this.calculateCityPreferences(interactions);
            const propertyTypePreferences = this.calculatePropertyTypePreferences(interactions);
            const priceRangePreference = this.calculatePriceRangePreference(interactions);
            const bedroomPreferences = this.calculateBedroomPreferences(interactions);
            const amenityPreferences = this.calculateAmenityPreferences(interactions);
            const interactionPatterns = this.calculateInteractionPatterns(interactions);
            return {
                userId: userObjectId,
                preferredCities: cityPreferences,
                preferredPropertyTypes: propertyTypePreferences,
                priceRange: priceRangePreference,
                preferredBedrooms: bedroomPreferences,
                preferredAmenities: amenityPreferences,
                interactionPatterns,
                lastUpdated: new Date(),
            };
        }
        catch (error) {
            this.logger.error('Error generating recommendation profile:', error);
            throw error;
        }
    }
    async getSimilarUsers(userId, limit = 10) {
        try {
            const userObjectId = new mongoose_2.Types.ObjectId(userId);
            const userProfile = await this.getUserRecommendationProfile(userObjectId);
            const preferredCities = (userProfile.preferredCities || []).map(p => p.city).filter(Boolean);
            const preferredPropertyTypes = (userProfile.preferredPropertyTypes || []).map(p => p.type).filter(Boolean);
            const midPrice = ((userProfile.priceRange?.min || 0) + (userProfile.priceRange?.max || 0)) / 2;
            const minInteractions = 3;
            if (preferredCities.length === 0 && preferredPropertyTypes.length === 0) {
                this.logger.log(`No strong preferences for user ${userId}, falling back to top users by interactions`);
                const topUsers = await this.userInteractionModel.aggregate([
                    { $match: { userId: { $ne: userObjectId } } },
                    { $group: { _id: '$userId', interactionCount: { $sum: 1 } } },
                    { $match: { interactionCount: { $gte: 1 } } },
                    { $sort: { interactionCount: -1 } },
                    { $limit: limit },
                    { $project: { _id: 1 } },
                ]);
                return topUsers.map(u => u._id);
            }
            const orConditions = [];
            if (preferredCities.length > 0) {
                orConditions.push({ cities: { $in: preferredCities } });
            }
            if (preferredPropertyTypes.length > 0) {
                orConditions.push({ propertyTypes: { $in: preferredPropertyTypes } });
            }
            const similarUsers = await this.userInteractionModel.aggregate([
                { $match: { userId: { $ne: userObjectId } } },
                {
                    $group: {
                        _id: '$userId',
                        cities: { $addToSet: '$city' },
                        propertyTypes: { $addToSet: '$propertyType' },
                        avgPrice: { $avg: '$price' },
                        interactionCount: { $sum: 1 },
                    },
                },
                ...(orConditions.length > 0
                    ? [{ $match: { $or: orConditions, interactionCount: { $gte: minInteractions } } }]
                    : [{ $match: { interactionCount: { $gte: minInteractions } } }]),
                {
                    $addFields: {
                        cityScore: {
                            $size: {
                                $setIntersection: ['$cities', preferredCities]
                            }
                        },
                        typeScore: {
                            $size: {
                                $setIntersection: ['$propertyTypes', preferredPropertyTypes]
                            }
                        },
                        priceScore: {
                            $subtract: [1000, { $abs: { $subtract: ['$avgPrice', midPrice] } }]
                        },
                    },
                },
                {
                    $addFields: {
                        similarityScore: {
                            $add: ['$cityScore', '$typeScore', '$priceScore']
                        }
                    },
                },
                { $sort: { similarityScore: -1 } },
                { $limit: limit },
                { $project: { _id: 1 } },
            ]);
            if (!similarUsers || similarUsers.length === 0) {
                this.logger.log(`No similar users found using preference filters for user ${userId}, falling back to top users`);
                const topUsers = await this.userInteractionModel.aggregate([
                    { $match: { userId: { $ne: userObjectId } } },
                    { $group: { _id: '$userId', interactionCount: { $sum: 1 } } },
                    { $sort: { interactionCount: -1 } },
                    { $limit: limit },
                    { $project: { _id: 1 } },
                ]);
                return topUsers.map(u => u._id);
            }
            return similarUsers.map(user => user._id);
        }
        catch (error) {
            this.logger.error('Error finding similar users:', error);
            throw error;
        }
    }
    async getRecommendedProperties(userId, limit = 20, excludePropertyIds) {
        try {
            const userObjectId = new mongoose_2.Types.ObjectId(userId);
            const profile = await this.getUserRecommendationProfile(userObjectId);
            const similarUsers = await this.getSimilarUsers(userObjectId, 5);
            const recommendedProperties = await this.userInteractionModel.aggregate([
                {
                    $match: {
                        userId: { $in: similarUsers },
                        interactionType: { $in: [user_interaction_schema_2.InteractionType.PROPERTY_VIEW, user_interaction_schema_2.InteractionType.PROPERTY_FAVORITE] },
                        propertyId: { $exists: true },
                    },
                },
                { $group: { _id: '$propertyId', score: { $sum: '$weight' }, count: { $sum: 1 } } },
                { $sort: { score: -1, count: -1 } },
                { $limit: limit * 2 },
                { $project: { _id: 1 } },
            ]);
            let propertyIds = recommendedProperties.map(p => p._id);
            const userInteractions = await this.userInteractionModel
                .find({
                userId: userObjectId,
                propertyId: { $in: propertyIds }
            })
                .distinct('propertyId');
            propertyIds = propertyIds.filter(id => !userInteractions.includes(id));
            if (excludePropertyIds && excludePropertyIds.length > 0) {
                propertyIds = propertyIds.filter(id => !excludePropertyIds.includes(id.toString()));
            }
            return propertyIds.slice(0, limit);
        }
        catch (error) {
            this.logger.error('Error getting recommended properties:', error);
            throw error;
        }
    }
    async markInteractionsAsProcessed(interactionIds, batchId) {
        try {
            await this.userInteractionModel.updateMany({ _id: { $in: interactionIds } }, {
                isProcessed: true,
                processedAt: new Date(),
                ...(batchId && { batchId }),
            });
            this.logger.log(`Marked ${interactionIds.length} interactions as processed`);
        }
        catch (error) {
            this.logger.error('Error marking interactions as processed:', error);
            throw error;
        }
    }
    async cleanupOldInteractions(daysOld = 365) {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - daysOld);
            const result = await this.userInteractionModel.deleteMany({
                isProcessed: true,
                processedAt: { $lt: cutoffDate },
            });
            this.logger.log(`Cleaned up ${result.deletedCount} old interactions`);
        }
        catch (error) {
            this.logger.error('Error cleaning up old interactions:', error);
            throw error;
        }
    }
    calculateInteractionWeight(interactionType) {
        const weights = {
            [user_interaction_schema_2.InteractionType.PROPERTY_VIEW]: 1,
            [user_interaction_schema_2.InteractionType.PROPERTY_FAVORITE]: 3,
            [user_interaction_schema_2.InteractionType.PROPERTY_UNFAVORITE]: 2,
            [user_interaction_schema_2.InteractionType.PROPERTY_SHARE]: 2,
            [user_interaction_schema_2.InteractionType.PROPERTY_INQUIRY]: 5,
            [user_interaction_schema_2.InteractionType.SEARCH]: 1,
            [user_interaction_schema_2.InteractionType.FILTER_APPLY]: 1,
            [user_interaction_schema_2.InteractionType.PROPERTY_COMPARE]: 2,
            [user_interaction_schema_2.InteractionType.MAP_VIEW]: 1,
            [user_interaction_schema_2.InteractionType.LIST_VIEW]: 1,
            [user_interaction_schema_2.InteractionType.SIMILAR_PROPERTIES_CLICK]: 2,
            [user_interaction_schema_2.InteractionType.RECOMMENDATION_CLICK]: 4,
            [user_interaction_schema_2.InteractionType.RECOMMENDATION_DISMISS]: 1,
            [user_interaction_schema_2.InteractionType.CONTACT_AGENT]: 5,
            [user_interaction_schema_2.InteractionType.SCHEDULE_VIEWING]: 6,
        };
        return weights[interactionType] || 1;
    }
    calculateCityPreferences(interactions) {
        const cityScores = new Map();
        interactions.forEach(interaction => {
            if (interaction.city) {
                const currentScore = cityScores.get(interaction.city) || 0;
                cityScores.set(interaction.city, currentScore + interaction.weight);
            }
        });
        return Array.from(cityScores.entries())
            .map(([city, score]) => ({ city, score }))
            .sort((a, b) => b.score - a.score)
            .slice(0, 10);
    }
    calculatePropertyTypePreferences(interactions) {
        const typeScores = new Map();
        interactions.forEach(interaction => {
            if (interaction.propertyType) {
                const currentScore = typeScores.get(interaction.propertyType) || 0;
                typeScores.set(interaction.propertyType, currentScore + interaction.weight);
            }
        });
        return Array.from(typeScores.entries())
            .map(([type, score]) => ({ type, score }))
            .sort((a, b) => b.score - a.score)
            .slice(0, 10);
    }
    calculatePriceRangePreference(interactions) {
        const prices = interactions
            .filter(i => i.price && i.price > 0)
            .map(i => i.price);
        if (prices.length === 0) {
            return { min: 0, max: 1000000, confidence: 0 };
        }
        prices.sort((a, b) => a - b);
        const percentile25 = prices[Math.floor(prices.length * 0.25)] || 0;
        const percentile75 = prices[Math.floor(prices.length * 0.75)] || 1000000;
        return {
            min: percentile25,
            max: percentile75,
            confidence: Math.min(prices.length / 10, 1),
        };
    }
    calculateBedroomPreferences(interactions) {
        const bedroomScores = new Map();
        interactions.forEach(interaction => {
            if (interaction.bedrooms !== undefined) {
                const currentScore = bedroomScores.get(interaction.bedrooms) || 0;
                bedroomScores.set(interaction.bedrooms, currentScore + interaction.weight);
            }
        });
        return Array.from(bedroomScores.entries())
            .map(([count, score]) => ({ count, score }))
            .sort((a, b) => b.score - a.score)
            .slice(0, 5);
    }
    calculateAmenityPreferences(interactions) {
        return [];
    }
    calculateInteractionPatterns(interactions) {
        const views = interactions.filter(i => i.interactionType === user_interaction_schema_2.InteractionType.PROPERTY_VIEW).length;
        const favorites = interactions.filter(i => i.interactionType === user_interaction_schema_2.InteractionType.PROPERTY_FAVORITE).length;
        const inquiries = interactions.filter(i => i.interactionType === user_interaction_schema_2.InteractionType.PROPERTY_INQUIRY).length;
        const hourCounts = new Array(24).fill(0);
        interactions.forEach(interaction => {
            const hour = interaction.createdAt.getHours();
            hourCounts[hour]++;
        });
        const peakHours = hourCounts
            .map((count, hour) => ({ hour, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 3)
            .map(h => h.hour);
        return {
            viewToFavoriteRatio: views > 0 ? favorites / views : 0,
            viewToInquiryRatio: views > 0 ? inquiries / views : 0,
            averageTimeOnPage: 0,
            peakActivityHours: peakHours,
        };
    }
};
exports.UserInteractionsService = UserInteractionsService;
exports.UserInteractionsService = UserInteractionsService = UserInteractionsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(user_interaction_schema_1.UserInteraction.name)),
    __metadata("design:paramtypes", [mongoose_2.Model])
], UserInteractionsService);
//# sourceMappingURL=user-interactions.service.js.map