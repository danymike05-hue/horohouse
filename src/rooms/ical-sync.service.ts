import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Cron } from '@nestjs/schedule';
import { Model } from 'mongoose';

import { Room, RoomDocument } from './schemas/room.schema';
import { RoomsService } from './rooms.service';

@Injectable()
export class IcalSyncService {
    private readonly logger = new Logger(IcalSyncService.name);

    constructor(
        @InjectModel(Room.name) private roomModel: Model<RoomDocument>,
        private readonly roomsService: RoomsService,
    ) { }

    /**
     * Every hour: iterate all active rooms that have an iCal URL and sync them.
     * Failures on individual rooms are caught and logged so one bad URL
     * doesn't abort the rest of the batch.
     */
    @Cron('0 * * * *') // top of every hour
    async syncAllRooms(): Promise<void> {
        const rooms = await this.roomModel
            .find({ icalUrl: { $exists: true, $ne: null }, isActive: true })
            .select('_id icalUrl icalLastSyncedAt')
            .lean()
            .exec();

        if (rooms.length === 0) return;

        this.logger.log(`iCal batch sync: processing ${rooms.length} room(s)`);

        let successCount = 0;
        let failCount = 0;

        await Promise.allSettled(
            rooms.map(async (room) => {
                try {
                    const result = await this.roomsService.syncIcal(room._id.toString());
                    successCount++;
                    this.logger.debug(
                        `iCal sync OK — room ${room._id}: ${result.synced} range(s)`,
                    );
                } catch (err: any) {
                    failCount++;
                    this.logger.warn(
                        `iCal sync FAILED — room ${room._id}: ${err.message}`,
                    );
                }
            }),
        );

        this.logger.log(
            `iCal batch sync complete: ${successCount} succeeded, ${failCount} failed`,
        );
    }
}
