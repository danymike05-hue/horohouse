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
import { Booking, BookingDocument, BookingStatus, PaymentStatus } from '../bookings/schema/booking.schema';
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

/** iCal feeds: limits so a slow or huge feed can't hang or flood the server */
const ICAL_TIMEOUT_MS = 10_000;
const ICAL_MAX_BYTES = 5 * 1024 * 1024;

/**
 * Same rule as BookingsService: a booking holds its dates while it is paid, has no
 * deadline, or its deadline hasn't passed. Expired unpaid holds stop blocking the room.
 */
function activeHoldFilter(now = new Date()) {
    return {
        $or: [
            { paymentStatus: PaymentStatus.PAID },
            { expiresAt: { $exists: false } },
            { expiresAt: null },
            { expiresAt: { $gt: now } },
        ],
    };
}

/** Units of this room type (e.g. 10 "Standard" rooms). Older rooms without the field = 1. */
function roomCapacity(room: any): number {
    const q = Number(room?.quantity);
    return Number.isFinite(q) && q >= 1 ? Math.floor(q) : 1;
}

/** UTC day keys "YYYY-MM-DD" for every night in [checkIn, checkOut) */
function nightsOf(checkIn: Date, checkOut: Date): string[] {
    const out: string[] = [];
    const d = new Date(Date.UTC(checkIn.getUTCFullYear(), checkIn.getUTCMonth(), checkIn.getUTCDate()));
    for (let i = 0; d < checkOut && i < 730; i++) {
        out.push(d.toISOString().slice(0, 10));
        d.setUTCDate(d.getUTCDate() + 1);
    }
    return out;
}

export interface RoomAvailabilityResult {
    available: boolean;
    unavailableDates: { from: Date; to: Date; reason?: string; source?: string }[];
    bookedRanges: { checkIn: Date; checkOut: Date; bookingId: Types.ObjectId }[];
}

import { CoHostsService } from '../co-hosts/co-hosts.service';
import { parseLegacyRooms } from './legacy-rooms.util';

@Injectable()
export class RoomsService {
    private readonly logger = new Logger(RoomsService.name);

    constructor(
        @InjectModel(Room.name) private roomModel: Model<RoomDocument>,
        @InjectModel(Booking.name) private bookingModel: Model<BookingDocument>,
        @InjectModel(Property.name) private propertyModel: Model<PropertyDocument>,
        private readonly coHosts: CoHostsService,
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
            sizeSqm: dto.sizeSqm,
            breakfastPrice: dto.breakfastPrice,
            quantity: Math.max(1, Math.floor(dto.quantity ?? 1)),
            description: dto.description,
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

        await this.convertLegacyRooms(propertyId);
        return this.roomModel.find(query).sort({ roomNumber: 1, name: 1 }).exec();
    }

