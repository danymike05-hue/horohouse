import { Document, Types } from 'mongoose';
export type ChatSessionDocument = ChatSession & Document;
export declare class ChatMessage {
    role: string;
    content: string;
    timestamp: Date;
    properties?: any[];
    filters?: Record<string, any>;
    confidence?: number;
    method?: string;
}
export declare const ChatMessageSchema: import("mongoose").Schema<ChatMessage, import("mongoose").Model<ChatMessage, any, any, any, Document<unknown, any, ChatMessage, any, {}> & ChatMessage & {
    _id: Types.ObjectId;
} & {
    __v: number;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, ChatMessage, Document<unknown, {}, import("mongoose").FlatRecord<ChatMessage>, {}, import("mongoose").DefaultSchemaOptions> & import("mongoose").FlatRecord<ChatMessage> & {
    _id: Types.ObjectId;
} & {
    __v: number;
}>;
export declare class LeadScore {
    score: number;
    classification: string;
    priority: string;
    signals: string[];
    nextAction?: string;
    calculatedAt: Date;
    history?: Array<{
        score: number;
        classification: string;
        timestamp: Date;
    }>;
}
export declare const LeadScoreSchema: import("mongoose").Schema<LeadScore, import("mongoose").Model<LeadScore, any, any, any, Document<unknown, any, LeadScore, any, {}> & LeadScore & {
    _id: Types.ObjectId;
} & {
    __v: number;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, LeadScore, Document<unknown, {}, import("mongoose").FlatRecord<LeadScore>, {}, import("mongoose").DefaultSchemaOptions> & import("mongoose").FlatRecord<LeadScore> & {
    _id: Types.ObjectId;
} & {
    __v: number;
}>;
export declare class PropertySearchFilters {
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
    status?: string;
    additional?: Record<string, any>;
}
export declare const PropertySearchFiltersSchema: import("mongoose").Schema<PropertySearchFilters, import("mongoose").Model<PropertySearchFilters, any, any, any, Document<unknown, any, PropertySearchFilters, any, {}> & PropertySearchFilters & {
    _id: Types.ObjectId;
} & {
    __v: number;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, PropertySearchFilters, Document<unknown, {}, import("mongoose").FlatRecord<PropertySearchFilters>, {}, import("mongoose").DefaultSchemaOptions> & import("mongoose").FlatRecord<PropertySearchFilters> & {
    _id: Types.ObjectId;
} & {
    __v: number;
}>;
export declare class SessionMetadata {
    userAgent?: string;
    ipAddress?: string;
    device?: string;
    platform?: string;
    language?: string;
    referrer?: string;
    location?: {
        country?: string;
        city?: string;
        timezone?: string;
    };
}
export declare const SessionMetadataSchema: import("mongoose").Schema<SessionMetadata, import("mongoose").Model<SessionMetadata, any, any, any, Document<unknown, any, SessionMetadata, any, {}> & SessionMetadata & {
    _id: Types.ObjectId;
} & {
    __v: number;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, SessionMetadata, Document<unknown, {}, import("mongoose").FlatRecord<SessionMetadata>, {}, import("mongoose").DefaultSchemaOptions> & import("mongoose").FlatRecord<SessionMetadata> & {
    _id: Types.ObjectId;
} & {
    __v: number;
}>;
export declare class ConversationContext {
    primaryIntent?: string;
    topicsDiscussed: string[];
    propertiesViewed: string[];
    propertiesSaved: string[];
    questionsAsked: number;
    refinements: number;
    mentionedBudget: boolean;
    mentionedTimeframe: boolean;
    askedForViewing: boolean;
    askedForAgent: boolean;
    preferredLanguage?: string;
    userPreferences?: Record<string, any>;
}
export declare const ConversationContextSchema: import("mongoose").Schema<ConversationContext, import("mongoose").Model<ConversationContext, any, any, any, Document<unknown, any, ConversationContext, any, {}> & ConversationContext & {
    _id: Types.ObjectId;
} & {
    __v: number;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, ConversationContext, Document<unknown, {}, import("mongoose").FlatRecord<ConversationContext>, {}, import("mongoose").DefaultSchemaOptions> & import("mongoose").FlatRecord<ConversationContext> & {
    _id: Types.ObjectId;
} & {
    __v: number;
}>;
export declare class ChatSession {
    sessionId: string;
    userId?: Types.ObjectId;
    userType: string;
    messages: ChatMessage[];
    currentFilters?: PropertySearchFilters;
    leadScore?: LeadScore;
    context: ConversationContext;
    metadata?: SessionMetadata;
    status: string;
    lastActiveAt: Date;
    convertedAt?: Date;
    conversionType?: string;
    messageCount: number;
    propertiesShown: number;
    isTestSession: boolean;
    analytics?: {
        avgResponseTime?: number;
        totalDuration?: number;
        bounceRate?: number;
        engagementScore?: number;
    };
    tags: string[];
    notes?: string;
    expiresAt?: Date;
}
export declare const ChatSessionSchema: import("mongoose").Schema<ChatSession, import("mongoose").Model<ChatSession, any, any, any, Document<unknown, any, ChatSession, any, {}> & ChatSession & {
    _id: Types.ObjectId;
} & {
    __v: number;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, ChatSession, Document<unknown, {}, import("mongoose").FlatRecord<ChatSession>, {}, import("mongoose").DefaultSchemaOptions> & import("mongoose").FlatRecord<ChatSession> & {
    _id: Types.ObjectId;
} & {
    __v: number;
}>;
