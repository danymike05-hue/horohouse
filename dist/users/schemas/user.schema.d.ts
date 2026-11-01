import { Document, Types } from 'mongoose';
export type UserDocument = User & Document;
export declare enum UserRole {
    ADMIN = "admin",
    AGENT = "agent",
    LANDLORD = "landlord",
    HOST = "host",
    REGISTERED_USER = "registered_user",
    GUEST = "guest",
    STUDENT = "student"
}
export declare enum OnboardingStatus {
    NOT_STARTED = "not_started",
    ROLE_SELECTED = "role_selected",
    PHONE_PROVIDED = "phone_provided",
    COMPLETED = "completed"
}
export declare enum HostVerificationStatus {
    UNVERIFIED = "unverified",
    PENDING = "pending",
    VERIFIED = "verified",
    REJECTED = "rejected"
}
export declare enum PayoutMethod {
    MOBILE_MONEY = "mobile_money",
    BANK_TRANSFER = "bank_transfer",
    PAYPAL = "paypal"
}
export interface HostPayoutAccount {
    method: PayoutMethod;
    accountIdentifier: string;
    providerName?: string;
    isDefault: boolean;
    currency: string;
}
export interface PushToken {
    token: string;
    platform: 'ios' | 'android';
    deviceId?: string;
    updatedAt: Date;
}
export interface HostPayoutRecord {
    _id?: Types.ObjectId;
    amount: number;
    currency: string;
    method: PayoutMethod;
    reference?: string;
    status: 'pending' | 'processing' | 'paid' | 'failed';
    initiatedAt: Date;
    completedAt?: Date;
    failureReason?: string;
}
export interface HostProfile {
    verificationStatus: HostVerificationStatus;
    governmentIdUrl?: string;
    governmentIdPublicId?: string;
    verificationSubmittedAt?: Date;
    verificationReviewedAt?: Date;
    verificationRejectionReason?: string;
    isSuperhost: boolean;
    superhostSince?: Date;
    instantBookEnabled: boolean;
    minNightsDefault: number;
    maxNightsDefault: number;
    advanceNoticeHours: number;
    bookingWindowMonths: number;
    responseRate?: number;
    responseTimeMinutes?: number;
    totalEarnings: number;
    currentMonthEarnings: number;
    completedStays: number;
    commissionRate: number;
    payoutAccounts: HostPayoutAccount[];
    payoutHistory: HostPayoutRecord[];
    petsAllowedDefault: boolean;
    smokingAllowedDefault: boolean;
    eventsAllowedDefault: boolean;
    checkInTimeDefault?: string;
    checkOutTimeDefault?: string;
    coHostIds: Types.ObjectId[];
    hostBio?: string;
    hostLanguages: string[];
    operatingCity?: string;
}
export declare enum StudentVerificationStatus {
    UNVERIFIED = "unverified",
    PENDING = "pending",
    VERIFIED = "verified",
    REJECTED = "rejected"
}
export interface StudentProfile {
    universityName: string;
    faculty?: string;
    studyLevel?: string;
    enrollmentYear?: number;
    studentIdUrl?: string;
    studentIdPublicId?: string;
    verificationStatus: StudentVerificationStatus;
    verificationSubmittedAt?: Date;
    verificationReviewedAt?: Date;
    verificationRejectionReason?: string;
    campusCity: string;
    campusLatitude?: number;
    campusLongitude?: number;
    roommateProfileId?: Types.ObjectId;
    ambassadorCode?: string;
    isAmbassador: boolean;
    ambassadorEarnings?: number;
}
export type TenantStatus = 'active' | 'ended' | 'pending';
export interface TenantRecord {
    _id?: Types.ObjectId;
    tenantName: string;
    tenantEmail?: string;
    tenantPhone?: string;
    tenantUserId?: Types.ObjectId;
    propertyId: Types.ObjectId;
    leaseStart: Date;
    leaseEnd: Date;
    monthlyRent: number;
    depositAmount?: number;
    status: TenantStatus;
    notes?: string;
}
export interface UserPreferences {
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
    preferredLocation?: {
        type: 'Point';
        coordinates: [number, number];
    };
}
export interface AgentPreferences {
    licenseNumber?: string;
    agency?: string;
    experience?: number;
    specializations?: string[];
    serviceAreas?: string[];
    commissionRate?: number;
    propertyPriceRange?: {
        min: number;
        max: number;
        currency: string;
    };
}
export interface SearchQuery {
    query: string;
    filters: any;
    location?: {
        type: 'Point';
        coordinates: [number, number];
    };
    timestamp: Date;
    resultsCount: number;
}
export interface UserSession {
    id: string;
    refreshToken: string;
    device: string;
    ipAddress: string;
    userAgent: string;
    location?: string;
    isActive: boolean;
    lastActive: Date;
    createdAt: Date;
    expiresAt: Date;
}
export declare class User {
    name: string;
    email?: string;
    phoneNumber: string;
    role: UserRole;
    profilePicture?: string;
    favorites: Types.ObjectId[];
    preferences: UserPreferences;
    searchHistory: SearchQuery[];
    recentlyViewed: Array<{
        propertyId: Types.ObjectId;
        viewedAt: Date;
    }>;
    isActive: boolean;
    specialties?: string[];
    languages?: string[];
    serviceAreas?: string[];
    emailVerified: boolean;
    phoneVerified: boolean;
    googleId?: string;
    password?: string;
    averageRating?: number;
    reviewCount?: number;
    phoneVerificationCode?: string;
    phoneVerificationExpires?: Date;
    emailVerificationToken?: string;
    emailVerificationExpires?: Date;
    resetPasswordToken?: string;
    resetPasswordExpires?: Date;
    twoFactorEnabled?: boolean;
    twoFactorSecret?: string;
    sessions: UserSession[];
    licenseNumber?: string;
    agency?: string;
    bio?: string;
    website?: string;
    propertiesListed?: number;
    propertiesSold?: number;
    tenants: TenantRecord[];
    totalRentalIncome?: number;
    occupancyRate?: number;
    hostProfile?: HostProfile;
    studentProfile?: StudentProfile;
    emailNotifications: boolean;
    smsNotifications: boolean;
    pushNotifications: boolean;
    pushTokens: PushToken[];
    location?: {
        type: 'Point';
        coordinates: [number, number];
    };
    address?: string;
    city?: string;
    country?: string;
    onboardingCompleted?: boolean;
    onboardingStatus: OnboardingStatus;
    agentPreferences?: AgentPreferences;
    createdAt: Date;
    updatedAt: Date;
    _id: Types.ObjectId;
}
export declare const UserSchema: import("mongoose").Schema<User, import("mongoose").Model<User, any, any, any, Document<unknown, any, User, any, {}> & User & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, User, Document<unknown, {}, import("mongoose").FlatRecord<User>, {}, import("mongoose").DefaultSchemaOptions> & import("mongoose").FlatRecord<User> & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}>;
