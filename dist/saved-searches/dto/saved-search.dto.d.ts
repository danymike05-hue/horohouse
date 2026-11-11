import { SearchFrequency } from '../schemas/saved-search.schema';
export declare class SearchCriteriaDto {
    minPrice?: number;
    maxPrice?: number;
    propertyType?: string;
    listingType?: string;
    city?: string;
    state?: string;
    bedrooms?: number;
    bathrooms?: number;
    amenities?: string[];
    latitude?: number;
    longitude?: number;
    radius?: number;
}
export declare class CreateSavedSearchDto {
    name: string;
    searchCriteria: SearchCriteriaDto;
    notificationFrequency?: SearchFrequency;
    isActive?: boolean;
}
export declare class UpdateSavedSearchDto {
    name?: string;
    searchCriteria?: SearchCriteriaDto;
    notificationFrequency?: SearchFrequency;
    isActive?: boolean;
}
