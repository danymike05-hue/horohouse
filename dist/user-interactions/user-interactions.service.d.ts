import { Model, Types } from 'mongoose';
import { UserInteraction, UserInteractionDocument } from './schemas/user-interaction.schema';
import { InteractionType, InteractionSource, InteractionMetadata } from './schemas/user-interaction.schema';
export interface CreateInteractionDto {
    userId: string | Types.ObjectId;
    interactionType: InteractionType;
    propertyId?: string | Types.ObjectId;
    source?: InteractionSource;
    metadata?: Partial<InteractionMetadata>;
    agentId?: string | Types.ObjectId;
    location?: {
        type: 'Point';
        coordinates: [number, number];
    };
    city?: string;
    neighborhood?: string;
    propertyType?: string;
    price?: number;
    listingType?: string;
    bedrooms?: number;
    bathrooms?: number;
    weight?: number;
}
export interface InteractionQuery {
    userId?: string | Types.ObjectId;
    interactionTypes?: InteractionType[];
    propertyId?: string | Types.ObjectId;
    source?: InteractionSource;
    city?: string;
    propertyType?: string;
    priceRange?: {
        min?: number;
        max?: number;
    };
    bedrooms?: number;
    bathrooms?: number;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}
export interface RecommendationProfile {
    userId: Types.ObjectId;
    preferredCities: Array<{
        city: string;
        score: number;
    }>;
    preferredPropertyTypes: Array<{
        type: string;
        score: number;
    }>;
    priceRange: {
        min: number;
        max: number;
        confidence: number;
    };
    preferredBedrooms: Array<{
        count: number;
        score: number;
    }>;
    preferredAmenities: Array<{
        amenity: string;
        score: number;
    }>;
    interactionPatterns: {
        viewToFavoriteRatio: number;
        viewToInquiryRatio: number;
        averageTimeOnPage: number;
        peakActivityHours: number[];
    };
    lastUpdated: Date;
}
export declare class UserInteractionsService {
    private userInteractionModel;
    private readonly logger;
    constructor(userInteractionModel: Model<UserInteractionDocument>);
    trackInteraction(createInteractionDto: CreateInteractionDto): Promise<UserInteraction>;
    trackBulkInteractions(interactions: CreateInteractionDto[]): Promise<UserInteraction[]>;
    getUserInteractions(query: InteractionQuery): Promise<UserInteraction[]>;
    getUserRecommendationProfile(userId: string | Types.ObjectId): Promise<RecommendationProfile>;
    getSimilarUsers(userId: string | Types.ObjectId, limit?: number): Promise<Types.ObjectId[]>;
    getRecommendedProperties(userId: string | Types.ObjectId, limit?: number, excludePropertyIds?: string[]): Promise<Types.ObjectId[]>;
    markInteractionsAsProcessed(interactionIds: Types.ObjectId[], batchId?: string): Promise<void>;
    cleanupOldInteractions(daysOld?: number): Promise<void>;
    private calculateInteractionWeight;
    private calculateCityPreferences;
    private calculatePropertyTypePreferences;
    private calculatePriceRangePreference;
    private calculateBedroomPreferences;
    private calculateAmenityPreferences;
    private calculateInteractionPatterns;
}
