import { RoomType, BedType } from '../schemas/room.schema';
export declare class RoomAmenitiesDto {
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
}
export declare class RoomDateRangeDto {
    from: string;
    to: string;
    reason?: string;
}
export declare class CreateRoomDto {
    propertyId: string;
    name: string;
    roomNumber?: string;
    roomType: RoomType;
    maxGuests: number;
    bedCount?: number;
    bedType?: BedType;
    price?: number;
    cleaningFee?: number;
    amenities?: RoomAmenitiesDto;
}
declare const UpdateRoomDto_base: import("@nestjs/common").Type<Partial<CreateRoomDto>>;
export declare class UpdateRoomDto extends UpdateRoomDto_base {
    isActive?: boolean;
}
export declare class BlockRoomDatesDto {
    ranges: RoomDateRangeDto[];
}
export declare class UnblockRoomDatesDto {
    fromDates: string[];
}
export declare class SetIcalUrlDto {
    icalUrl: string;
}
export declare class RoomAvailabilityQueryDto {
    from: string;
    to: string;
}
export {};
