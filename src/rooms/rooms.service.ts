import {
    Injectable,
    NotFoundException,
    BadRequestException,
    ForbiddenException,
    Logger,
    ConflictException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { Room, RoomDocument, RoomType } from './schemas/room.schema';
import { Booking, BookingDocument, BookingStatus } from '../bookings/schema/booking.schema';
import { Property, PropertyDocument, ListingType } from '../properties/schemas/property.schema';
import { User, UserRole } from '../users/schemas/user.schema';
import { uploadBufferToCloudinary, deleteFromCloudinary } from '../utils/cloudinary';
import {
    CreateRoomDto,
    UpdateRoomDto,
    BlockRoomDatesDto,
    UnblockRoomDatesDto,
    SetIcalUrlDto,
} from './dto/room.dto';

/** Property types that support multiple rooms */
const MULTI_ROOM_TYPES = ['hotel', 'motel', 'hostel', 'resort', 'guesthouse', 'serviced_apartment'];

export interface RoomAvailabilityResult {
    available: boolean;
    unavailableDates: { from: Date; to: Date; reason?: string; source?: string }[];
    bookedRanges: { checkIn: Date; checkOut: Date; bookingId: Types.ObjectId }[];
}

@Injectable()
export class RoomsService {
    private readonly logger = new Logger(RoomsService.name);

    constructor(
        @InjectModel(Room.name) private roomModel: Model<RoomDocument>,
        @InjectModel(Booking.name) private bookingModel: Model<BookingDocument>,
        @InjectModel(Property.name) private propertyModel: Model<PropertyDocument>,
    ) { }

    // ════════════════════════════════════════════════════════════════════════════
    // CRUD
    // ════════════════════════════════════════════════════════════════════════════

    async createRoom(dto: CreateRoomDto, user: User): Promise<Room> {
        const property = await this.propertyModel.findById(dto.propertyId).exec();
        if (!property) throw new NotFoundException('Property not found');

        this.assertCanManage(property, user);

        if (!MULTI_ROOM_TYPES.includes(property.type)) {
            throw new BadRequestException(
                `Rooms can only be added to hotel/motel/hostel/resort properties. ` +
                `This property is of type "${property.type}". ` +
                `Supported types: ${MULTI_ROOM_TYPES.join(', ')}.`,
            );
        }

        if (property.listingType !== ListingType.SHORT_TERM) {
            throw new BadRequestException(
                'Rooms can only be added to short-term listings.',
            );
        }

        const room = new this.roomModel({
            propertyId: new Types.ObjectId(dto.propertyId),
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

    async getRoomsByProperty(
        propertyId: string,
        includeInactive = false,
    ): Promise<Room[]> {
        if (!Types.ObjectId.isValid(propertyId)) {
            throw new BadRequestException('Invalid property ID');
        }

        const query: any = { propertyId: new Types.ObjectId(propertyId) };
        if (!includeInactive) query.isActive = true;

        return this.roomModel.find(query).sort({ roomNumber: 1, name: 1 }).exec();
    }

    async getRoomById(roomId: string): Promise<Room> {
        const room = await this.findRoomOrThrow(roomId);
        return room;
    }

    async updateRoom(roomId: string, dto: UpdateRoomDto, user: User): Promise<Room> {
        const room = await this.findRoomOrThrow(roomId);
        const property = await this.propertyModel.findById(room.propertyId).exec();
        if (!property) throw new NotFoundException('Parent property not found');

        this.assertCanManage(property, user);

        // Prevent changing propertyId via update
        const { propertyId: _removed, ...updateData } = dto as any;

        const updated = await this.roomModel
            .findByIdAndUpdate(roomId, updateData, { new: true })
            .exec();

        this.logger.log(`Room ${roomId} updated by user ${user._id}`);
        return updated!;
    }

    async deleteRoom(roomId: string, user: User): Promise<void> {
        const room = await this.findRoomOrThrow(roomId);
        const property = await this.propertyModel.findById(room.propertyId).exec();
        if (!property) throw new NotFoundException('Parent property not found');

        this.assertCanManage(property, user);

        // Soft delete — keep history of bookings intact
        await this.roomModel.findByIdAndUpdate(roomId, { isActive: false }).exec();
        this.logger.log(`Room ${roomId} deactivated by user ${user._id}`);
    }

    // ════════════════════════════════════════════════════════════════════════════
    // MEDIA (Images)
    // ════════════════════════════════════════════════════════════════════════════

    async uploadImages(
        roomId: string,
        files: { buffer: Buffer; filename?: string }[],
        user: User,
    ): Promise<Room> {
        const room = await this.findRoomOrThrow(roomId);
        const property = await this.propertyModel.findById(room.propertyId).exec();
        if (!property) throw new NotFoundException('Parent property not found');

        this.assertCanManage(property, user);

        const uploads = await Promise.all(
            files.map(async (file, index) => {
                const publicId = `room_${roomId}_${Date.now()}_${index}`;
                const result = await uploadBufferToCloudinary(file.buffer, {
                    publicId,
                    folder: 'horohouse/rooms/images',
                    resourceType: 'image',
                    transformation: [{ quality: 'auto', fetch_format: 'auto' }],
                });
                return { url: result.secure_url, publicId: result.public_id };
            })
        );

        // Append new uploads
        // @ts-ignore schema defines images as array of objects
        room.images = [...(room.images || []), ...uploads];
        await room.save();
        this.logger.log(`Uploaded ${uploads.length} images to room ${roomId}`);
        return room;
    }

    async deleteImage(roomId: string, imagePublicId: string, user: User): Promise<Room> {
        const room = await this.findRoomOrThrow(roomId);
        const property = await this.propertyModel.findById(room.propertyId).exec();
        if (!property) throw new NotFoundException('Parent property not found');

        this.assertCanManage(property, user);

        // Delete from Cloudinary
        try {
            await deleteFromCloudinary(imagePublicId);
        } catch (error) {
            this.logger.warn(`Failed to delete image ${imagePublicId} from Cloudinary:`, error);
        }

        const initialLength = room.images?.length || 0;
        room.images = (room.images || []).filter(img => img.publicId !== imagePublicId);

        if (room.images.length === initialLength) {
            throw new NotFoundException('Image not found on this room');
        }

        await room.save();
        this.logger.log(`Deleted image ${imagePublicId} from room ${roomId}`);
        return room;
    }

    // ════════════════════════════════════════════════════════════════════════════
    // DATE BLOCKING (manual — host / admin)
    // ════════════════════════════════════════════════════════════════════════════

    async blockRoomDates(roomId: string, dto: BlockRoomDatesDto, user: User): Promise<Room> {
        const room = await this.findRoomOrThrow(roomId);
        const property = await this.propertyModel.findById(room.propertyId).exec();
        if (!property) throw new NotFoundException('Parent property not found');

        this.assertCanManage(property, user);

        const newRanges = dto.ranges.map((r) => {
            const from = new Date(r.from);
            const to = new Date(r.to);
            if (isNaN(from.getTime()) || isNaN(to.getTime())) {
                throw new BadRequestException(`Invalid date range: ${r.from} → ${r.to}`);
            }
            if (to <= from) {
                throw new BadRequestException(`"to" must be after "from" in range: ${r.from} → ${r.to}`);
            }
            return { from, to, reason: r.reason, source: 'manual' };
        });

        const updated = await this.roomModel
            .findByIdAndUpdate(
                roomId,
                { $push: { unavailableDates: { $each: newRanges } } },
                { new: true },
            )
            .exec();

        this.logger.log(`Blocked ${newRanges.length} range(s) on room ${roomId}`);
        return updated!;
    }

    async unblockRoomDates(roomId: string, dto: UnblockRoomDatesDto, user: User): Promise<Room> {
        const room = await this.findRoomOrThrow(roomId);
        const property = await this.propertyModel.findById(room.propertyId).exec();
        if (!property) throw new NotFoundException('Parent property not found');

        this.assertCanManage(property, user);

        const fromDates = dto.fromDates.map((d) => {
            const parsed = new Date(d);
            if (isNaN(parsed.getTime())) throw new BadRequestException(`Invalid date: ${d}`);
            return parsed;
        });

        const updated = await this.roomModel
            .findByIdAndUpdate(
                roomId,
                { $pull: { unavailableDates: { from: { $in: fromDates }, source: 'manual' } } },
                { new: true },
            )
            .exec();

        this.logger.log(`Unblocked ${fromDates.length} range(s) on room ${roomId}`);
        return updated!;
    }

    // ════════════════════════════════════════════════════════════════════════════
    // iCAL SYNC
    // ════════════════════════════════════════════════════════════════════════════

    async setIcalUrl(roomId: string, dto: SetIcalUrlDto, user: User): Promise<Room> {
        const room = await this.findRoomOrThrow(roomId);
        const property = await this.propertyModel.findById(room.propertyId).exec();
        if (!property) throw new NotFoundException('Parent property not found');

        this.assertCanManage(property, user);

        const updated = await this.roomModel
            .findByIdAndUpdate(
                roomId,
                { icalUrl: dto.icalUrl, icalLastSyncedAt: null, icalSyncedRangesCount: 0 },
                { new: true },
            )
            .exec();

        this.logger.log(`iCal URL set on room ${roomId}: ${dto.icalUrl}`);
        return updated!;
    }

    /**
     * Fetch and parse the iCal feed for a room, then upsert blocked date ranges.
     * Source is marked as 'ical' so they can be purged cleanly on re-sync.
     * Returns the number of new ranges imported.
     */
    async syncIcal(roomId: string): Promise<{ synced: number; roomId: string }> {
        const room = await this.findRoomOrThrow(roomId);

        if (!room.icalUrl) {
            throw new BadRequestException('No iCal URL set for this room');
        }

        const ranges = await this.fetchAndParseIcal(room.icalUrl);

        // Remove all previous ical-sourced blocks, replace with fresh data
        await this.roomModel.findByIdAndUpdate(roomId, {
            $pull: { unavailableDates: { source: 'ical' } },
        }).exec();

        if (ranges.length > 0) {
            await this.roomModel.findByIdAndUpdate(roomId, {
                $push: { unavailableDates: { $each: ranges } },
                icalLastSyncedAt: new Date(),
                icalSyncedRangesCount: ranges.length,
            }).exec();
        } else {
            await this.roomModel.findByIdAndUpdate(roomId, {
                icalLastSyncedAt: new Date(),
                icalSyncedRangesCount: 0,
            }).exec();
        }

        this.logger.log(`iCal sync complete for room ${roomId}: ${ranges.length} range(s) imported`);
        return { synced: ranges.length, roomId };
    }

    // ════════════════════════════════════════════════════════════════════════════
    // AVAILABILITY
    // ════════════════════════════════════════════════════════════════════════════

    async getRoomAvailability(
        roomId: string,
        from: Date,
        to: Date,
    ): Promise<RoomAvailabilityResult> {
        const room = await this.findRoomOrThrow(roomId);

        // 1. Host/iCal-blocked ranges
        const blocked = (room.unavailableDates ?? []).filter(
            (r) => new Date(r.from) < to && new Date(r.to) > from,
        );

        // 2. Platform bookings in range
        const platformBookings = await this.bookingModel
            .find({
                roomId: new Types.ObjectId(roomId),
                status: { $in: [BookingStatus.CONFIRMED, BookingStatus.PENDING] },
                checkIn: { $lt: to },
                checkOut: { $gt: from },
            })
            .select('checkIn checkOut _id')
            .lean()
            .exec() as { checkIn: Date; checkOut: Date; _id: Types.ObjectId }[];

        const bookedRanges = platformBookings.map((b) => ({
            checkIn: b.checkIn,
            checkOut: b.checkOut,
            bookingId: b._id,
        }));

        const available = blocked.length === 0 && bookedRanges.length === 0;

        return {
            available,
            unavailableDates: blocked as any[],
            bookedRanges,
        };
    }

    // ════════════════════════════════════════════════════════════════════════════
    // INTERNAL HELPERS (used by BookingsService)
    // ════════════════════════════════════════════════════════════════════════════

    /**
     * Checks if a specific room is available for a date range.
     * Called by BookingsService when a roomId is supplied in the booking request.
     */
    async assertRoomDatesAvailable(
        roomId: string,
        checkIn: Date,
        checkOut: Date,
        excludeBookingId?: string,
    ): Promise<void> {
        const room = await this.findRoomOrThrow(roomId);

        // Check manual / iCal blocks
        const blocked = (room.unavailableDates ?? []).some(
            (r) => new Date(r.from) < checkOut && new Date(r.to) > checkIn,
        );
        if (blocked) {
            throw new ConflictException('Selected dates are blocked on this room');
        }

        // Check platform bookings
        const filter: any = {
            roomId: new Types.ObjectId(roomId),
            status: { $in: [BookingStatus.CONFIRMED, BookingStatus.PENDING] },
            checkIn: { $lt: checkOut },
            checkOut: { $gt: checkIn },
        };
        if (excludeBookingId) {
            filter._id = { $ne: new Types.ObjectId(excludeBookingId) };
        }

        const conflict = await this.bookingModel
            .findOne(filter)
            .select('_id checkIn checkOut')
            .lean();

        if (conflict) {
            throw new ConflictException(
                `Room is already booked from ` +
                `${conflict.checkIn.toISOString().split('T')[0]} to ` +
                `${conflict.checkOut.toISOString().split('T')[0]}`,
            );
        }
    }

    // ════════════════════════════════════════════════════════════════════════════
    // PRIVATE
    // ════════════════════════════════════════════════════════════════════════════

    private async findRoomOrThrow(roomId: string): Promise<RoomDocument> {
        if (!Types.ObjectId.isValid(roomId)) {
            throw new BadRequestException('Invalid room ID');
        }
        const room = await this.roomModel.findById(roomId).exec();
        if (!room) throw new NotFoundException('Room not found');
        return room;
    }

    private assertCanManage(property: Property, user: User): void {
        const isOwner = property.ownerId.toString() === user._id.toString();
        const isAgent = property.agentId?.toString() === user._id.toString();
        const isAdmin = user.role === UserRole.ADMIN;
        if (!isOwner && !isAgent && !isAdmin) {
            throw new ForbiddenException('You can only manage your own properties');
        }
    }

    /**
     * Fetches an iCal feed and parses VEVENT DTSTART/DTEND pairs into
     * { from, to, reason, source } objects.
     * Uses the native `https`/`http` module — no extra dependencies needed.
     */
    async fetchAndParseIcal(
        url: string,
    ): Promise<{ from: Date; to: Date; reason: string; source: string }[]> {
        const raw = await this.fetchUrl(url);
        return this.parseIcalEvents(raw);
    }

    private fetchUrl(url: string): Promise<string> {
        return new Promise((resolve, reject) => {
            const lib = url.startsWith('https') ? require('https') : require('http');
            let data = '';
            lib.get(url, (res: any) => {
                if (res.statusCode !== 200) {
                    reject(new Error(`HTTP ${res.statusCode} fetching iCal: ${url}`));
                    return;
                }
                res.on('data', (chunk: any) => (data += chunk));
                res.on('end', () => resolve(data));
                res.on('error', reject);
            }).on('error', reject);
        });
    }

    private parseIcalEvents(
        raw: string,
    ): { from: Date; to: Date; reason: string; source: string }[] {
        const results: { from: Date; to: Date; reason: string; source: string }[] = [];
        const events = raw.split('BEGIN:VEVENT');

        for (let i = 1; i < events.length; i++) {
            const block = events[i];

            const dtStartMatch = block.match(/DTSTART(?:;[^:]+)?:(\d{8}(?:T\d{6}Z?)?)/);
            const dtEndMatch = block.match(/DTEND(?:;[^:]+)?:(\d{8}(?:T\d{6}Z?)?)/);
            const summaryMatch = block.match(/SUMMARY:([^\r\n]*)/);

            if (!dtStartMatch || !dtEndMatch) continue;

            const from = this.parseIcalDate(dtStartMatch[1]);
            const to = this.parseIcalDate(dtEndMatch[1]);
            const reason = summaryMatch ? summaryMatch[1].trim() : 'external_booking';

            if (from && to && to > from) {
                results.push({ from, to, reason, source: 'ical' });
            }
        }

        return results;
    }

    private parseIcalDate(str: string): Date | null {
        try {
            // Format: YYYYMMDD or YYYYMMDDTHHmmssZ
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
        } catch {
            return null;
        }
    }
}
