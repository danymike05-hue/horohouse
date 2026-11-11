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
    beds?: number;
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
    hasWaterTank?: boolean;
    hasSolarBackup?: boolean;
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
    hasWorkspace?: boolean;
    hasSmokeDetector?: boolean;
    hasFireExtinguisher?: boolean;
    hasFirstAidKit?: boolean;
    hasSecurityCameras?: boolean;
}
export interface CheckInGuidePhoto {
    url: string;
    publicId: string;
    caption?: string;
}
export interface CheckInGuide {
    wifiName?: string;
    wifiPassword?: string;
    directions?: string;
    accessInstructions?: string;
    parking?: string;
    houseManual?: string;
    emergencyPhone?: string;
    photos?: CheckInGuidePhoto[];
    updatedAt?: Date;
}
export declare enum CheckInMethod {
    HOST_GREETS = "host_greets",
    STAFF = "staff",
    LOCKBOX = "lockbox",
    SMART_LOCK = "smart_lock",
    KEYPAD = "keypad"
}
export declare const CHECKOUT_TASKS: readonly ["gather_towels", "strip_beds", "take_out_trash", "turn_things_off", "lock_up", "return_keys", "wash_dishes"];
export type CheckoutTask = (typeof CHECKOUT_TASKS)[number];
export interface HouseRules {
    childrenAllowed?: boolean;
    infantsAllowed?: boolean;
    visitorsAllowed?: boolean;
    quietHoursStart?: string | null;
    quietHoursEnd?: string | null;
    commercialPhotographyAllowed?: boolean;
    checkInEndTime?: string | null;
    checkInMethod?: CheckInMethod;
    idRequiredAtCheckIn?: boolean;
    securityDeposit?: number;
    checkoutTasks?: CheckoutTask[];
    additionalRules?: string;
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
    source?: string;
    calendarId?: string;
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
    guestsIncluded?: number | null;
    extraGuestFee: number;
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
        lastSyncError?: string | null;
        lastSyncedCount?: number;
    }>;
    icalExportToken?: string;
    shortTermAmenities: ShortTermAmenities;
    houseRules: HouseRules;
    checkInGuide?: CheckInGuide;
    instantBookRequiresVerifiedGuest: boolean;
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
    stayRatingBreakdown?: Record<string, number>;
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
