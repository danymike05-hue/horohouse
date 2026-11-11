import { Types } from 'mongoose';
import { ActivityType, SearchFilters, DeviceInfo } from '../schemas/history.schema';
declare class LocationDto {
    type: 'Point';
    coordinates: [number, number];
}
export declare class LogActivityDto {
    userId?: Types.ObjectId;
    activityType: ActivityType;
    propertyId?: Types.ObjectId;
    agentId?: Types.ObjectId;
    searchQuery?: string;
    searchFilters?: SearchFilters;
    resultsCount?: number;
    resultsClicked?: number;
    userLocation?: LocationDto;
    searchLocation?: LocationDto;
    city?: string;
    country?: string;
    sessionId?: string;
    deviceInfo?: DeviceInfo;
    ipAddress?: string;
    referrer?: string;
    source?: string;
    viewDuration?: number;
    viewedImages?: string[];
    scrollDepth?: number;
    contactedAgent?: boolean;
    metadata?: Record<string, any>;
    tags?: string[];
    inquiryMessage?: string;
    inquiryPhone?: string;
    inquiryEmail?: string;
    anonymousId?: string;
}
export {};
