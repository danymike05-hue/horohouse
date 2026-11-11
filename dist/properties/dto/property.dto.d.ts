import { PropertyType, ListingType, PropertyStatus, PricingUnit, CancellationPolicy, CheckInMethod } from '../schemas/property.schema';
export declare class ShortTermAmenitiesDto {
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
    wheelchairAccessible?: boolean;
    selfCheckIn?: boolean;
    airportTransfer?: boolean;
    conciergeService?: boolean;
    dailyHousekeeping?: boolean;
    hasWorkspace?: boolean;
    hasSmokeDetector?: boolean;
    hasFireExtinguisher?: boolean;
    hasFirstAidKit?: boolean;
    hasSecurityCameras?: boolean;
    maxGuests?: number;
    checkInTime?: string;
    checkOutTime?: string;
}
export declare class HouseRulesDto {
    childrenAllowed?: boolean;
    infantsAllowed?: boolean;
    visitorsAllowed?: boolean;
    commercialPhotographyAllowed?: boolean;
    idRequiredAtCheckIn?: boolean;
    quietHoursStart?: string | null;
    quietHoursEnd?: string | null;
    checkInEndTime?: string | null;
    checkInMethod?: CheckInMethod;
    securityDeposit?: number;
    checkoutTasks?: string[];
    additionalRules?: string;
}
export declare class UnavailableDateRangeDto {
    from: string;
    to: string;
    reason?: string;
}
export declare class CreatePropertyDto {
    title: string;
    price: number;
    originalPrice?: number;
    currency?: string;
    type: PropertyType;
    listingType: ListingType;
    description: string;
    city: string;
    address: string;
    state?: string;
    neighborhood?: string;
    country?: string;
    latitude?: number;
    longitude?: number;
    amenities?: {
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
    };
    pricingUnit?: PricingUnit;
    minNights?: number;
    maxNights?: number;
    cleaningFee?: number;
    serviceFee?: number;
    weeklyDiscountPercent?: number;
    monthlyDiscountPercent?: number;
    customDiscountNights?: number;
    customDiscountPercent?: number;
    shortTermAmenities?: ShortTermAmenitiesDto;
    guestsIncluded?: number | null;
    extraGuestFee?: number;
    instantBookRequiresVerifiedGuest?: boolean;
    houseRules?: HouseRulesDto;
    noticeDays?: number;
    windowMonths?: number | null;
    isInstantBookable?: boolean;
    cancellationPolicy?: CancellationPolicy;
    advanceNoticeDays?: number;
    bookingWindowDays?: number;
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
    keywords?: string[];
    nearbyAmenities?: string[];
    transportAccess?: string[];
    virtualTourUrl?: string;
    videoUrl?: string;
    tourType?: string;
    tourThumbnail?: string;
    starRating?: number;
    status?: PropertyStatus;
    images?: any[];
    videos?: any[];
}
declare const UpdatePropertyDto_base: import("@nestjs/common").Type<Partial<CreatePropertyDto>>;
export declare class UpdatePropertyDto extends UpdatePropertyDto_base {
    availability?: PropertyStatus;
    isVerified?: boolean;
    isFeatured?: boolean;
    isActive?: boolean;
}
export declare class BlockDatesDto {
    ranges: UnavailableDateRangeDto[];
}
export declare class UnblockDatesDto {
    fromDates: string[];
}
export declare class UpdateCalendarSettingsDto {
    basePrice?: number;
    weekendPrice?: number | null;
    minNights?: number;
    maxNights?: number | null;
    noticeDays?: number;
    windowMonths?: number | null;
}
export declare class SetCalendarPricesDto {
    from: string;
    to: string;
    price?: number | null;
}
export declare class AddExternalCalendarDto {
    name: string;
    url: string;
}
export {};