    /**
     * Older hotels have their rooms only as "room:" keywords, so they couldn't be booked.
     * The first time their rooms are asked for, this creates real room records from those
     * keywords. It runs once per listing (claimed on the listing, so two requests at once
     * can't create the rooms twice) and never if the listing already has rooms.
     */
    private async convertLegacyRooms(propertyId: string): Promise<void> {
        try {
            const pid = new Types.ObjectId(propertyId);
            if (await this.roomModel.exists({ propertyId: pid })) return;
            const claimed: any = await this.propertyModel
                .findOneAndUpdate(
                    { _id: pid, keywords: { $regex: '^room:' }, legacyRoomsConvertedAt: { $exists: false } },
                    { $set: { legacyRoomsConvertedAt: new Date() } },
                    { strict: false, strictQuery: false, new: true, projection: { keywords: 1 } } as any,
                )
                .lean()
                .exec();
            if (!claimed) return;
            const rooms = parseLegacyRooms(claimed.keywords);
            if (!rooms.length) return;
            try {
                await this.roomModel.insertMany(rooms.map((room) => ({ ...room, propertyId: pid, isActive: true })));
            } catch (err) {
                // Let a later request try again.
                await this.propertyModel.updateOne({ _id: pid }, { $unset: { legacyRoomsConvertedAt: 1 } }, { strict: false } as any);
                throw err;
            }
            this.logger.log(`Listing ${propertyId}: created ${rooms.length} room type(s) from its old room keywords`);
        } catch (err: any) {
            // The list still loads; the listing just stays as it was.
            this.logger.warn(`Listing ${propertyId}: old room keywords not converted: ${err?.message}`);
        }
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

        await this.assertCanManageCalendar(property, user);

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

        await this.assertCanManageCalendar(property, user);

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

        await this.assertCanManageCalendar(property, user);
        // Calendar apps often share webcal:// links — same feed over https.
        const icalUrl = String(dto.icalUrl ?? '').trim().replace(/^webcal:\/\//i, 'https://');
        this.assertSafeIcalUrl(icalUrl);

        const updated = await this.roomModel
            .findByIdAndUpdate(
                roomId,
                { icalUrl, icalLastSyncedAt: null, icalSyncedRangesCount: 0 },
                { new: true },
            )
            .exec();

        this.logger.log(`iCal URL set on room ${roomId}: ${icalUrl}`);
        return updated!;
    }

    /**
     * Fetch and parse the iCal feed for a room, then upsert blocked date ranges.
     * Source is marked as 'ical' so they can be purged cleanly on re-sync.
     * Returns the number of new ranges imported.
     */
    async syncIcal(roomId: string, user?: User): Promise<{ synced: number; roomId: string }> {
        const room = await this.findRoomOrThrow(roomId);

        // From the API: only the room's manager. Internal jobs call it without a user.
        if (user) {
            const property = await this.propertyModel.findById(room.propertyId).exec();
            if (!property) throw new NotFoundException('Parent property not found');
            await this.assertCanManageCalendar(property, user);
        }

        if (!room.icalUrl) {
            throw new BadRequestException('No iCal URL set for this room');
        }
        this.assertSafeIcalUrl(room.icalUrl);

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

        // 2. Platform bookings in range that still hold their dates
        const platformBookings = await this.bookingModel
            .find({
                roomId: new Types.ObjectId(roomId),
                status: { $in: [BookingStatus.CONFIRMED, BookingStatus.PENDING] },
                checkIn: { $lt: to },
                checkOut: { $gt: from },
                ...activeHoldFilter(),
            })
            .select('checkIn checkOut _id')
            .lean()
            .exec() as { checkIn: Date; checkOut: Date; _id: Types.ObjectId }[];

        // With several units of this type, a night is only unavailable once all are taken.
        // Return one 1-night range per full night so every client can read it directly.
        const capacity = roomCapacity(room);
        let bookedRanges: { checkIn: Date; checkOut: Date; bookingId: Types.ObjectId }[];
        if (capacity === 1) {
            bookedRanges = platformBookings.map((b) => ({ checkIn: b.checkIn, checkOut: b.checkOut, bookingId: b._id }));
        } else {
            const counts = new Map<string, number>();
            platformBookings.forEach((b) => nightsOf(b.checkIn, b.checkOut).forEach((n) => counts.set(n, (counts.get(n) ?? 0) + 1)));
            bookedRanges = [...counts.entries()]
                .filter(([, n]) => n >= capacity)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([night]) => {
                    const start = new Date(`${night}T00:00:00Z`);
                    const end = new Date(start); end.setUTCDate(end.getUTCDate() + 1);
                    return { checkIn: start, checkOut: end, bookingId: undefined as any };
                });
        }

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

        // Check platform bookings that still hold their dates
        const filter: any = {
            roomId: new Types.ObjectId(roomId),
            status: { $in: [BookingStatus.CONFIRMED, BookingStatus.PENDING] },
            checkIn: { $lt: checkOut },
            checkOut: { $gt: checkIn },
            ...activeHoldFilter(),
        };
        if (excludeBookingId) {
            filter._id = { $ne: new Types.ObjectId(excludeBookingId) };
        }

        const overlapping = await this.bookingModel
            .find(filter)
            .select('_id checkIn checkOut')
            .lean()
            .exec() as { checkIn: Date; checkOut: Date }[];

        // Full only when every unit of this type is taken on at least one of the nights.
        const capacity = roomCapacity(room);
        const wanted = new Set(nightsOf(checkIn, checkOut));
        const counts = new Map<string, number>();
        for (const b of overlapping) {
            for (const n of nightsOf(b.checkIn, b.checkOut)) {
                if (!wanted.has(n)) continue;
                const c = (counts.get(n) ?? 0) + 1;
                counts.set(n, c);
                if (c >= capacity) {
                    throw new ConflictException(
                        capacity === 1
                            ? `Room is already booked on ${n}`
                            : `All ${capacity} rooms of this type are booked on ${n}`,
                    );
                }
            }
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

    /** The calendar is the one part of a listing its co-hosts can also run. */
    private async assertCanManageCalendar(property: any, user: User): Promise<void> {
      try {
        this.assertCanManage(property, user);
      } catch (err) {
        if (!(await this.coHosts.isActive(user._id, property._id))) throw err;
      }
    }

    /** For upload routes: refuse before the upload is read */
    async assertCanManageRoom(roomId: string, user: User): Promise<void> {
        const room = await this.findRoomOrThrow(roomId);
        const property = await this.propertyModel.findById(room.propertyId).exec();
        if (!property) throw new NotFoundException('Parent property not found');
        this.assertCanManage(property, user);
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
        this.assertSafeIcalUrl(url);
        return new Promise((resolve, reject) => {
            const https = require('https');
            let data = '';
            let size = 0;
            const req = https.get(url, { timeout: ICAL_TIMEOUT_MS }, (res: any) => {
                if (res.statusCode !== 200) {
                    res.resume();
                    reject(new Error(`HTTP ${res.statusCode} fetching iCal: ${url}`));
                    return;
                }
                res.setEncoding('utf8');
                res.on('data', (chunk: string) => {
                    size += Buffer.byteLength(chunk);
                    if (size > ICAL_MAX_BYTES) {
                        req.destroy(new Error('iCal feed is too large'));
                        return;
                    }
                    data += chunk;
                });
                res.on('end', () => resolve(data));
                res.on('error', reject);
            });
            req.on('timeout', () => req.destroy(new Error('iCal feed timed out')));
            req.on('error', reject);
        });
    }

    /**
     * The server fetches this URL, so only public HTTPS hosts: no http://, localhost,
     * private / link-local IPs (cloud metadata) or internal names.
     * Note: a public hostname can still resolve to a private IP; for full protection,
     * resolve the host with dns.lookup and re-check the address before fetching.
     */
    private assertSafeIcalUrl(raw: string): void {
        let u: URL;
        try {
            u = new URL(raw);
        } catch {
            throw new BadRequestException('Invalid iCal URL');
        }
        if (u.protocol !== 'https:') throw new BadRequestException('The iCal link must start with https://');
        const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, '');
        const isPrivateV4 = /^(127\.|10\.|192\.168\.|169\.254\.|0\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host);
        const isPrivateV6 = host === '::1' || /^f[cd][0-9a-f]{2}:/.test(host) || /^fe80:/.test(host);
        const isInternalName = host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal') || host.endsWith('.local') || !host.includes('.');
        if (isPrivateV4 || isPrivateV6 || isInternalName) {
            throw new BadRequestException('This iCal link is not allowed');
        }
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
