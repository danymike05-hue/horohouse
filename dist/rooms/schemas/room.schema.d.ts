import { Document, Types } from 'mongoose';
export type RoomDocument = Room & Document;
export declare enum RoomType {
    SINGLE = "single",
    DOUBLE = "double",
    TWIN = "twin",
    SUITE = "suite",
    DORMITORY = "dormitory",
    DELUXE = "deluxe",
    FAMILY = "family",
    PENTHOUSE = "penthouse",
    STUDIO = "studio"
}
export declare enum BedType {
    SINGLE = "single",
    DOUBLE = "double",
    QUEEN = "queen",
    KING = "king",
    BUNK = "bunk",
    SOFA = "sofa_bed"
}
export interface RoomImage {
    url: string;
    publicId: string;
    caption?: string;
}
export interface RoomUnavailableDateRange {
    from: Date;
    to: Date;
    reason?: string;
    source?: string;
}
export declare class Room {
    _id: Types.ObjectId;
    propertyId: Types.ObjectId;
    name: string;
    roomNumber?: string;
    roomType: RoomType;
    maxGuests: number;
    bedCount: number;
    bedType: BedType;
    price?: number;
    cleaningFee?: number;
    amenities: {
        hasWifi?: boolean;
        hasAirConditioning?: boolean;
        hasHeating?: boolean;
        hasTv?: boolean;
        hasBalcony?: boolean;
        hasPrivateBathroom?: boolean;
        hasKitchenette?: boolean;
        hasDesk?: boolean;
        hasSafe?: boolean;
        hasMinibar?: boolean;
        wheelchairAccessible?: boolean;
        selfCheckIn?: boolean;
        checkInTime?: string;
        checkOutTime?: string;
    };
    images: RoomImage[];
    unavailableDates: RoomUnavailableDateRange[];
    icalUrl?: string;
    icalLastSyncedAt?: Date;
    icalSyncedRangesCount: number;
    isActive: boolean;
    bookingsCount: number;
    createdAt: Date;
    updatedAt: Date;
}
export declare const RoomSchema: import("mongoose").Schema<Room, import("mongoose").Model<Room, any, any, any, Document<unknown, any, Room, any, {}> & Room & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, Room, Document<unknown, {}, import("mongoose").FlatRecord<Room>, {}, import("mongoose").DefaultSchemaOptions> & import("mongoose").FlatRecord<Room> & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}>;
