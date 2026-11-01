import { Document, Types } from 'mongoose';
export type HistoryDocument = History & Document;
export declare enum ActivityType {
    PROPERTY_VIEW = "property_view",
    SEARCH = "search",
    FAVORITE_ADD = "favorite_add",
    FAVORITE_REMOVE = "favorite_remove",
    PROPERTY_INQUIRY = "property_inquiry",
    PROFILE_UPDATE = "profile_update",
    LOGIN = "login",
    LOGOUT = "logout",
    PROPERTY_SHARE = "property_share",
    AGENT_CONTACT = "agent_contact",
    PROPERTY_FAVORITE = "property_favorite",
    PROPERTY_SEARCH = "property_search"
}
export interface SearchFilters {
    minPrice?: number;
    maxPrice?: number;
    propertyType?: string;
    listingType?: string;
    city?: string;
    bedrooms?: number;
    bathrooms?: number;
    amenities?: string[];
    radius?: number;
    latitude?: number;
    longitude?: number;
}
export interface DeviceInfo {
    userAgent?: string;
    platform?: string;
    browser?: string;
    isMobile?: boolean;
    screenResolution?: string;
}
export declare class History {
    userId?: Types.ObjectId;
    activityType: ActivityType;
    propertyId?: Types.ObjectId;
    agentId?: Types.ObjectId;
    searchQuery?: string;
    searchFilters?: SearchFilters;
    resultsCount?: number;
    resultsClicked?: number;
    userLocation?: {
        type: 'Point';
        coordinates: [number, number];
    };
    searchLocation?: {
        type: 'Point';
        coordinates: [number, number];
    };
    city?: string;
    country?: string;
    sessionId?: string;
    ipAddress?: string;
    deviceInfo?: DeviceInfo;
    referrer?: string;
    source?: string;
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
    viewDuration?: number;
    viewedImages?: string[];
    scrollDepth?: number;
    contactedAgent?: boolean;
    metadata: Record<string, any>;
    tags?: string[];
    inquiryMessage?: string;
    inquiryPhone?: string;
    inquiryEmail?: string;
    anonymousId?: string;
    createdAt: Date;
    updatedAt: Date;
}
export declare const HistorySchema: import("mongoose").Schema<History, import("mongoose").Model<History, any, any, any, Document<unknown, any, History, any, {}> & History & {
    _id: Types.ObjectId;
} & {
    __v: number;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, History, Document<unknown, {}, import("mongoose").FlatRecord<History>, {}, import("mongoose").DefaultSchemaOptions> & import("mongoose").FlatRecord<History> & {
    _id: Types.ObjectId;
} & {
    __v: number;
}>;
