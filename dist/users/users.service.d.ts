import { Model } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { User, UserDocument, UserRole, PayoutMethod, HostPayoutRecord } from './schemas/user.schema';
import { CreateUserDto, UpdateUserDto, UpdatePreferencesDto, CreateTenantDto, UpdateTenantDto } from './dto';
import { PropertyDocument } from 'src/properties/schemas/property.schema';
import { ReviewsService } from 'src/reviews/reviews.service';
export declare class UsersService {
    private userModel;
    private propertyModel;
    private configService;
    private reviewsService;
    private readonly logger;
    constructor(userModel: Model<UserDocument>, propertyModel: Model<PropertyDocument>, configService: ConfigService, reviewsService: ReviewsService);
    create(createUserDto: CreateUserDto): Promise<User>;
    findAll(page?: number, limit?: number, role?: UserRole, isActive?: boolean, search?: string): Promise<{
        users: User[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    }>;
    findOne(id: string): Promise<User>;
    findPublicProfile(id: string): Promise<Partial<User>>;
    findByFirebaseUid(firebaseUid: string): Promise<User | null>;
    findByEmail(email: string): Promise<User | null>;
    findByPhoneNumber(phoneNumber: string): Promise<User | null>;
    update(id: string, updateUserDto: UpdateUserDto): Promise<User>;
    setRole(id: string, newRole: UserRole): Promise<User>;
    updatePreferences(id: string, preferences: UpdatePreferencesDto): Promise<User>;
    uploadProfilePicture(userId: string, file: {
        buffer: Buffer;
    }): Promise<User>;
    addToFavorites(userId: string, propertyId: string): Promise<User>;
    removeFromFavorites(userId: string, propertyId: string): Promise<User>;
    addToRecentlyViewed(userId: string, propertyId: string): Promise<void>;
    getRecentlyViewed(userId: string, limit?: number): Promise<any[]>;
    getViewedPropertiesWithPagination(userId: string, options?: {
        page?: number;
        limit?: number;
        sortBy?: string;
        sortOrder?: 'asc' | 'desc';
    }): Promise<{
        properties: any[];
        total: number;
        page: number;
        totalPages: number;
        lastViewed?: Date;
    }>;
    clearViewingHistory(userId: string): Promise<{
        message: string;
    }>;
    removeFromViewingHistory(userId: string, propertyId: string): Promise<{
        message: string;
    }>;
    addSearchToHistory(userId: string, searchData: any): Promise<void>;
    getSearchHistory(userId: string, limit?: number): Promise<any[]>;
    remove(id: string): Promise<void>;
    getStats(): Promise<any>;
    getAgents(page?: number, limit?: number): Promise<any>;
    getLandlords(page?: number, limit?: number): Promise<any>;
    getAgentById(id: string): Promise<any>;
    getLandlordById(id: string): Promise<any>;
    getLandlordStats(id: string): Promise<any>;
    getAgentStats(id: string): Promise<any>;
    getAgentProperties(agentId: string, options?: {
        status?: string;
        page?: number;
        limit?: number;
    }): Promise<any>;
    getAgentReviews(agentId: string, options?: {
        page?: number;
        limit?: number;
    }): Promise<any>;
    private getAgentReviewStats;
    private getAgentPropertyStats;
    private calculateYearsOfExperience;
    private calculateSuccessRate;
    private calculateAwards;
    private getAgentSpecialties;
    private getAgentServiceAreas;
    private mapAvailabilityToStatus;
    private capitalizePropertyType;
    updateOnboardingPreferences(userId: string, preferences: {
        propertyPreferences?: any;
        agentPreferences?: any;
        onboardingCompleted?: boolean;
    }): Promise<User>;
    private hasLeaseOverlap;
    private sanitizeTenantResponse;
    addTenant(landlordId: string, tenantData: CreateTenantDto): Promise<any>;
    updateTenant(landlordId: string, tenantId: string, tenantData: UpdateTenantDto): Promise<any>;
    removeTenant(landlordId: string, tenantId: string): Promise<any>;
    getMyLeaseInfo(userId: string): Promise<any>;
    getHosts(page?: number, limit?: number): Promise<any>;
    getHostById(id: string): Promise<any>;
    getHostStats(id: string): Promise<any>;
    updateHostProfile(id: string, updates: {
        governmentIdBuffer?: Buffer;
        instantBookEnabled?: boolean;
        minNightsDefault?: number;
        maxNightsDefault?: number;
        advanceNoticeHours?: number;
        bookingWindowMonths?: number;
        petsAllowedDefault?: boolean;
        smokingAllowedDefault?: boolean;
        eventsAllowedDefault?: boolean;
        checkInTimeDefault?: string;
        checkOutTimeDefault?: string;
        addPayoutAccount?: {
            method: PayoutMethod;
            accountIdentifier: string;
            providerName?: string;
            isDefault?: boolean;
            currency?: string;
        };
        removePayoutAccountIdentifier?: string;
        addCoHostId?: string;
        removeCoHostId?: string;
        hostBio?: string;
        hostLanguages?: string[];
        operatingCity?: string;
    }): Promise<any>;
    verifyHost(id: string, decision: 'approve' | 'reject', rejectionReason?: string): Promise<any>;
    recalculateSuperhostStatus(id: string): Promise<{
        isSuperhost: boolean;
        reason?: string;
        superhostSince?: Date;
    }>;
    recordHostPayout(id: string, record: Omit<HostPayoutRecord, '_id'>): Promise<any>;
    private getHostListingStats;
}
