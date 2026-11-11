"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var IcalSyncService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.IcalSyncService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const schedule_1 = require("@nestjs/schedule");
const mongoose_2 = require("mongoose");
const room_schema_1 = require("./schemas/room.schema");
const rooms_service_1 = require("./rooms.service");
let IcalSyncService = IcalSyncService_1 = class IcalSyncService {
    roomModel;
    roomsService;
    logger = new common_1.Logger(IcalSyncService_1.name);
    constructor(roomModel, roomsService) {
        this.roomModel = roomModel;
        this.roomsService = roomsService;
    }
    async syncAllRooms() {
        const rooms = await this.roomModel
            .find({ icalUrl: { $exists: true, $ne: null }, isActive: true })
            .select('_id icalUrl icalLastSyncedAt')
            .lean()
            .exec();
        if (rooms.length === 0)
            return;
        this.logger.log(`iCal batch sync: processing ${rooms.length} room(s)`);
        let successCount = 0;
        let failCount = 0;
        await Promise.allSettled(rooms.map(async (room) => {
            try {
                const result = await this.roomsService.syncIcal(room._id.toString());
                successCount++;
                this.logger.debug(`iCal sync OK — room ${room._id}: ${result.synced} range(s)`);
            }
            catch (err) {
                failCount++;
                this.logger.warn(`iCal sync FAILED — room ${room._id}: ${err.message}`);
            }
        }));
        this.logger.log(`iCal batch sync complete: ${successCount} succeeded, ${failCount} failed`);
    }
};
exports.IcalSyncService = IcalSyncService;
__decorate([
    (0, schedule_1.Cron)('0 * * * *'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], IcalSyncService.prototype, "syncAllRooms", null);
exports.IcalSyncService = IcalSyncService = IcalSyncService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(room_schema_1.Room.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        rooms_service_1.RoomsService])
], IcalSyncService);
//# sourceMappingURL=ical-sync.service.js.map