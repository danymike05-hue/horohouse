import { Document, Types } from 'mongoose';
export type UserInteractionDocument = UserInteraction & Document;
export declare enum InteractionType {
    PROPERTY_VIEW = "property_view",
    PROPERTY_FAVORITE = "property_favorite",
    PROPERTY_UNFAVORITE = "property_unfavorite",
    PROPERTY_SHARE = "property_share",
    PROPERTY_INQUIRY = "property_inquiry",
    SEARCH = "search",
    FILTER_APPLY = "filter_apply",
    PROPERTY_COMPARE = "property_compare",
    MAP_VIEW = "map_view",
    LIST_VIEW = "list_view",
    SIMILAR_PROPERTIES_CLICK = "similar_properties_click",
    RECOMMENDATION_CLICK = "recommendation_click",
    RECOMMENDATION_DISMISS = "recommendation_dismiss",
    CONTACT_AGENT = "contact_agent",
    SCHEDULE_VIEWING = "schedule_viewing"
}
export declare enum InteractionSource {
    SEARCH_RESULTS = "search_results",
    RECOMMENDATIONS = "recommendations",
    SIMILAR_PROPERTIES = "similar_properties",
    FAVORITES = "favorites",
    DIRECT_LINK = "direct_link",
    MAP = "map",
    DASHBOARD = "dashboard",
    NOTIFICATION = "notification"
}
export interface InteractionMetadata {
    sessionId?: string;
    userAgent?: string;
    ipAddress?: string;
    referrer?: string;
    deviceType?: string;
    browser?: string;
    os?: string;
    screenResolution?: string;
    timeOnPage?: number;
    scrollDepth?: number;
    searchFilters?: Record<string, any>;
    searchQuery?: string;
    resultsCount?: number;
    propertyPosition?: number;
    recommendationScore?: number;
    recommendationReason?: string;
    context?: Record<string, any>;
    radius?: number;
    rating?: number;
}
export declare class UserInteraction {
    userId: Types.ObjectId;
    interactionType: InteractionType;
    propertyId?: Types.ObjectId;
    source?: InteractionSource;
    metadata: InteractionMetadata;
    agentId?: Types.ObjectId;
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
    weight: number;
    expiresAt?: Date;
    isProcessed: boolean;
    processedAt?: Date;
    batchId?: string;
    createdAt: Date;
    updatedAt: Date;
}
export declare const UserInteractionSchema: import("mongoose").Schema<UserInteraction, import("mongoose").Model<UserInteraction, any, any, any, Document<unknown, any, UserInteraction, any, {}> & UserInteraction & {
    _id: Types.ObjectId;
} & {
    __v: number;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, UserInteraction, Document<unknown, {}, import("mongoose").FlatRecord<UserInteraction>, {}, import("mongoose").DefaultSchemaOptions> & import("mongoose").FlatRecord<UserInteraction> & {
    _id: Types.ObjectId;
} & {
    __v: number;
}>;
