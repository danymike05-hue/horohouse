import { Document, Types } from 'mongoose';
export type ListingBoostDocument = ListingBoost & Document;
export declare enum BoostType {
    STANDARD = "standard",
    FEATURED = "featured",
    HIGHLIGHT = "highlight",
    TOP = "top",
    HOMEPAGE = "homepage",
    SOCIAL_MEDIA = "social_media"
}
export declare enum BoostStatus {
    PENDING = "pending",
    ACTIVE = "active",
    EXPIRED = "expired",
    CANCELLED = "cancelled"
}
export declare class ListingBoost {
    userId: Types.ObjectId;
    propertyId: Types.ObjectId;
    boostType: BoostType;
    status: BoostStatus;
    duration: number;
    price: number;
    currency?: string;
    startDate?: Date;
    endDate?: Date;
    paymentDate?: Date;
    transactionId?: Types.ObjectId;
    impressions?: number;
    clicks?: number;
    inquiries?: number;
    cancelledAt?: Date;
    cancellationReason?: string;
    metadata?: Record<string, any>;
    createdAt: Date;
    updatedAt: Date;
}
export declare const ListingBoostSchema: import("mongoose").Schema<ListingBoost, import("mongoose").Model<ListingBoost, any, any, any, Document<unknown, any, ListingBoost, any, {}> & ListingBoost & {
    _id: Types.ObjectId;
} & {
    __v: number;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, ListingBoost, Document<unknown, {}, import("mongoose").FlatRecord<ListingBoost>, {}, import("mongoose").DefaultSchemaOptions> & import("mongoose").FlatRecord<ListingBoost> & {
    _id: Types.ObjectId;
} & {
    __v: number;
}>;
