import { Document, Types } from 'mongoose';
export type SavedSearchDocument = SavedSearch & Document & {
    createdAt: Date;
    updatedAt: Date;
};
export declare enum SearchFrequency {
    INSTANT = "instant",
    DAILY = "daily",
    WEEKLY = "weekly",
    NEVER = "never"
}
export declare class SavedSearch {
    userId: Types.ObjectId;
    name: string;
    searchCriteria: {
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
    };
    notificationFrequency: SearchFrequency;
    isActive: boolean;
    resultsCount: number;
    lastNotificationSent?: Date;
    lastChecked?: Date;
    newMatchingProperties: Types.ObjectId[];
}
export declare const SavedSearchSchema: import("mongoose").Schema<SavedSearch, import("mongoose").Model<SavedSearch, any, any, any, Document<unknown, any, SavedSearch, any, {}> & SavedSearch & {
    _id: Types.ObjectId;
} & {
    __v: number;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, SavedSearch, Document<unknown, {}, import("mongoose").FlatRecord<SavedSearch>, {}, import("mongoose").DefaultSchemaOptions> & import("mongoose").FlatRecord<SavedSearch> & {
    _id: Types.ObjectId;
} & {
    __v: number;
}>;
