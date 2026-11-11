import { WaterSource, ElectricityBackup, FurnishingStatus, GenderRestriction } from '../../properties/schemas/property.schema';
export declare class StudentPropertySearchDto {
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    city?: string;
    neighborhood?: string;
    nearestCampus?: string;
    maxCampusProximityMeters?: number;
    minPricePerPerson?: number;
    maxPricePerPerson?: number;
    waterSource?: WaterSource;
    electricityBackup?: ElectricityBackup;
    furnishingStatus?: FurnishingStatus;
    genderRestriction?: GenderRestriction;
    noCurfew?: boolean;
    visitorsAllowed?: boolean;
    hasGatedCompound?: boolean;
    hasNightWatchman?: boolean;
    studentApprovedOnly?: boolean;
    acceptsRentAdvanceScheme?: boolean;
    maxAdvanceMonths?: number;
    hasAvailableBeds?: boolean;
    minAvailableBeds?: number;
}
export declare class MarkStudentFriendlyDto {
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
    maxAdvanceMonths?: number;
    acceptsRentAdvanceScheme?: boolean;
    availableBeds?: number;
    totalBeds?: number;
    pricePerPersonMonthly?: number;
}
