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
var RoomsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RoomsService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const room_schema_1 = require("./schemas/room.schema");
const booking_schema_1 = require("../bookings/schema/booking.schema");
const property_schema_1 = require("../properties/schemas/property.schema");
const user_schema_1 = require("../users/schemas/user.schema");
const cloudinary_1 = require("../utils/cloudinary");
const MULTI_ROOM_TYPES = ['hotel', 'motel', 'hostel', 'resort', 'guesthouse', 'serviced_apartment'];
let RoomsService = RoomsService_1 = class RoomsService {
    roomModel;
    bookingModel;
    propertyModel;
    logger = new common_1.Logger(RoomsService_1.name);
    constructor(roomModel, bookingModel, propertyModel) {
        this.roomModel = roomModel;
        this.bookingModel = bookingModel;
        this.propertyModel = propertyModel;
    }
    async createRoom(dto, user) {
        const property = await this.propertyModel.findById(dto.propertyId).exec();
        if (!property)
            throw new common_1.NotFoundException('Property not found');
        this.assertCanManage(property, user);
        if (!MULTI_ROOM_TYPES.includes(property.type)) {
            throw new common_1.BadRequestException(`Rooms can only be added to hotel/motel/hostel/resort properties. ` +
                `This property is of type "${property.type}". ` +
                `Supported types: ${MULTI_ROOM_TYPES.join(', ')}.`);
        }
        if (property.listingType !== property_schema_1.ListingType.SHORT_TERM) {
            throw new common_1.BadRequestException('Rooms can only be added to short-term listings.');
        }
        const room = new this.roomModel({
            propertyId: new mongoose_2.Types.ObjectId(dto.propertyId),
            name: dto.name,
            roomNumber: dto.roomNumber,
            roomType: dto.roomType,
            maxGuests: dto.maxGuests,
            bedCount: dto.bedCount ?? 1,
            bedType: dto.bedType,
            price: dto.price,
            cleaningFee: dto.cleaningFee,
            amenities: dto.amenities ?? {},
            isActive: true,
        });
        const saved = await room.save();
        this.logger.log(`Room created: ${saved._id} for property ${dto.propertyId}`);
        return saved;
    }
    async getRoomsByProperty(propertyId, includeInactive = false) {
        if (!mongoose_2.Types.ObjectId.isValid(propertyId)) {
            throw new common_1.BadRequestException('Invalid property ID');
        }
        const query = { propertyId: new mongoose_2.Types.ObjectId(propertyId) };
        if (!includeInactive)
            query.isActive = true;
        return this.roomModel.find(query).sort({ roomNumber: 1, name: 1 }).exec();
    }
    async getRoomById(roomId) {
        const room = await this.findRoomOrThrow(roomId);
        return room;
    }
    async updateRoom(roomId, dto, user) {
        const room = await this.findRoomOrThrow(roomId);
        const property = await this.propertyModel.findById(room.propertyId).exec();
        if (!property)
            throw new common_1.NotFoundException('Parent property not found');
        this.assertCanManage(property, user);
        const { propertyId: _removed, ...updateData } = dto;
        const updated = await this.roomModel
            .findByIdAndUpdate(roomId, updateData, { new: true })
            .exec();
        this.logger.log(`Room ${roomId} updated by user ${user._id}`);
        return updated;
    }
    async deleteRoom(roomId, user) {
        const room = await this.findRoomOrThrow(roomId);
        const property = await this.propertyModel.findById(room.propertyId).exec();
        if (!property)
            throw new common_1.NotFoundException('Parent property not found');
        this.assertCanManage(property, user);
        await this.roomModel.findByIdAndUpdate(roomId, { isActive: false }).exec();
        this.logger.log(`Room ${roomId} deactivated by user ${user._id}`);
    }
    async uploadImages(roomId, files, user) {
        const room = await this.findRoomOrThrow(roomId);
        const property = await this.propertyModel.findById(room.propertyId).exec();
        if (!property)
            throw new common_1.NotFoundException('Parent property not found');
        this.assertCanManage(property, user);
        const uploads = await Promise.all(files.map(async (file, index) => {
            const publicId = `room_${roomId}_${Date.now()}_${index}`;
            const result = await (0, cloudinary_1.uploadBufferToCloudinary)(file.buffer, {
                publicId,
                folder: 'horohouse/rooms/images',
                resourceType: 'image',
                transformation: [{ quality: 'auto', fetch_format: 'auto' }],
            });
            return { url: result.secure_url, publicId: result.public_id };
        }));
        room.images = [...(room.images || []), ...uploads];
        await room.save();
        this.logger.log(`Uploaded ${uploads.length} images to room ${roomId}`);
        return room;
    }
    async deleteImage(roomId, imagePublicId, user) {
        const room = await this.findRoomOrThrow(roomId);
        const property = await this.propertyModel.findById(room.propertyId).exec();
        if (!property)
            throw new common_1.NotFoundException('Parent property not found');
        this.assertCanManage(property, user);
        try {
            await (0, cloudinary_1.deleteFromCloudinary)(imagePublicId);
        }
        catch (error) {
            this.logger.warn(`Failed to delete image ${imagePublicId} from Cloudinary:`, error);
        }
        const initialLength = room.images?.length || 0;
        room.images = (room.images || []).filter(img => img.publicId !== imagePublicId);
        if (room.images.length === initialLength) {
            throw new common_1.NotFoundException('Image not found on this room');
        }
        await room.save();
        this.logger.log(`Deleted image ${imagePublicId} from room ${roomId}`);
        return room;
    }
    async blockRoomDates(roomId, dto, user) {
        const room = await this.findRoomOrThrow(roomId);
        const property = await this.propertyModel.findById(room.propertyId).exec();
        if (!property)
            throw new common_1.NotFoundException('Parent property not found');
        this.assertCanManage(property, user);
        const newRanges = dto.ranges.map((r) => {
            const from = new Date(r.from);
            const to = new Date(r.to);
            if (isNaN(from.getTime()) || isNaN(to.getTime())) {
                throw new common_1.BadRequestException(`Invalid date range: ${r.from} → ${r.to}`);
            }
            if (to <= from) {
                throw new common_1.BadRequestException(`"to" must be after "from" in range: ${r.from} → ${r.to}`);
            }
            return { from, to, reason: r.reason, source: 'manual' };
        });
        const updated = await this.roomModel
            .findByIdAndUpdate(roomId, { $push: { unavailableDates: { $each: newRanges } } }, { new: true })
            .exec();
        this.logger.log(`Blocked ${newRanges.length} range(s) on room ${roomId}`);
        return updated;
    }
    async unblockRoomDates(roomId, dto, user) {
        const room = await this.findRoomOrThrow(roomId);
        const property = await this.propertyModel.findById(room.propertyId).exec();
        if (!property)
            throw new common_1.NotFoundException('Parent property not found');
        this.assertCanManage(property, user);
        const fromDates = dto.fromDates.map((d) => {
            const parsed = new Date(d);
            if (isNaN(parsed.getTime()))
                throw new common_1.BadRequestException(`Invalid date: ${d}`);
            return parsed;
        });
        const updated = await this.roomModel
            .findByIdAndUpdate(roomId, { $pull: { unavailableDates: { from: { $in: fromDates }, source: 'manual' } } }, { new: true })
            .exec();
        this.logger.log(`Unblocked ${fromDates.length} range(s) on room ${roomId}`);
        return updated;
    }
    async setIcalUrl(roomId, dto, user) {
        const room = await this.findRoomOrThrow(roomId);
        const property = await this.propertyModel.findById(room.propertyId).exec();
        if (!property)
            throw new common_1.NotFoundException('Parent property not found');
        this.assertCanManage(property, user);
        const updated = await this.roomModel
            .findByIdAndUpdate(roomId, { icalUrl: dto.icalUrl, icalLastSyncedAt: null, icalSyncedRangesCount: 0 }, { new: true })
            .exec();
        this.logger.log(`iCal URL set on room ${roomId}: ${dto.icalUrl}`);
        return updated;
    }
    async syncIcal(roomId) {
        const room = await this.findRoomOrThrow(roomId);
        if (!room.icalUrl) {
            throw new common_1.BadRequestException('No iCal URL set for this room');
        }
        const ranges = await this.fetchAndParseIcal(room.icalUrl);
        await this.roomModel.findByIdAndUpdate(roomId, {
            $pull: { unavailableDates: { source: 'ical' } },
        }).exec();
        if (ranges.length > 0) {
            await this.roomModel.findByIdAndUpdate(roomId, {
                $push: { unavailableDates: { $each: ranges } },
                icalLastSyncedAt: new Date(),
                icalSyncedRangesCount: ranges.length,
            }).exec();
        }
        else {
            await this.roomModel.findByIdAndUpdate(roomId, {
                icalLastSyncedAt: new Date(),
                icalSyncedRangesCount: 0,
            }).exec();
        }
        this.logger.log(`iCal sync complete for room ${roomId}: ${ranges.length} range(s) imported`);
        return { synced: ranges.length, roomId };
    }
    async getRoomAvailability(roomId, from, to) {
        const room = await this.findRoomOrThrow(roomId);
        const blocked = (room.unavailableDates ?? []).filter((r) => new Date(r.from) < to && new Date(r.to) > from);
        const platformBookings = await this.bookingModel
            .find({
            roomId: new mongoose_2.Types.ObjectId(roomId),
            status: { $in: [booking_schema_1.BookingStatus.CONFIRMED, booking_schema_1.BookingStatus.PENDING] },
            checkIn: { $lt: to },
            checkOut: { $gt: from },
        })
            .select('checkIn checkOut _id')
            .lean()
            .exec();
        const bookedRanges = platformBookings.map((b) => ({
            checkIn: b.checkIn,
            checkOut: b.checkOut,
            bookingId: b._id,
        }));
        const available = blocked.length === 0 && bookedRanges.length === 0;
        return {
            available,
            unavailableDates: blocked,
            bookedRanges,
        };
    }
    async assertRoomDatesAvailable(roomId, checkIn, checkOut, excludeBookingId) {
        const room = await this.findRoomOrThrow(roomId);
        const blocked = (room.unavailableDates ?? []).some((r) => new Date(r.from) < checkOut && new Date(r.to) > checkIn);
        if (blocked) {
            throw new common_1.ConflictException('Selected dates are blocked on this room');
        }
        const filter = {
            roomId: new mongoose_2.Types.ObjectId(roomId),
            status: { $in: [booking_schema_1.BookingStatus.CONFIRMED, booking_schema_1.BookingStatus.PENDING] },
            checkIn: { $lt: checkOut },
            checkOut: { $gt: checkIn },
        };
        if (excludeBookingId) {
            filter._id = { $ne: new mongoose_2.Types.ObjectId(excludeBookingId) };
        }
        const conflict = await this.bookingModel
            .findOne(filter)
            .select('_id checkIn checkOut')
            .lean();
        if (conflict) {
            throw new common_1.ConflictException(`Room is already booked from ` +
                `${conflict.checkIn.toISOString().split('T')[0]} to ` +
                `${conflict.checkOut.toISOString().split('T')[0]}`);
        }
    }
    async findRoomOrThrow(roomId) {
        if (!mongoose_2.Types.ObjectId.isValid(roomId)) {
            throw new common_1.BadRequestException('Invalid room ID');
        }
        const room = await this.roomModel.findById(roomId).exec();
        if (!room)
            throw new common_1.NotFoundException('Room not found');
        return room;
    }
    assertCanManage(property, user) {
        const isOwner = property.ownerId.toString() === user._id.toString();
        const isAgent = property.agentId?.toString() === user._id.toString();
        const isAdmin = user.role === user_schema_1.UserRole.ADMIN;
        if (!isOwner && !isAgent && !isAdmin) {
            throw new common_1.ForbiddenException('You can only manage your own properties');
        }
    }
    async fetchAndParseIcal(url) {
        const raw = await this.fetchUrl(url);
        return this.parseIcalEvents(raw);
    }
    fetchUrl(url) {
        return new Promise((resolve, reject) => {
            const lib = url.startsWith('https') ? require('https') : require('http');
            let data = '';
            lib.get(url, (res) => {
                if (res.statusCode !== 200) {
                    reject(new Error(`HTTP ${res.statusCode} fetching iCal: ${url}`));
                    return;
                }
                res.on('data', (chunk) => (data += chunk));
                res.on('end', () => resolve(data));
                res.on('error', reject);
            }).on('error', reject);
        });
    }
    parseIcalEvents(raw) {
        const results = [];
        const events = raw.split('BEGIN:VEVENT');
        for (let i = 1; i < events.length; i++) {
            const block = events[i];
            const dtStartMatch = block.match(/DTSTART(?:;[^:]+)?:(\d{8}(?:T\d{6}Z?)?)/);
            const dtEndMatch = block.match(/DTEND(?:;[^:]+)?:(\d{8}(?:T\d{6}Z?)?)/);
            const summaryMatch = block.match(/SUMMARY:([^\r\n]*)/);
            if (!dtStartMatch || !dtEndMatch)
                continue;
            const from = this.parseIcalDate(dtStartMatch[1]);
            const to = this.parseIcalDate(dtEndMatch[1]);
            const reason = summaryMatch ? summaryMatch[1].trim() : 'external_booking';
            if (from && to && to > from) {
                results.push({ from, to, reason, source: 'ical' });
            }
        }
        return results;
    }
    parseIcalDate(str) {
        try {
            const y = str.slice(0, 4);
            const m = str.slice(4, 6);
            const d = str.slice(6, 8);
            if (str.length === 8) {
                return new Date(`${y}-${m}-${d}T00:00:00Z`);
            }
            const h = str.slice(9, 11);
            const mm = str.slice(11, 13);
            const s = str.slice(13, 15);
            return new Date(`${y}-${m}-${d}T${h}:${mm}:${s}Z`);
        }
        catch {
            return null;
        }
    }
};
exports.RoomsService = RoomsService;
exports.RoomsService = RoomsService = RoomsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(room_schema_1.Room.name)),
    __param(1, (0, mongoose_1.InjectModel)(booking_schema_1.Booking.name)),
    __param(2, (0, mongoose_1.InjectModel)(property_schema_1.Property.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model])
], RoomsService);
//# sourceMappingURL=rooms.service.js.map