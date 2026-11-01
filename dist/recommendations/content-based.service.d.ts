import { Model, Types } from 'mongoose';
import { PropertyDocument } from '../properties/schemas/property.schema';
import { UserInteractionsService } from '../user-interactions/user-interactions.service';
import { UserDocument } from '../users/schemas/user.schema';
import { InteractionType } from '../user-interactions/schemas/user-interaction.schema';
export interface ContentBasedRecommendation {
    propertyId: Types.ObjectId;
    score: number;
    reasons: string[];
    similarityFeatures: {
        propertyTypeMatch: number;
        priceRangeMatch: number;
        locationMatch: number;
        amenitiesMatch: number;
        sizeMatch: number;
        featuresMatch: number;
    };
}
export interface UserProfile {
    userId: Types.ObjectId;
    preferredPropertyTypes: Map<string, number>;
    priceRange: {
        min: number;
        max: number;
        weight: number;
    };
    preferredCities: Map<string, number>;
    preferredAmenities: Map<string, number>;
    preferredBedrooms: Map<number, number>;
    preferredBathrooms: Map<number, number>;
    preferredSizeRange: {
        min: number;
        max: number;
        weight: number;
    };
    interactionWeights: Map<InteractionType, number>;
}
export interface RecommendationOptions {
    limit?: number;
    excludePropertyIds?: string[];
    minScore?: number;
    boostRecentViews?: boolean;
    boostSimilarProperties?: boolean;
    locationWeight?: number;
    priceWeight?: number;
    amenitiesWeight?: number;
}
export declare class ContentBasedRecommendationService {
    private propertyModel;
    private userInteractionsService;
    private userModel;
    private readonly logger;
    constructor(propertyModel: Model<PropertyDocument>, userInteractionsService: UserInteractionsService, userModel: Model<UserDocument>);
    getContentBasedRecommendations(userId: string | Types.ObjectId, options?: RecommendationOptions): Promise<ContentBasedRecommendation[]>;
    buildUserProfile(userId: Types.ObjectId): Promise<UserProfile>;
    private calculateContentSimilarity;
    private getCandidateProperties;
    private calculatePriceSimilarity;
    private calculateAmenitiesSimilarity;
    private calculateSizeSimilarity;
    private calculateFeaturesSimilarity;
    private getInteractionWeight;
    getRecommendationsWithDetails(userId: string | Types.ObjectId, options?: RecommendationOptions): Promise<any[]>;
}
