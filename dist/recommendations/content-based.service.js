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
var ContentBasedRecommendationService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContentBasedRecommendationService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("mongoose");
const property_schema_1 = require("../properties/schemas/property.schema");
const user_interactions_service_1 = require("../user-interactions/user-interactions.service");
const user_schema_1 = require("../users/schemas/user.schema");
const mongoose_2 = require("@nestjs/mongoose");
const user_interaction_schema_1 = require("../user-interactions/schemas/user-interaction.schema");
let ContentBasedRecommendationService = ContentBasedRecommendationService_1 = class ContentBasedRecommendationService {
    propertyModel;
    userInteractionsService;
    userModel;
    logger = new common_1.Logger(ContentBasedRecommendationService_1.name);
    constructor(propertyModel, userInteractionsService, userModel) {
        this.propertyModel = propertyModel;
        this.userInteractionsService = userInteractionsService;
        this.userModel = userModel;
    }
    async getContentBasedRecommendations(userId, options = {}) {
        try {
            const userObjectId = new mongoose_1.Types.ObjectId(userId);
            const userProfile = await this.buildUserProfile(userObjectId);
            const candidateProperties = await this.getCandidateProperties(userObjectId, options);
            const recommendations = [];
            for (const property of candidateProperties) {
                const score = await this.calculateContentSimilarity(property, userProfile, options);
                if (score.score >= (options.minScore || 0.3)) {
                    recommendations.push(score);
                }
            }
            const sortedRecommendations = recommendations
                .sort((a, b) => b.score - a.score)
                .slice(0, options.limit || 20);
            this.logger.log(`Generated ${sortedRecommendations.length} content-based recommendations for user ${userId}`);
            return sortedRecommendations;
        }
        catch (error) {
            this.logger.error('Error generating content-based recommendations:', error);
            throw error;
        }
    }
    async buildUserProfile(userId) {
        try {
            const interactions = await this.userInteractionsService.getUserInteractions({
                userId,
                interactionTypes: [
                    user_interaction_schema_1.InteractionType.PROPERTY_VIEW,
                    user_interaction_schema_1.InteractionType.PROPERTY_FAVORITE,
                    user_interaction_schema_1.InteractionType.PROPERTY_INQUIRY,
                ],
                limit: 500,
            });
            const userProfile = {
                userId,
                preferredPropertyTypes: new Map(),
                priceRange: { min: 0, max: 10000000, weight: 0 },
                preferredCities: new Map(),
                preferredAmenities: new Map(),
                preferredBedrooms: new Map(),
                preferredBathrooms: new Map(),
                preferredSizeRange: { min: 0, max: 1000, weight: 0 },
                interactionWeights: new Map(),
            };
            const propertyIds = interactions
                .filter(i => i.propertyId)
                .map(i => i.propertyId);
            if (propertyIds.length === 0) {
                try {
                    const user = await this.userModel.findById(userId).exec();
                    if (user && user.preferences) {
                        const prefs = user.preferences;
                        if (prefs.propertyTypes && Array.isArray(prefs.propertyTypes)) {
                            prefs.propertyTypes.forEach((t) => {
                                const current = userProfile.preferredPropertyTypes.get(t) || 0;
                                userProfile.preferredPropertyTypes.set(t, current + 5);
                            });
                        }
                        if (prefs.cities && Array.isArray(prefs.cities)) {
                            prefs.cities.forEach((c) => {
                                const current = userProfile.preferredCities.get(c) || 0;
                                userProfile.preferredCities.set(c, current + 5);
                            });
                        }
                        if (prefs.amenities && Array.isArray(prefs.amenities)) {
                            prefs.amenities.forEach((a) => {
                                const current = userProfile.preferredAmenities.get(a) || 0;
                                userProfile.preferredAmenities.set(a, current + 3);
                            });
                        }
                        if (prefs.minPrice || prefs.maxPrice) {
                            userProfile.priceRange.min = prefs.minPrice || userProfile.priceRange.min;
                            userProfile.priceRange.max = prefs.maxPrice || userProfile.priceRange.max;
                            userProfile.priceRange.weight = 1;
                        }
                    }
                }
                catch (err) {
                    this.logger.warn('Error reading user preferences, continuing with default profile');
                }
                return userProfile;
            }
            const properties = await this.propertyModel
                .find({ _id: { $in: propertyIds } })
                .exec();
            for (const interaction of interactions) {
                if (!interaction.propertyId)
                    continue;
                const property = properties.find(p => p._id.toString() === interaction.propertyId?.toString());
                if (!property)
                    continue;
                const weight = this.getInteractionWeight(interaction.interactionType);
                if (property.type) {
                    const current = userProfile.preferredPropertyTypes.get(property.type) || 0;
                    userProfile.preferredPropertyTypes.set(property.type, current + weight);
                }
                if (property.price) {
                    userProfile.priceRange.min = Math.min(userProfile.priceRange.min, property.price * 0.8);
                    userProfile.priceRange.max = Math.max(userProfile.priceRange.max, property.price * 1.2);
                    userProfile.priceRange.weight += weight;
                }
                if (property.city) {
                    const current = userProfile.preferredCities.get(property.city) || 0;
                    userProfile.preferredCities.set(property.city, current + weight);
                }
                if (property.amenities?.bedrooms) {
                    const current = userProfile.preferredBedrooms.get(property.amenities.bedrooms) || 0;
                    userProfile.preferredBedrooms.set(property.amenities.bedrooms, current + weight);
                }
                if (property.amenities?.bathrooms) {
                    const current = userProfile.preferredBathrooms.get(property.amenities.bathrooms) || 0;
                    userProfile.preferredBathrooms.set(property.amenities.bathrooms, current + weight);
                }
                if (property.area) {
                    userProfile.preferredSizeRange.min = Math.min(userProfile.preferredSizeRange.min, property.area * 0.8);
                    userProfile.preferredSizeRange.max = Math.max(userProfile.preferredSizeRange.max, property.area * 1.2);
                    userProfile.preferredSizeRange.weight += weight;
                }
                if (property.amenities) {
                    Object.entries(property.amenities).forEach(([amenity, value]) => {
                        if (value === true) {
                            const current = userProfile.preferredAmenities.get(amenity) || 0;
                            userProfile.preferredAmenities.set(amenity, current + weight * 0.5);
                        }
                    });
                }
                const currentWeight = userProfile.interactionWeights.get(interaction.interactionType) || 0;
                userProfile.interactionWeights.set(interaction.interactionType, currentWeight + weight);
            }
            return userProfile;
        }
        catch (error) {
            this.logger.error('Error building user profile:', error);
            throw error;
        }
    }
    async calculateContentSimilarity(property, userProfile, options) {
        const features = {
            propertyTypeMatch: 0,
            priceRangeMatch: 0,
            locationMatch: 0,
            amenitiesMatch: 0,
            sizeMatch: 0,
            featuresMatch: 0,
        };
        const reasons = [];
        if (property.type && userProfile.preferredPropertyTypes.has(property.type)) {
            features.propertyTypeMatch = userProfile.preferredPropertyTypes.get(property.type) / 10;
            reasons.push(`Matches preferred property type: ${property.type}`);
        }
        if (property.price && userProfile.priceRange.weight > 0) {
            const priceScore = this.calculatePriceSimilarity(property.price, userProfile.priceRange);
            features.priceRangeMatch = priceScore;
            if (priceScore > 0.5) {
                reasons.push('Within preferred price range');
            }
        }
        if (property.city && userProfile.preferredCities.has(property.city)) {
            features.locationMatch = userProfile.preferredCities.get(property.city) / 10;
            reasons.push(`Located in preferred city: ${property.city}`);
        }
        if (property.amenities) {
            const amenitiesScore = this.calculateAmenitiesSimilarity(property.amenities, userProfile.preferredAmenities);
            features.amenitiesMatch = amenitiesScore;
            if (amenitiesScore > 0.3) {
                reasons.push('Has preferred amenities');
            }
        }
        if (property.area && userProfile.preferredSizeRange.weight > 0) {
            const sizeScore = this.calculateSizeSimilarity(property.area, userProfile.preferredSizeRange);
            features.sizeMatch = sizeScore;
            if (sizeScore > 0.5) {
                reasons.push('Matches preferred size');
            }
        }
        const featuresScore = this.calculateFeaturesSimilarity(property, userProfile);
        features.featuresMatch = featuresScore;
        const locationWeight = options.locationWeight || 0.25;
        const priceWeight = options.priceWeight || 0.2;
        const amenitiesWeight = options.amenitiesWeight || 0.2;
        const typeWeight = 0.15;
        const sizeWeight = 0.1;
        const featuresWeight = 0.1;
        const totalScore = features.propertyTypeMatch * typeWeight +
            features.priceRangeMatch * priceWeight +
            features.locationMatch * locationWeight +
            features.amenitiesMatch * amenitiesWeight +
            features.sizeMatch * sizeWeight +
            features.featuresMatch * featuresWeight;
        let finalScore = totalScore;
        if (options.boostRecentViews) {
            finalScore *= 1.1;
        }
        if (options.boostSimilarProperties) {
            finalScore *= 1.05;
        }
        return {
            propertyId: property._id,
            score: Math.min(finalScore, 1.0),
            reasons,
            similarityFeatures: features,
        };
    }
    async getCandidateProperties(userId, options) {
        try {
            const userInteractions = await this.userInteractionsService.getUserInteractions({
                userId,
                limit: 1000,
            });
            const excludeIds = [
                ...userInteractions.map(i => i.propertyId).filter(Boolean),
                ...(options.excludePropertyIds || []),
            ];
            const query = {
                isActive: true,
                availability: 'active',
                _id: { $nin: excludeIds },
            };
            query.ownerId = { $ne: userId };
            const properties = await this.propertyModel
                .find(query)
                .populate('ownerId', 'name')
                .populate('agentId', 'name agency')
                .limit(500)
                .exec();
            return properties;
        }
        catch (error) {
            this.logger.error('Error getting candidate properties:', error);
            throw error;
        }
    }
    calculatePriceSimilarity(price, priceRange) {
        if (price < priceRange.min || price > priceRange.max) {
            const deviation = Math.max(priceRange.min - price, price - priceRange.max);
            const maxDeviation = Math.max(priceRange.max - priceRange.min, priceRange.min);
            return Math.max(0, 1 - (deviation / maxDeviation)) * 0.3;
        }
        const center = (priceRange.min + priceRange.max) / 2;
        const range = priceRange.max - priceRange.min;
        const deviation = Math.abs(price - center);
        return Math.max(0, 1 - (deviation / range)) * 0.8;
    }
    calculateAmenitiesSimilarity(propertyAmenities, preferredAmenities) {
        if (preferredAmenities.size === 0)
            return 0;
        let matchScore = 0;
        let totalWeight = 0;
        Object.entries(propertyAmenities).forEach(([amenity, value]) => {
            if (value === true && preferredAmenities.has(amenity)) {
                matchScore += preferredAmenities.get(amenity);
            }
            totalWeight += preferredAmenities.get(amenity) || 0;
        });
        return totalWeight > 0 ? matchScore / totalWeight : 0;
    }
    calculateSizeSimilarity(size, sizeRange) {
        if (size < sizeRange.min || size > sizeRange.max) {
            const deviation = Math.max(sizeRange.min - size, size - sizeRange.max);
            const maxDeviation = Math.max(sizeRange.max - sizeRange.min, sizeRange.min);
            return Math.max(0, 1 - (deviation / maxDeviation)) * 0.3;
        }
        const center = (sizeRange.min + sizeRange.max) / 2;
        const range = sizeRange.max - sizeRange.min;
        const deviation = Math.abs(size - center);
        return Math.max(0, 1 - (deviation / range)) * 0.8;
    }
    calculateFeaturesSimilarity(property, userProfile) {
        let score = 0;
        let factors = 0;
        if (property.keywords && property.keywords.length > 0) {
            factors++;
        }
        if (property.nearbyAmenities && property.nearbyAmenities.length > 0) {
            score += 0.3;
            factors++;
        }
        if (property.transportAccess && property.transportAccess.length > 0) {
            score += 0.2;
            factors++;
        }
        if (property.isVerified)
            score += 0.1;
        if (property.isFeatured)
            score += 0.1;
        if (property.averageRating && property.averageRating > 4)
            score += 0.2;
        return factors > 0 ? score / factors : 0;
    }
    getInteractionWeight(interactionType) {
        const weights = {
            [user_interaction_schema_1.InteractionType.PROPERTY_VIEW]: 1,
            [user_interaction_schema_1.InteractionType.PROPERTY_FAVORITE]: 3,
            [user_interaction_schema_1.InteractionType.PROPERTY_INQUIRY]: 5,
            [user_interaction_schema_1.InteractionType.PROPERTY_SHARE]: 2,
            [user_interaction_schema_1.InteractionType.SCHEDULE_VIEWING]: 6,
            [user_interaction_schema_1.InteractionType.CONTACT_AGENT]: 5,
        };
        return weights[interactionType] || 1;
    }
    async getRecommendationsWithDetails(userId, options = {}) {
        try {
            const recommendations = await this.getContentBasedRecommendations(userId, options);
            if (recommendations.length === 0) {
                return [];
            }
            const propertyIds = recommendations.map(r => r.propertyId);
            const properties = await this.propertyModel
                .find({ _id: { $in: propertyIds } })
                .populate('ownerId', 'name profilePicture')
                .populate('agentId', 'name profilePicture agency')
                .exec();
            return recommendations.map(rec => {
                const property = properties.find(p => p._id.toString() === rec.propertyId.toString());
                return {
                    ...rec,
                    property,
                };
            });
        }
        catch (error) {
            this.logger.error('Error getting recommendations with details:', error);
            throw error;
        }
    }
};
exports.ContentBasedRecommendationService = ContentBasedRecommendationService;
exports.ContentBasedRecommendationService = ContentBasedRecommendationService = ContentBasedRecommendationService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_2.InjectModel)(property_schema_1.Property.name)),
    __param(2, (0, mongoose_2.InjectModel)(user_schema_1.User.name)),
    __metadata("design:paramtypes", [mongoose_1.Model,
        user_interactions_service_1.UserInteractionsService,
        mongoose_1.Model])
], ContentBasedRecommendationService);
//# sourceMappingURL=content-based.service.js.map