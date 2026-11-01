import { Document, Types } from 'mongoose';
export type PropertyDocument = Property & Document;
export declare enum PropertyType {
    APARTMENT = "apartment",
    HOUSE = "house",
    VILLA = "villa",
    STUDIO = "studio",
    DUPLEX = "duplex",
    BUNGALOW = "bungalow",
    PENTHOUSE = "penthouse",
    LAND = "land",
    COMMERCIAL = "commercial",
    OFFICE = "office",
    SHOP = "shop",
    WAREHOUSE = "warehouse",
    HOTEL = "hotel",
    MOTEL = "motel",
    VACATION_RENTAL = "vacation_rental",
    GUESTHOUSE = "guesthouse",
    HOSTEL = "hostel",
    RESORT = "resort",
    SERVICED_APARTMENT = "serviced_apartment"
}
export declare enum PropertyStatus {
    ACTIVE = "active",
    SOLD = "sold",
    RENTED = "rented",
    PENDING = "pending",
    DRAFT = "draft"
}
export declare enum ApprovalStatus {
    PENDING = "pending",
    APPROVED = "approved",
    REJECTED = "rejected"
}
export declare enum ListingType {
    SALE = "sale",
    RENT = "rent",
    SHORT_TERM = "short_term"
}
export declare enum PricingUnit {
    NIGHTLY = "nightly",
    WEEKLY = "weekly",
    MONTHLY = "monthly"
}
export declare enum CancellationPolicy {
    FLEXIBLE = "flexible",
    MODERATE = "moderate",
    STRICT = "strict",
    NO_REFUND = "no_refund"
}
export declare enum WaterSource {
    CAMWATER = "camwater",
    BOREHOLE = "borehole",
    WELL = "well",
    TANKER = "tanker",
    CAMWATER_AND_BOREHOLE = "camwater_and_borehole"
}
export declare enum ElectricityBackup {
    NONE = "none",
    SOLAR = "solar",
    GENERATOR = "generator",
    SOLAR_AND_GENERATOR = "solar_and_generator"
}
export declare enum FurnishingStatus {
    UNFURNISHED = "unfurnished",
    SEMI_FURNISHED = "semi_furnished",
    FURNISHED = "furnished"
}
export declare enum GenderRestriction {
    NONE = "none",
    WOMEN_ONLY = "women_only",
    MEN_ONLY = "men_only"
}
export interface PropertyAmenities {
    bedrooms?: number;
    bathrooms?: number;
    parkingSpaces?: number;
    hasGarden?: boolean;
    hasPool?: boolean;
    hasGym?: boolean;
    hasSecurity?: boolean;
    hasElevator?: boolean;
    hasBalcony?: boolean;
    hasAirConditioning?: boolean;
    hasInternet?: boolean;
    hasGenerator?: boolean;
    furnished?: boolean;
}
export interface ShortTermAmenities {
    hasWifi?: boolean;
    hasBreakfast?: boolean;
    hasParking?: boolean;
    hasTv?: boolean;
    hasKitchen?: boolean;
    hasKitchenette?: boolean;
    hasWasher?: boolean;
    hasDryer?: boolean;
    hasAirConditioning?: boolean;
    hasHeating?: boolean;
    petsAllowed?: boolean;
    smokingAllowed?: boolean;
    partiesAllowed?: boolean;
    maxGuests?: number;
    checkInTime?: string;
    checkOutTime?: string;
    selfCheckIn?: boolean;
    wheelchairAccessible?: boolean;
    airportTransfer?: boolean;
    conciergeService?: boolean;
    dailyHousekeeping?: boolean;
}
export interface StudentDetails {
    campusProximityMeters?: number;
    nearestCampus?: string;
    walkingMinutes?: number;
    taxiMinutes?: number;
    waterSource?: WaterSource;
    electricityBackup?: ElectricityBackup;
    furnishingStatus?: FurnishingStatus;
    genderRestriction?: GenderRestriction;
    curfewTime?: string;
    visitorsAllowed?: boolean;
    cookingAllowed?: boolean;
    hasGatedCompound?: boolean;
    hasNightWatchman?: boolean;
    hasFence?: boolean;
    isStudentApproved?: boolean;
    maxAdvanceMonths?: number;
    acceptsRentAdvanceScheme?: boolean;
    availableBeds?: number;
    totalBeds?: number;
    pricePerPersonMonthly?: number;
}
export interface PropertyImages {
    url: string;
    publicId: string;
    caption?: string;
    isMain?: boolean;
}
export interface PropertyMediaItem {
    url: string;
    publicId: string;
    caption?: string;
}
export interface UnavailableDateRange {
    from: Date;
    to: Date;
    reason?: string;
}
export declare class Property {
    _id: Types.ObjectId;
    title: string;
    price: number;
    originalPrice?: number | null;
    currency?: string;
    type: PropertyType;
    listingType: ListingType;
    description: string;
    city: string;
    address: string;
    state?: string;
    neighborhood?: string;
    country?: string;
    location: {
        type: string;
        coordinates: [number, number];
    };
    latitude?: number;
    longitude?: number;
    images: PropertyImages[];
    videos: PropertyMediaItem[];
    amenities: PropertyAmenities;
    pricingUnit: PricingUnit;
    minNights: number;
    maxNights: number;
    cleaningFee: number;
    serviceFee: number;
    weeklyDiscountPercent: number;
    monthlyDiscountPercent: number;
    customDiscountNights?: number | null;
    customDiscountPercent?: number | null;
    unavailableDates: UnavailableDateRange[];
    weekendPrice?: number | null;
    priceOverrides: Record<string, number>;
    noticeDays: number;
    windowMonths?: number | null;
    externalCalendars: Array<{
        id: string;
        name: string;
        url: string;
        lastSyncedAt?: Date | null;
    }>;
    shortTermAmenities: ShortTermAmenities;
    isInstantBookable: boolean;
    cancellationPolicy: CancellationPolicy;
    advanceNoticeDays: number;
    bookingWindowDays: number;
    isStudentFriendly: boolean;
    studentDetails?: StudentDetails;
    ownerId: Types.ObjectId;
    agentId?: Types.ObjectId;
    area?: number;
    yearBuilt?: number;
    floorNumber?: number;
    totalFloors?: number;
    pricePerSqm?: number;
    depositAmount?: number;
    maintenanceFee?: number;
    contactPhone?: string;
    contactWhatsApp?: string;
    contactEmail?: string;
    keywords: string[];
    slug?: string;
    nearbyAmenities: string[];
    transportAccess: string[];
    viewsCount: number;
    inquiriesCount: number;
    favoritesCount: number;
    sharesCount: number;
    availability: PropertyStatus;
    approvalStatus: ApprovalStatus;
    rejectionReason?: string;
    isVerified: boolean;
    isFeatured: boolean;
    isActive: boolean;
    averageRating?: number;
    reviewCount?: number;
    starRating?: number;
    virtualTourUrl?: string;
    videoUrl?: string;
    tourType?: string;
    tourThumbnail?: string;
    tourViews: number;
    createdAt: Date;
    updatedAt: Date;
}
export declare const PropertySchema: import("mongoose").Schema<Property, import("mongoose").Model<Property, any, any, any, Document<unknown, any, Property, any, {}> & Property & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, Property, Document<unknown, {}, import("mongoose").FlatRecord<Property>, {}, import("mongoose").DefaultSchemaOptions> & import("mongoose").FlatRecord<Property> & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}>;
