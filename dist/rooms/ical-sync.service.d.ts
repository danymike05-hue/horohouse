import { Model } from 'mongoose';
import { RoomDocument } from './schemas/room.schema';
import { RoomsService } from './rooms.service';
export declare class IcalSyncService {
    private roomModel;
    private readonly roomsService;
    private readonly logger;
    constructor(roomModel: Model<RoomDocument>, roomsService: RoomsService);
    syncAllRooms(): Promise<void>;
}
