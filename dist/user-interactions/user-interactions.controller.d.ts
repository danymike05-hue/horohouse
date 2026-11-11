import { UserInteractionsService, CreateInteractionDto, InteractionQuery } from './user-interactions.service';
import { InteractionSource } from './schemas/user-interaction.schema';
import { User } from '../users/schemas/user.schema';
export declare class UserInteractionsController {
    private readonly userInteractionsService;
    private readonly logger;
    constructor(userInteractionsService: UserInteractionsService);
    trackInteraction(createInteractionDto: CreateInteractionDto, req: {
        user: User;
    }): Promise<{
        success: boolean;
        message: string;
        data: import("./schemas/user-interaction.schema").UserInteraction;
    }>;
    trackBulkInteractions(body: {
        interactions: CreateInteractionDto[];
    }, req: {
        user: User;
    }): Promise<{
        success: boolean;
        message: string;
        data: import("./schemas/user-interaction.schema").UserInteraction[];
    }>;
    getUserInteractions(query: InteractionQuery, req: {
        user: User;
    }): Promise<{
        success: boolean;
        data: import("./schemas/user-interaction.schema").UserInteraction[];
        count: number;
    }>;
    getRecommendationProfile(req: {
        user: User;
    }): Promise<{
        success: boolean;
        data: import("./user-interactions.service").RecommendationProfile;
    }>;
    getSimilarUsers(limit: string, req: {
        user: User;
    }): Promise<{
        success: boolean;
        data: import("mongoose").Types.ObjectId[];
        count: number;
    }>;
    getRecommendedProperties(limit: string, excludePropertyIds: string, req: {
        user: User;
    }): Promise<{
        success: boolean;
        data: import("mongoose").Types.ObjectId[];
        count: number;
    }>;
    trackPropertyView(body: {
        propertyId: string;
        source?: InteractionSource;
        metadata?: any;
        propertyDetails?: {
            city?: string;
            propertyType?: string;
            price?: number;
            listingType?: string;
            bedrooms?: number;
            bathrooms?: number;
            location?: {
                type: 'Point';
                coordinates: [number, number];
            };
        };
    }, req: {
        user: User;
    }): Promise<{
        success: boolean;
        message: string;
        data: import("./schemas/user-interaction.schema").UserInteraction;
    }>;
    trackPropertyFavorite(body: {
        propertyId: string;
        source?: InteractionSource;
        metadata?: any;
        propertyDetails?: {
            city?: string;
            propertyType?: string;
            price?: number;
            listingType?: string;
            bedrooms?: number;
            bathrooms?: number;
        };
    }, req: {
        user: User;
    }): Promise<{
        success: boolean;
        message: string;
        data: import("./schemas/user-interaction.schema").UserInteraction;
    }>;
    trackPropertyInquiry(body: {
        propertyId: string;
        agentId?: string;
        source?: InteractionSource;
        metadata?: any;
        propertyDetails?: {
            city?: string;
            propertyType?: string;
            price?: number;
            listingType?: string;
            bedrooms?: number;
            bathrooms?: number;
        };
    }, req: {
        user: User;
    }): Promise<{
        success: boolean;
        message: string;
        data: import("./schemas/user-interaction.schema").UserInteraction;
    }>;
    trackSearch(body: {
        searchQuery?: string;
        searchFilters?: any;
        resultsCount?: number;
        source?: InteractionSource;
        metadata?: any;
        userLocation?: {
            type: 'Point';
            coordinates: [number, number];
        };
        city?: string;
    }, req: {
        user: User;
    }): Promise<{
        success: boolean;
        message: string;
        data: import("./schemas/user-interaction.schema").UserInteraction;
    }>;
    trackRecommendationClick(body: {
        propertyId: string;
        recommendationScore?: number;
        recommendationReason?: string;
        metadata?: any;
        propertyDetails?: {
            city?: string;
            propertyType?: string;
            price?: number;
            listingType?: string;
            bedrooms?: number;
            bathrooms?: number;
        };
    }, req: {
        user: User;
    }): Promise<{
        success: boolean;
        message: string;
        data: import("./schemas/user-interaction.schema").UserInteraction;
    }>;
    getAnalyticsSummary(req: {
        user: User;
    }): Promise<{
        success: boolean;
        data: {
            totalInteractions: number;
            propertyViews: number;
            favorites: number;
            inquiries: number;
            searches: number;
            topCities: {
                city: string;
                score: number;
            }[];
            topPropertyTypes: {
                type: string;
                score: number;
            }[];
            priceRange: {
                min: number;
                max: number;
                confidence: number;
            };
            interactionPatterns: {
                viewToFavoriteRatio: number;
                viewToInquiryRatio: number;
                averageTimeOnPage: number;
                peakActivityHours: number[];
            };
        };
    }>;
}
