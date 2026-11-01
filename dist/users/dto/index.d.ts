import { UserRole, PayoutMethod } from '../schemas/user.schema';
export declare class LocationDto {
    type?: 'Point';
    coordinates: [number, number];
}
export declare class GetViewedPropertiesDto {
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}
export declare class UserPreferencesDto {
    minPrice?: number;
    maxPrice?: number;
    currency?: string;
    propertyTypes?: string[];
    cities?: string[];
    amenities?: string[];
    bedrooms?: number[];
    bathrooms?: number[];
    maxRadius?: number;
    minArea?: number;
    maxArea?: number;
    preferredLocation?: LocationDto;
}
export declare class CreateUserDto {
    name: string;
    email?: string;
    phoneNumber: string;
    role?: UserRole;
    firebaseUid: string;
    googleId?: string;
    licenseNumber?: string;
    agency?: string;
    bio?: string;
    website?: string;
    address?: string;
    city?: string;
    country?: string;
    location?: LocationDto;
    preferences?: UserPreferencesDto;
    emailNotifications?: boolean;
    smsNotifications?: boolean;
    pushNotifications?: boolean;
}
declare const UpdateUserDto_base: import("@nestjs/common").Type<Partial<CreateUserDto>>;
export declare class UpdateUserDto extends UpdateUserDto_base {
    isActive?: boolean;
    emailVerified?: boolean;
    phoneVerified?: boolean;
    profilePicture?: string;
    propertiesListed?: number;
    propertiesSold?: number;
}
declare const UpdateOwnProfileDto_base: import("@nestjs/common").Type<Omit<UpdateUserDto, "role" | "isActive" | "emailVerified" | "phoneVerified" | "propertiesListed" | "propertiesSold">>;
export declare class UpdateOwnProfileDto extends UpdateOwnProfileDto_base {
}
export declare class UpdatePreferencesDto extends UserPreferencesDto {
}
export declare class SearchQueryDto {
    query: string;
    filters: any;
    location?: LocationDto;
    resultsCount: number;
}
export declare class GetUsersQueryDto {
    page?: number;
    limit?: number;
    role?: UserRole;
    isActive?: boolean;
    search?: string;
}
export declare class UserResponseDto {
    id: string;
    name: string;
    email?: string;
    phoneNumber: string;
    role: UserRole;
    profilePicture?: string;
    isActive: boolean;
    emailVerified: boolean;
    phoneVerified: boolean;
    preferences: UserPreferencesDto;
    createdAt: Date;
    updatedAt: Date;
    licenseNumber?: string;
    agency?: string;
    bio?: string;
    propertiesListed?: number;
    propertiesSold?: number;
    city?: string;
    country?: string;
}
export declare class PaginatedUsersResponseDto {
    users: UserResponseDto[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}
export declare class AgentStatsDto {
    totalProperties: number;
    activeProperties: number;
}
export declare class AgentResponseDto extends UserResponseDto {
    stats: AgentStatsDto;
}
export declare class PaginatedAgentsResponseDto {
    agents: AgentResponseDto[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}
export declare class UserStatsDto {
    total: number;
    active: number;
    agents: number;
    landlords: number;
    hosts: number;
    students: number;
    guests: number;
    superhosts: number;
    pendingHostVerifications: number;
    verified: number;
    recent: number;
    byRole: Record<string, number>;
}
export declare class CreateTenantDto {
    tenantName: string;
    tenantEmail?: string;
    tenantPhone?: string;
    propertyId: string;
    leaseStart: string;
    leaseEnd: string;
    monthlyRent: number;
    depositAmount?: number;
    status?: 'active' | 'ended' | 'pending';
    notes?: string;
}
export declare class UpdateTenantDto {
    tenantName?: string;
    tenantEmail?: string;
    tenantPhone?: string;
    propertyId?: string;
    leaseStart?: string;
    leaseEnd?: string;
    monthlyRent?: number;
    depositAmount?: number;
    status?: 'active' | 'ended' | 'pending';
    notes?: string;
}
export declare class SetRoleDto {
    role: UserRole;
}
export declare class PayoutAccountDto {
    method: PayoutMethod;
    accountIdentifier: string;
    providerName?: string;
    isDefault?: boolean;
    currency?: string;
}
export declare class UpdateHostProfileDto {
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
    addPayoutAccount?: PayoutAccountDto;
    removePayoutAccountIdentifier?: string;
    addCoHostId?: string;
    removeCoHostId?: string;
    hostBio?: string;
    hostLanguages?: string[];
    operatingCity?: string;
}
export declare class VerifyHostDto {
    decision: 'approve' | 'reject';
    rejectionReason?: string;
}
export declare class RecordHostPayoutDto {
    amount: number;
    currency: string;
    method: PayoutMethod;
    reference?: string;
    status: 'pending' | 'processing' | 'paid' | 'failed';
    initiatedAt: Date;
    completedAt?: Date;
    failureReason?: string;
}
export {};
