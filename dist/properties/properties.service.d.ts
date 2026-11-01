import { OnModuleInit } from '@nestjs/common';
import { Model, Types } from 'mongoose';
import { WatermarkService } from '../watermark/watermark.service';
import { Property, PropertyDocument, PropertyType, ApprovalStatus, ListingType, PricingUnit, CancellationPolicy } from './schemas/property.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { HistoryService } from '../history/history.service';
import { UserInteractionsService } from '../user-interactions/user-interactions.service';
import { BlockDatesDto, UnblockDatesDto, CreatePropertyDto, UpdatePropertyDto, UpdateCalendarSettingsDto, SetCalendarPricesDto, AddExternalCalendarDto } from './dto/property.dto';
export interface PropertySearchFilters {
    minPrice?: number;
    maxPrice?: number;
    propertyType?: PropertyType;
    listingType?: ListingType;
    city?: string;
    bedrooms?: number;
    bathrooms?: number;
    amenities?: string[];
    latitude?: number;
    longitude?: number;
    radius?: number;
    bounds?: {
        northeast: {
            lat: number;
            lng: number;
        };
        southwest: {
            lat: number;
            lng: number;
        };
    };
    isInstantBookable?: boolean;
    minGuests?: number;
    cancellationPolicy?: CancellationPolicy;
    pricingUnit?: PricingUnit;
    checkIn?: Date;
    checkOut?: Date;
    minArea?: number;
    maxArea?: number;
    furnished?: boolean;
    neighborhood?: string;
}
export interface PropertySearchOptions {
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    includeInactive?: boolean;
}
export declare class PropertiesService implements OnModuleInit {
    private propertyModel;
    private userModel;
    private historyService;
    private userInteractionsService;
    private watermarkService;
    private readonly logger;
    private readonly cache;
    private readonly CACHE_TTL_MS;
    private readonly POPULAR_CITIES_TTL_MS;
    private readonly FEATURED_TTL_MS;
    constructor(propertyModel: Model<PropertyDocument>, userModel: Model<UserDocument>, historyService: HistoryService, userInteractionsService: UserInteractionsService, watermarkService: WatermarkService);
    onModuleInit(): Promise<void>;
    private ensureIndexes;
    private cacheGet;
    private cacheSet;
    private cacheInvalidate;
    create(createPropertyDto: CreatePropertyDto, user: User): Promise<Property>;
    findAll(filters?: PropertySearchFilters, options?: PropertySearchOptions, user?: User): Promise<{
        properties: Property[];
        total: number;
        page: number;
        totalPages: number;
    }>;
    findNearby(latitude: number, longitude: number, radiusKm?: number, limit?: number, user?: User): Promise<Property[]>;
    findOne(id: string, user?: User): Promise<Property>;
    update(id: string, updatePropertyDto: UpdatePropertyDto, user: User): Promise<Property>;
    getAllPropertiesAdmin(filters?: {
        approvalStatus?: ApprovalStatus;
        propertyType?: PropertyType;
        listingType?: ListingType;
        city?: string;
        ownerId?: string;
        search?: string;
    }, options?: PropertySearchOptions): Promise<{
        properties: Property[];
        total: number;
        page: number;
        totalPages: number;
    }>;
    approveProperty(id: string, admin: User): Promise<Property>;
    rejectProperty(id: string, reason: string | undefined, admin: User): Promise<Property>;
    remove(id: string, user: User): Promise<void>;
    uploadImages(propertyId: string, files: {
        buffer: Buffer;
        filename?: string;
    }[], user: User): Promise<Property>;
    deleteImage(propertyId: string, imagePublicId: string, user: User): Promise<Property>;
    uploadVideos(propertyId: string, files: {
        buffer: Buffer;
        filename?: string;
    }[], user: User): Promise<Property>;
    deleteVideo(propertyId: string, videoPublicId: string, user: User): Promise<Property>;
    getMostViewed(limit?: number): Promise<Property[]>;
    getRecent(limit?: number): Promise<Property[]>;
    getFeatured(limit?: number): Promise<Property[]>;
    getPopularCities(limit?: number): Promise<Array<{
        city: string;
        count: number;
    }>>;
    getSimilarProperties(propertyId: string, limit?: number): Promise<Property[]>;
    getUserFavorites(userId: string, options?: PropertySearchOptions): Promise<{
        properties: any[];
        total: number;
        page: number;
        totalPages: number;
    }>;
    getMyProperties(filters: PropertySearchFilters | undefined, options: PropertySearchOptions | undefined, userId: string): Promise<{
        properties: Property[];
        total: number;
        page: number;
        totalPages: number;
    }>;
    geocodeAddress(address: string, city?: string, country?: string): Promise<{
        latitude: number;
        longitude: number;
    } | null>;
    searchByText(searchText: string, filters?: PropertySearchFilters, options?: PropertySearchOptions, user?: User): Promise<{
        properties: (import("mongoose").FlattenMaps<PropertyDocument> & Required<{
            _id: Types.ObjectId;
        }> & {
            __v: number;
        })[];
        total: number;
        page: number;
        totalPages: number;
    }>;
    getShortTermListings(filters?: {
        city?: string;
        minPrice?: number;
        maxPrice?: number;
        propertyType?: PropertyType;
        isInstantBookable?: boolean;
        minGuests?: number;
        cancellationPolicy?: CancellationPolicy;
        pricingUnit?: PricingUnit;
        checkIn?: Date;
        checkOut?: Date;
        latitude?: number;
        longitude?: number;
        radius?: number;
    }, options?: {
        page?: number;
        limit?: number;
        sortBy?: string;
        sortOrder?: 'asc' | 'desc';
    }): Promise<{
        properties: Property[];
        total: number;
        page: number;
        totalPages: number;
    }>;
    blockDates(propertyId: string, dto: BlockDatesDto, user: User): Promise<Property>;
    unblockDates(propertyId: string, dto: UnblockDatesDto, user: User): Promise<Property>;
    getBlockedDates(propertyId: string): Promise<{
        unavailableDates: any[];
    }>;
    getCalendarSettings(propertyId: string, user: User): Promise<{
        basePrice: number;
        weekendPrice: number | null;
        priceOverrides: Record<string, number>;
        minNights: number;
        maxNights: number;
        noticeDays: number;
        windowMonths: number;
        externalCalendars: {
            id: string;
            name: string;
            url: string;
            lastSyncedAt?: Date | null;
        }[];
        exportUrl: string;
    }>;
    updateCalendarSettings(propertyId: string, dto: UpdateCalendarSettingsDto, user: User): Promise<{
        basePrice: number;
        weekendPrice: number | null;
        priceOverrides: Record<string, number>;
        minNights: number;
        maxNights: number;
        noticeDays: number;
        windowMonths: number;
        externalCalendars: {
            id: string;
            name: string;
            url: string;
            lastSyncedAt?: Date | null;
        }[];
        exportUrl: string;
    }>;
    setCalendarPrices(propertyId: string, dto: SetCalendarPricesDto, user: User): Promise<{
        priceOverrides: any;
    }>;
    addExternalCalendar(propertyId: string, dto: AddExternalCalendarDto, user: User): Promise<{
        id: string;
        name: string;
        url: string;
        lastSyncedAt: Date;
    }>;
    removeExternalCalendar(propertyId: string, calendarId: string, user: User): Promise<{
        success: boolean;
    }>;
    getShortTermById(propertyId: string): Promise<any>;
    trackTourView(propertyId: string): Promise<void>;
    private listingProjection;
    private buildBaseListQuery;
    private buildFilterQuery;
    private fireAnalytics;
    private updateRecentlyViewed;
    private getBookedPropertyIds;
    private isValidCoordinate;
    private generateSlug;
    private generateKeywords;
    validateShortTermFields(dto: any): void;
    private assertCanManage;
}
