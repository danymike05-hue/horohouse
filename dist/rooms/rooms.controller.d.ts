import { FastifyRequest } from 'fastify';
import { RoomsService } from './rooms.service';
import { CreateRoomDto, UpdateRoomDto, BlockRoomDatesDto, UnblockRoomDatesDto, SetIcalUrlDto, RoomAvailabilityQueryDto } from './dto/room.dto';
import { User } from '../users/schemas/user.schema';
export declare class RoomsController {
    private readonly roomsService;
    constructor(roomsService: RoomsService);
    createRoom(dto: CreateRoomDto, req: FastifyRequest & {
        user: User;
    }): Promise<import("./schemas/room.schema").Room>;
    getRoomsByProperty(propertyId: string, includeInactive?: string): Promise<import("./schemas/room.schema").Room[]>;
    getRoomById(id: string): Promise<import("./schemas/room.schema").Room>;
    updateRoom(id: string, dto: UpdateRoomDto, req: FastifyRequest & {
        user: User;
    }): Promise<import("./schemas/room.schema").Room>;
    deleteRoom(id: string, req: FastifyRequest & {
        user: User;
    }): Promise<void>;
    uploadImages(id: string, req: FastifyRequest & {
        user: User;
    }): Promise<{
        message: string;
        room: import("./schemas/room.schema").Room;
    }>;
    deleteImage(id: string, imageId: string, req: FastifyRequest & {
        user: User;
    }): Promise<{
        message: string;
        room: import("./schemas/room.schema").Room;
    }>;
    blockDates(id: string, dto: BlockRoomDatesDto, req: FastifyRequest & {
        user: User;
    }): Promise<import("./schemas/room.schema").Room>;
    unblockDates(id: string, dto: UnblockRoomDatesDto, req: FastifyRequest & {
        user: User;
    }): Promise<import("./schemas/room.schema").Room>;
    setIcalUrl(id: string, dto: SetIcalUrlDto, req: FastifyRequest & {
        user: User;
    }): Promise<import("./schemas/room.schema").Room>;
    syncIcal(id: string): Promise<{
        synced: number;
        roomId: string;
    }>;
    getRoomAvailability(id: string, query: RoomAvailabilityQueryDto): Promise<import("./rooms.service").RoomAvailabilityResult>;
}
