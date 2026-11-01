import { Model, Types } from 'mongoose';
import { Room, RoomDocument } from './schemas/room.schema';
import { BookingDocument } from '../bookings/schema/booking.schema';
import { PropertyDocument } from '../properties/schemas/property.schema';
import { User } from '../users/schemas/user.schema';
import { CreateRoomDto, UpdateRoomDto, BlockRoomDatesDto, UnblockRoomDatesDto, SetIcalUrlDto } from './dto/room.dto';
export interface RoomAvailabilityResult {
    available: boolean;
    unavailableDates: {
        from: Date;
        to: Date;
        reason?: string;
        source?: string;
    }[];
    bookedRanges: {
        checkIn: Date;
        checkOut: Date;
        bookingId: Types.ObjectId;
    }[];
}
export declare class RoomsService {
    private roomModel;
    private bookingModel;
    private propertyModel;
    private readonly logger;
    constructor(roomModel: Model<RoomDocument>, bookingModel: Model<BookingDocument>, propertyModel: Model<PropertyDocument>);
    createRoom(dto: CreateRoomDto, user: User): Promise<Room>;
    getRoomsByProperty(propertyId: string, includeInactive?: boolean): Promise<Room[]>;
    getRoomById(roomId: string): Promise<Room>;
    updateRoom(roomId: string, dto: UpdateRoomDto, user: User): Promise<Room>;
    deleteRoom(roomId: string, user: User): Promise<void>;
    uploadImages(roomId: string, files: {
        buffer: Buffer;
        filename?: string;
    }[], user: User): Promise<Room>;
    deleteImage(roomId: string, imagePublicId: string, user: User): Promise<Room>;
    blockRoomDates(roomId: string, dto: BlockRoomDatesDto, user: User): Promise<Room>;
    unblockRoomDates(roomId: string, dto: UnblockRoomDatesDto, user: User): Promise<Room>;
    setIcalUrl(roomId: string, dto: SetIcalUrlDto, user: User): Promise<Room>;
    syncIcal(roomId: string): Promise<{
        synced: number;
        roomId: string;
    }>;
    getRoomAvailability(roomId: string, from: Date, to: Date): Promise<RoomAvailabilityResult>;
    assertRoomDatesAvailable(roomId: string, checkIn: Date, checkOut: Date, excludeBookingId?: string): Promise<void>;
    private findRoomOrThrow;
    private assertCanManage;
    fetchAndParseIcal(url: string): Promise<{
        from: Date;
        to: Date;
        reason: string;
        source: string;
    }[]>;
    private fetchUrl;
    private parseIcalEvents;
    private parseIcalDate;
}
