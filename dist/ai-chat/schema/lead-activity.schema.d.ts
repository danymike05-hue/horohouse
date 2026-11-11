import { Document, Types } from 'mongoose';
export type LeadActivityDocument = LeadActivity & Document;
export declare class LeadActivity {
    userId: Types.ObjectId;
    sessionId: string;
    activityType: string;
    description?: string;
    metadata?: {
        propertyId?: string;
        propertyType?: string;
        city?: string;
        price?: number;
        filters?: Record<string, any>;
        message?: string;
        duration?: number;
        confidence?: number;
        [key: string]: any;
    };
    impactScore?: number;
    timestamp: Date;
    source?: string;
}
export declare const LeadActivitySchema: import("mongoose").Schema<LeadActivity, import("mongoose").Model<LeadActivity, any, any, any, Document<unknown, any, LeadActivity, any, {}> & LeadActivity & {
    _id: Types.ObjectId;
} & {
    __v: number;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, LeadActivity, Document<unknown, {}, import("mongoose").FlatRecord<LeadActivity>, {}, import("mongoose").DefaultSchemaOptions> & import("mongoose").FlatRecord<LeadActivity> & {
    _id: Types.ObjectId;
} & {
    __v: number;
}>;
export type ChatAnalyticsDocument = ChatAnalytics & Document;
export declare class ChatAnalytics {
    date: Date;
    period: string;
    totalSessions: number;
    totalMessages: number;
    uniqueUsers: number;
    guestSessions: number;
    authenticatedSessions: number;
    leadDistribution: {
        hot?: number;
        warm?: number;
        cold?: number;
    };
    conversions: number;
    conversionTypes?: Record<string, number>;
    avgMessagesPerSession?: number;
    avgSessionDuration?: number;
    avgResponseTime?: number;
    topCities?: Record<string, number>;
    topPropertyTypes?: Record<string, number>;
    priceRanges?: Record<string, number>;
    topKeywords: string[];
    propertiesShown: number;
    propertiesViewed: number;
    propertiesSaved: number;
    engagementRate?: number;
    bounceRate?: number;
    languageDistribution?: Record<string, number>;
    deviceDistribution?: Record<string, number>;
    customMetrics?: Record<string, any>;
}
export declare const ChatAnalyticsSchema: import("mongoose").Schema<ChatAnalytics, import("mongoose").Model<ChatAnalytics, any, any, any, Document<unknown, any, ChatAnalytics, any, {}> & ChatAnalytics & {
    _id: Types.ObjectId;
} & {
    __v: number;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, ChatAnalytics, Document<unknown, {}, import("mongoose").FlatRecord<ChatAnalytics>, {}, import("mongoose").DefaultSchemaOptions> & import("mongoose").FlatRecord<ChatAnalytics> & {
    _id: Types.ObjectId;
} & {
    __v: number;
}>;
export type ConversationSummaryDocument = ConversationSummary & Document;
export declare class ConversationSummary {
    sessionId: string;
    userId?: Types.ObjectId;
    summary: string;
    keyPoints: string[];
    userIntent?: {
        primary?: string;
        secondary?: string[];
        confidence?: number;
    };
    requirements?: {
        propertyType?: string;
        location?: string;
        budget?: {
            min?: number;
            max?: number;
        };
        bedrooms?: number;
        bathrooms?: number;
        mustHaves?: string[];
        niceToHaves?: string[];
    };
    userCategory: string;
    intentClarityScore?: number;
    recommendedAction?: string;
    tags: string[];
    generationType: string;
    lastUpdated: Date;
    sentiment?: {
        overall?: string;
        confidence?: number;
        keywords?: string[];
    };
}
export declare const ConversationSummarySchema: import("mongoose").Schema<ConversationSummary, import("mongoose").Model<ConversationSummary, any, any, any, Document<unknown, any, ConversationSummary, any, {}> & ConversationSummary & {
    _id: Types.ObjectId;
} & {
    __v: number;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, ConversationSummary, Document<unknown, {}, import("mongoose").FlatRecord<ConversationSummary>, {}, import("mongoose").DefaultSchemaOptions> & import("mongoose").FlatRecord<ConversationSummary> & {
    _id: Types.ObjectId;
} & {
    __v: number;
}>;
export type SavedSearchDocument = SavedSearch & Document;
export declare class SavedSearch {
    userId: Types.ObjectId;
    sessionId?: string;
    name: string;
    filters: {
        propertyType?: string;
        listingType?: string;
        city?: string;
        neighborhood?: string;
        minPrice?: number;
        maxPrice?: number;
        bedrooms?: number;
        bathrooms?: number;
        minArea?: number;
        maxArea?: number;
        furnished?: boolean;
        amenities?: string[];
        [key: string]: any;
    };
    isActive: boolean;
    notificationsEnabled: boolean;
    notificationFrequency: string;
    lastNotifiedAt?: Date;
    matchCount: number;
    lastMatchAt?: Date;
    source: string;
    metadata?: {
        originalQuery?: string;
        confidence?: number;
        [key: string]: any;
    };
}
export declare const SavedSearchSchema: import("mongoose").Schema<SavedSearch, import("mongoose").Model<SavedSearch, any, any, any, Document<unknown, any, SavedSearch, any, {}> & SavedSearch & {
    _id: Types.ObjectId;
} & {
    __v: number;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, SavedSearch, Document<unknown, {}, import("mongoose").FlatRecord<SavedSearch>, {}, import("mongoose").DefaultSchemaOptions> & import("mongoose").FlatRecord<SavedSearch> & {
    _id: Types.ObjectId;
} & {
    __v: number;
}>;
export declare const schemas: ({
    name: string;
    schema: import("mongoose").Schema<LeadActivity, import("mongoose").Model<LeadActivity, any, any, any, Document<unknown, any, LeadActivity, any, {}> & LeadActivity & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, LeadActivity, Document<unknown, {}, import("mongoose").FlatRecord<LeadActivity>, {}, import("mongoose").DefaultSchemaOptions> & import("mongoose").FlatRecord<LeadActivity> & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }>;
} | {
    name: string;
    schema: import("mongoose").Schema<ChatAnalytics, import("mongoose").Model<ChatAnalytics, any, any, any, Document<unknown, any, ChatAnalytics, any, {}> & ChatAnalytics & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, ChatAnalytics, Document<unknown, {}, import("mongoose").FlatRecord<ChatAnalytics>, {}, import("mongoose").DefaultSchemaOptions> & import("mongoose").FlatRecord<ChatAnalytics> & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }>;
} | {
    name: string;
    schema: import("mongoose").Schema<ConversationSummary, import("mongoose").Model<ConversationSummary, any, any, any, Document<unknown, any, ConversationSummary, any, {}> & ConversationSummary & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, ConversationSummary, Document<unknown, {}, import("mongoose").FlatRecord<ConversationSummary>, {}, import("mongoose").DefaultSchemaOptions> & import("mongoose").FlatRecord<ConversationSummary> & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }>;
} | {
    name: string;
    schema: import("mongoose").Schema<SavedSearch, import("mongoose").Model<SavedSearch, any, any, any, Document<unknown, any, SavedSearch, any, {}> & SavedSearch & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, SavedSearch, Document<unknown, {}, import("mongoose").FlatRecord<SavedSearch>, {}, import("mongoose").DefaultSchemaOptions> & import("mongoose").FlatRecord<SavedSearch> & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }>;
})[];
