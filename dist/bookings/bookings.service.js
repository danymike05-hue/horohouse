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
var BookingsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.BookingsService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const booking_schema_1 = require("./schema/booking.schema");
const property_schema_1 = require("../properties/schemas/property.schema");
const user_schema_1 = require("../users/schemas/user.schema");
const rooms_service_1 = require("../rooms/rooms.service");
const notifications_service_1 = require("../notifications/notifications.service");
const payments_service_1 = require("../payments/services/payments.service");
const SERVICE_FEE_RATE = 0;
const MAX_OPEN_HOLDS_PER_GUEST = 3;
const INSTANT_BOOK_PAYMENT_MINUTES = 30;
const REQUEST_RESPONSE_HOURS = 48;
const PAYMENT_AFTER_ACCEPT_HOURS = 24;
function activeHoldFilter(now = new Date()) {
    return {
        $or: [
            { paymentStatus: booking_schema_1.PaymentStatus.PAID },
            { expiresAt: { $exists: false } },
            { expiresAt: null },
            { expiresAt: { $gt: now } },
        ],
    };
}
let BookingsService = BookingsService_1 = class BookingsService {
    bookingModel;
    propertyModel;
    userModel;
    roomsService;
    notificationsService;
    paymentsService;
    logger = new common_1.Logger(BookingsService_1.name);
    constructor(bookingModel, propertyModel, userModel, roomsService, notificationsService, paymentsService) {
        this.bookingModel = bookingModel;
        this.propertyModel = propertyModel;
        this.userModel = userModel;
        this.roomsService = roomsService;
        this.notificationsService = notificationsService;
        this.paymentsService = paymentsService;
    }
    async createBooking(dto, guest) {
        const property = await this.propertyModel
            .findById(dto.propertyId)
            .populate('ownerId', 'name email phoneNumber')
            .exec();
        if (!property) {
            throw new common_1.NotFoundException('Property not found');
        }
        if (property.approvalStatus !== property_schema_1.ApprovalStatus.APPROVED || !property.isActive) {
            throw new common_1.BadRequestException('This property is not available for booking');
        }
        if (property.listingType !== 'short_term') {
            throw new common_1.BadRequestException('This property does not accept short-term bookings. Use the inquiry system instead.');
        }
        if (property.availability !== property_schema_1.PropertyStatus.ACTIVE) {
            throw new common_1.BadRequestException('This property is not currently available');
        }
        const checkIn = new Date(dto.checkIn);
        const checkOut = new Date(dto.checkOut);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (isNaN(checkIn.getTime()) || isNaN(checkOut.getTime())) {
            throw new common_1.BadRequestException('Invalid check-in or check-out date');
        }
        if (checkIn < today) {
            throw new common_1.BadRequestException('Check-in date cannot be in the past');
        }
        if (checkOut <= checkIn) {
            throw new common_1.BadRequestException('Check-out must be after check-in');
        }
        const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
        const minNights = property.minNights ?? 1;
        const maxNights = property.maxNights ?? 365;
        if (nights < minNights) {
            throw new common_1.BadRequestException(`Minimum stay for this property is ${minNights} night(s)`);
        }
        if (nights > maxNights) {
            throw new common_1.BadRequestException(`Maximum stay for this property is ${maxNights} night(s)`);
        }
        const advanceNoticeDays = Math.max(Number(property.noticeDays ?? 0), Number(property.advanceNoticeDays ?? 0));
        const windowMonths = property.windowMonths;
        const bookingWindowDays = windowMonths === null
            ? Number.POSITIVE_INFINITY
            : typeof windowMonths === 'number' && windowMonths > 0
                ? Math.round(windowMonths * 30.44)
                : Number(property.bookingWindowDays ?? 365);
        const daysTilCheckin = Math.ceil((checkIn.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        if (daysTilCheckin < advanceNoticeDays) {
            throw new common_1.BadRequestException(`This property requires at least ${advanceNoticeDays} day(s) advance notice before check-in`);
        }
        if (daysTilCheckin > bookingWindowDays) {
            throw new common_1.BadRequestException(`Bookings can only be made up to ${bookingWindowDays} day(s) in advance for this property`);
        }
        let room = null;
        if (dto.roomId) {
            room = await this.roomsService.getRoomById(dto.roomId);
            if (String(room.propertyId) !== String(dto.propertyId)) {
                throw new common_1.BadRequestException('This room does not belong to this property');
            }
            if (room.isActive === false) {
                throw new common_1.BadRequestException('This room type is no longer available');
            }
        }
        const maxGuests = room?.maxGuests ?? property.shortTermAmenities?.maxGuests ?? 99;
        const totalGuests = dto.guests.adults + (dto.guests.children ?? 0);
        if (totalGuests > maxGuests) {
            throw new common_1.BadRequestException(`This property accommodates a maximum of ${maxGuests} guest(s)`);
        }
        const rules = property.houseRules ?? {};
        if (rules.childrenAllowed === false && (dto.guests.children ?? 0) > 0) {
            throw new common_1.BadRequestException('This place is not suitable for children (house rules).');
        }
        if (rules.infantsAllowed === false && (dto.guests.infants ?? 0) > 0) {
            throw new common_1.BadRequestException('This place is not suitable for infants (house rules).');
        }
        const now = new Date();
        const RESUME_MIN_MS = 5 * 60_000;
        const existingHold = await this.bookingModel.findOne({
            guestId: guest._id,
            propertyId: new mongoose_2.Types.ObjectId(dto.propertyId),
            roomId: dto.roomId ? new mongoose_2.Types.ObjectId(dto.roomId) : null,
            checkIn,
            checkOut,
            status: booking_schema_1.BookingStatus.PENDING,
            paymentStatus: { $ne: booking_schema_1.PaymentStatus.PAID },
            expiresAt: { $gt: now },
        }).exec();
        if (existingHold) {
            if (existingHold.expiresAt.getTime() > now.getTime() + RESUME_MIN_MS) {
                return existingHold;
            }
            await this.bookingModel.updateOne({ _id: existingHold._id, status: booking_schema_1.BookingStatus.PENDING, paymentStatus: { $ne: booking_schema_1.PaymentStatus.PAID } }, {
                $set: {
                    status: booking_schema_1.BookingStatus.CANCELLED,
                    cancellation: { cancelledBy: booking_schema_1.CancelledBy.SYSTEM, cancelledAt: now, reason: 'replaced_by_new_attempt', refundAmount: 0 },
                },
            });
        }
        const openHolds = await this.bookingModel.countDocuments({
            guestId: guest._id,
            status: booking_schema_1.BookingStatus.PENDING,
            paymentStatus: { $ne: booking_schema_1.PaymentStatus.PAID },
            expiresAt: { $gt: now },
        });
        if (openHolds >= MAX_OPEN_HOLDS_PER_GUEST) {
            throw new common_1.BadRequestException(`You already have ${openHolds} reservations waiting for payment or a host reply. ` +
                `Finish or cancel one before booking another.`);
        }
        if (dto.roomId) {
            await this.roomsService.assertRoomDatesAvailable(dto.roomId, checkIn, checkOut);
        }
        else {
            await this.assertDatesAvailable(dto.propertyId, checkIn, checkOut);
        }
        const priceBreakdown = this.computePrice(property, nights, room, checkIn, totalGuests);
        const rawHostRef = property.ownerId ?? property.agentId;
        const hostIdStr = rawHostRef?._id
            ? rawHostRef._id.toString()
            : rawHostRef?.toString();
        const validHostObjectId = hostIdStr && mongoose_2.Types.ObjectId.isValid(hostIdStr)
            ? new mongoose_2.Types.ObjectId(hostIdStr)
            : undefined;
        let guestVerified = false;
        if (property.instantBookRequiresVerifiedGuest) {
            const fresh = await this.userModel
                .findById(guest._id)
                .select('identityVerification.status hostProfile.verificationStatus')
                .lean()
                .exec();
            guestVerified =
                fresh?.identityVerification?.status === 'verified' ||
                    fresh?.hostProfile?.verificationStatus === 'verified';
        }
        const isInstantBook = !!property.isInstantBookable &&
            (!property.instantBookRequiresVerifiedGuest || guestVerified);
        const initialStatus = booking_schema_1.BookingStatus.PENDING;
        const confirmedAt = undefined;
        const expiresAt = isInstantBook
            ? new Date(Date.now() + INSTANT_BOOK_PAYMENT_MINUTES * 60 * 1000)
            : new Date(Date.now() + REQUEST_RESPONSE_HOURS * 60 * 60 * 1000);
        const booking = new this.bookingModel({
            propertyId: new mongoose_2.Types.ObjectId(dto.propertyId),
            ...(dto.roomId ? { roomId: new mongoose_2.Types.ObjectId(dto.roomId) } : {}),
            guestId: guest._id,
            ...(validHostObjectId ? { hostId: validHostObjectId } : {}),
            checkIn,
            checkOut,
            nights,
            guests: {
                adults: dto.guests.adults,
                children: dto.guests.children ?? 0,
                infants: dto.guests.infants ?? 0,
                pets: dto.guests.pets ?? 0,
            },
            priceBreakdown,
            currency: dto.currency ?? property.currency ?? 'XAF',
            status: initialStatus,
            paymentStatus: booking_schema_1.PaymentStatus.UNPAID,
            isInstantBook,
            confirmedAt,
            expiresAt,
            guestNote: dto.guestNote,
        });
        const saved = await booking.save();
        const fmt = (d) => d.toISOString().split('T')[0];
        const propertyTitle = property.title ?? 'your property';
        const guestIdStr = guest._id.toString();
        const bookingIdStr = saved._id.toString();
        try {
            if (isInstantBook) {
            }
            else {
                await this.notificationsService.notifyBookingRequest(hostIdStr ?? '', {
                    guestId: guestIdStr,
                    bookingId: bookingIdStr,
                    propertyId: dto.propertyId,
                    propertyTitle,
                    guestName: guest.name,
                    checkIn: fmt(checkIn),
                    checkOut: fmt(checkOut),
                });
            }
        }
        catch (notifErr) {
            this.logger.warn(`createBooking: notification delivery failed for booking ${bookingIdStr}: ${notifErr?.message}`);
        }
        return saved;
    }
    async cancelBooking(bookingId, dto, user) {
        const booking = await this.findBookingOrThrow(bookingId);
        const isGuest = booking.guestId.toString() === user._id.toString();
        const isHost = booking.hostId.toString() === user._id.toString();
        const isAdmin = user.role === user_schema_1.UserRole.ADMIN;
        if (!isGuest && !isHost && !isAdmin) {
            throw new common_1.ForbiddenException('You are not authorized to cancel this booking');
        }
        const cancellableStatuses = [booking_schema_1.BookingStatus.PENDING, booking_schema_1.BookingStatus.CONFIRMED];
        if (!cancellableStatuses.includes(booking.status)) {
            throw new common_1.BadRequestException(`Cannot cancel a booking with status "${booking.status}"`);
        }
        const cancelledBy = isAdmin
            ? booking_schema_1.CancelledBy.ADMIN
            : isGuest
                ? booking_schema_1.CancelledBy.GUEST
                : booking_schema_1.CancelledBy.HOST;
        const refundAmount = await this.computeRefund(booking, cancelledBy);
        const updated = await this.bookingModel
            .findByIdAndUpdate(bookingId, {
            status: booking_schema_1.BookingStatus.CANCELLED,
            cancellation: {
                cancelledBy,
                cancelledAt: new Date(),
                reason: dto.reason,
                refundAmount,
                refundStatus: refundAmount > 0 ? 'pending' : undefined,
            },
        }, { new: true })
            .exec();
        this.logger.log(`Booking ${bookingId} cancelled by ${cancelledBy}`);
        if (refundAmount > 0) {
            try {
                await this.paymentsService.processBookingRefund(bookingId, refundAmount, dto.reason);
            }
            catch (refundErr) {
                this.logger.error(`cancelBooking: Refund failed for booking ${bookingId}: ${refundErr.message}. ` +
                    `Manual refund required.`);
            }
        }
        try {
            const [property, guest, host] = await Promise.all([
                this.propertyModel.findById(booking.propertyId).select('title').lean(),
                this.userModel.findById(booking.guestId).select('name').lean(),
                this.userModel.findById(booking.hostId).select('name').lean(),
            ]);
            const fmt = (d) => new Date(d).toISOString().split('T')[0];
            await this.notificationsService.notifyBookingCancelled({
                guestId: booking.guestId.toString(),
                hostId: booking.hostId.toString(),
                bookingId,
                propertyId: booking.propertyId.toString(),
                propertyTitle: property?.title ?? 'the property',
                guestName: guest?.name ?? 'Guest',
                hostName: host?.name ?? 'Host',
                checkIn: fmt(booking.checkIn),
                checkOut: fmt(booking.checkOut),
                cancelledByGuest: cancelledBy === booking_schema_1.CancelledBy.GUEST,
            });
        }
        catch (notifErr) {
            this.logger.warn(`cancelBooking: notification failed for ${bookingId}: ${notifErr.message}`);
        }
        return updated;
    }
    async getGuestBookings(guestId, query) {
        return this.paginateBookings({ guestId: new mongoose_2.Types.ObjectId(guestId) }, query);
    }
    async confirmBooking(bookingId, dto, host) {
        const booking = await this.findBookingOrThrow(bookingId);
        this.assertIsHost(booking, host);
        if (booking.status !== booking_schema_1.BookingStatus.PENDING) {
            throw new common_1.BadRequestException(`Only PENDING bookings can be confirmed. Current status: ${booking.status}`);
        }
        if (booking.isInstantBook) {
            throw new common_1.BadRequestException('Instant bookings are confirmed when the guest pays — there is nothing to approve');
        }
        if (booking.expiresAt && booking.expiresAt.getTime() <= Date.now() && booking.paymentStatus !== booking_schema_1.PaymentStatus.PAID) {
            throw new common_1.BadRequestException('This request has expired. The guest needs to send a new one.');
        }
        if (booking.roomId) {
            await this.roomsService.assertRoomDatesAvailable(booking.roomId.toString(), booking.checkIn, booking.checkOut, bookingId);
        }
        else {
            await this.assertDatesAvailable(booking.propertyId.toString(), booking.checkIn, booking.checkOut, bookingId);
        }
        const paymentDeadline = new Date(Date.now() + PAYMENT_AFTER_ACCEPT_HOURS * 60 * 60 * 1000);
        const updated = await this.bookingModel
            .findByIdAndUpdate(bookingId, {
            status: booking_schema_1.BookingStatus.CONFIRMED,
            confirmedAt: new Date(),
            hostNote: dto.hostNote,
            expiresAt: paymentDeadline,
        }, { new: true })
            .exec();
        const property = await this.propertyModel.findById(booking.propertyId).select('title').lean();
        const fmt = (d) => d.toISOString().split('T')[0];
        await this.notificationsService.notifyBookingConfirmed(booking.guestId.toString(), {
            bookingId: bookingId,
            propertyId: booking.propertyId.toString(),
            propertyTitle: property?.title ?? 'your property',
            hostName: host.name,
            checkIn: fmt(booking.checkIn),
            checkOut: fmt(booking.checkOut),
        });
        this.logger.log(`Booking ${bookingId} confirmed by host ${host._id}`);
        return updated;
    }
    async rejectBooking(bookingId, dto, host) {
        const booking = await this.findBookingOrThrow(bookingId);
        this.assertIsHost(booking, host);
        if (booking.status !== booking_schema_1.BookingStatus.PENDING) {
            throw new common_1.BadRequestException('Only PENDING bookings can be rejected');
        }
        const updated = await this.bookingModel
            .findByIdAndUpdate(bookingId, {
            status: booking_schema_1.BookingStatus.REJECTED,
            hostNote: dto.hostNote,
            cancellation: {
                cancelledBy: booking_schema_1.CancelledBy.HOST,
                cancelledAt: new Date(),
                reason: dto.reason,
                refundAmount: 0,
            },
        }, { new: true })
            .exec();
        const property = await this.propertyModel.findById(booking.propertyId).select('title').lean();
        const fmt = (d) => d.toISOString().split('T')[0];
        await this.notificationsService.notifyBookingRejected(booking.guestId.toString(), {
            bookingId: bookingId,
            propertyId: booking.propertyId.toString(),
            propertyTitle: property?.title ?? 'your property',
            hostName: host.name,
            checkIn: fmt(booking.checkIn),
            checkOut: fmt(booking.checkOut),
        });
        this.logger.log(`Booking ${bookingId} rejected by host ${host._id}`);
        return updated;
    }
    async completeBooking(bookingId, host) {
        const booking = await this.findBookingOrThrow(bookingId);
        this.assertIsHost(booking, host);
        return this.markCompleted(booking);
    }
    async completeFinishedStays(batchSize = 100) {
        const cutoff = new Date(Date.now() - 12 * 60 * 60 * 1000);
        const due = await this.bookingModel
            .find({
            status: booking_schema_1.BookingStatus.CONFIRMED,
            paymentStatus: booking_schema_1.PaymentStatus.PAID,
            checkOut: { $lte: cutoff },
        })
            .limit(batchSize)
            .exec();
        let done = 0;
        for (const booking of due) {
            try {
                await this.markCompleted(booking);
                done++;
            }
            catch (err) {
                this.logger.warn(`completeFinishedStays: ${booking._id}: ${err?.message}`);
            }
        }
        return done;
    }
    async markCompleted(booking) {
        const bookingId = booking._id.toString();
        if (booking.status !== booking_schema_1.BookingStatus.CONFIRMED) {
            throw new common_1.BadRequestException('Only CONFIRMED bookings can be completed');
        }
        if (booking.paymentStatus !== booking_schema_1.PaymentStatus.PAID) {
            throw new common_1.BadRequestException('This stay was never paid, so it can’t be completed');
        }
        const checkoutDay = new Date(booking.checkOut);
        checkoutDay.setUTCHours(0, 0, 0, 0);
        if (checkoutDay.getTime() > Date.now()) {
            throw new common_1.BadRequestException('You can mark the stay as completed from the check-out day');
        }
        const updated = await this.bookingModel
            .findByIdAndUpdate(bookingId, {
            status: booking_schema_1.BookingStatus.COMPLETED,
            actualCheckOut: new Date(),
        }, { new: true })
            .exec();
        this.logger.log(`Booking ${bookingId} marked as completed`);
        try {
            const [property, guest] = await Promise.all([
                this.propertyModel.findById(booking.propertyId).select('title').lean(),
                this.userModel.findById(booking.guestId).select('name').lean(),
            ]);
            await this.notificationsService.notifyBookingCompleted({
                guestId: booking.guestId.toString(),
                hostId: booking.hostId.toString(),
                bookingId,
                propertyId: booking.propertyId.toString(),
                propertyTitle: property?.title ?? 'the property',
                guestName: guest?.name ?? 'Guest',
            });
        }
        catch (notifErr) {
            this.logger.warn(`completeBooking: notification failed for ${bookingId}: ${notifErr.message}`);
        }
        return updated;
    }
    async getHostBookings(hostId, query) {
        return this.paginateBookings({ hostId: new mongoose_2.Types.ObjectId(hostId) }, query);
    }
    async getPropertyBookings(propertyId, query, user) {
        await this.assertCanManageProperty(propertyId, user);
        return this.paginateBookings({ propertyId: new mongoose_2.Types.ObjectId(propertyId) }, query);
    }
    async getHostStats(hostId) {
        const hostObjectId = new mongoose_2.Types.ObjectId(hostId);
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const [bookingStats, propertyStats] = await Promise.all([
            this.bookingModel.aggregate([
                { $match: { hostId: hostObjectId } },
                {
                    $facet: {
                        completedStays: [
                            { $match: { status: { $in: ['completed', 'checked_out'] } } },
                            { $count: 'total' },
                        ],
                        currentMonthEarnings: [
                            {
                                $match: {
                                    status: { $in: ['confirmed', 'completed', 'checked_out'] },
                                    checkIn: { $gte: monthStart },
                                },
                            },
                            { $group: { _id: null, total: { $sum: '$priceBreakdown.totalAmount' } } },
                        ],
                        occupiedPropertyIds: [
                            {
                                $match: {
                                    status: { $in: ['confirmed', 'checked_in'] },
                                    checkIn: { $lte: now },
                                    checkOut: { $gte: now },
                                },
                            },
                            { $group: { _id: '$propertyId' } },
                        ],
                    }
                },
            ]),
            this.propertyModel.aggregate([
                { $match: { ownerId: hostObjectId, isActive: true } },
                {
                    $group: {
                        _id: null,
                        totalListings: { $sum: 1 },
                        avgRating: {
                            $avg: {
                                $cond: [{ $gt: ['$averageRating', 0] }, '$averageRating', null],
                            },
                        },
                    },
                },
            ]),
        ]);
        const bStats = bookingStats[0];
        const completedStays = bStats.completedStays[0]?.total ?? 0;
        const currentMonthEarnings = bStats.currentMonthEarnings[0]?.total ?? 0;
        const occupiedCount = bStats.occupiedPropertyIds.length;
        const totalListings = propertyStats[0]?.totalListings ?? 0;
        const avgRating = propertyStats[0]?.avgRating ?? 0;
        const occupancyRate = totalListings > 0 ? (occupiedCount / totalListings) * 100 : 0;
        const isSuperhost = completedStays >= 10 && avgRating >= 4.8;
        return {
            totalListings,
            completedStays,
            currentMonthEarnings,
            avgRating: Math.round(avgRating * 10) / 10,
            occupancyRate: Math.round(occupancyRate * 10) / 10,
            isSuperhost,
        };
    }
    async getAvailability(propertyId, from, to, roomId, opts = {}) {
        const property = await this.propertyModel.findById(propertyId).exec();
        if (!property)
            throw new common_1.NotFoundException('Property not found');
        if (roomId && opts.includeGuestDetails) {
            return this.getRoomAvailabilityForHost(propertyId, roomId, from, to);
        }
        if (roomId) {
            const roomResult = await this.roomsService.getRoomAvailability(roomId, from, to);
            return {
                available: roomResult.available,
                unavailableDates: roomResult.unavailableDates.map((r) => ({ from: r.from, to: r.to })),
                bookedRanges: roomResult.bookedRanges.map((r) => ({ checkIn: r.checkIn, checkOut: r.checkOut, roomId })),
            };
        }
        const hostBlockedRanges = (property.unavailableDates ?? []).filter((r) => r.from < to && r.to > from);
        const query = this.bookingModel
            .find({
            propertyId: new mongoose_2.Types.ObjectId(propertyId),
            $and: [
                { $or: [{ roomId: { $exists: false } }, { roomId: null }] },
                activeHoldFilter(),
            ],
            status: { $in: [booking_schema_1.BookingStatus.CONFIRMED, booking_schema_1.BookingStatus.PENDING, booking_schema_1.BookingStatus.COMPLETED] },
            checkIn: { $lt: to },
            checkOut: { $gt: from },
        })
            .select(opts.includeGuestDetails
            ? 'checkIn checkOut status guests priceBreakdown.totalAmount guestId'
            : 'checkIn checkOut');
        if (opts.includeGuestDetails)
            query.populate('guestId', 'name profilePicture');
        const bookings = await query.lean().exec();
        const bookedRanges = bookings.map((b) => {
            if (!opts.includeGuestDetails)
                return { checkIn: b.checkIn, checkOut: b.checkOut };
            const guestCount = (b.guests?.adults ?? 0) + (b.guests?.children ?? 0);
            return {
                checkIn: b.checkIn,
                checkOut: b.checkOut,
                status: b.status,
                guests: guestCount,
                guestCount,
                totalPrice: b.priceBreakdown?.totalAmount,
                guestName: b.guestId?.name ?? 'Guest',
                guestAvatar: b.guestId?.profilePicture ?? null,
                guest: b.guestId ? { name: b.guestId.name, profilePicture: b.guestId.profilePicture } : undefined,
            };
        });
        const available = hostBlockedRanges.length === 0 && bookedRanges.length === 0;
        return { available, unavailableDates: hostBlockedRanges, bookedRanges };
    }
    async getRoomAvailabilityForHost(propertyId, roomId, from, to) {
        const room = await this.roomsService.getRoomById(roomId);
        if (String(room.propertyId?._id ?? room.propertyId) !== String(propertyId)) {
            throw new common_1.NotFoundException('Room not found for this property');
        }
        const quantity = Number(room.quantity);
        const capacity = Number.isFinite(quantity) && quantity >= 1 ? Math.floor(quantity) : 1;
        const bookings = await this.bookingModel
            .find({
            roomId: new mongoose_2.Types.ObjectId(roomId),
            $and: [activeHoldFilter()],
            status: { $in: [booking_schema_1.BookingStatus.CONFIRMED, booking_schema_1.BookingStatus.PENDING, booking_schema_1.BookingStatus.COMPLETED] },
            checkIn: { $lt: to },
            checkOut: { $gt: from },
        })
            .select('checkIn checkOut status guests priceBreakdown.totalAmount guestId')
            .populate('guestId', 'name profilePicture')
            .sort({ checkIn: 1 })
            .lean()
            .exec();
        const bookedRanges = bookings.map((b) => {
            const guestCount = (b.guests?.adults ?? 0) + (b.guests?.children ?? 0);
            return {
                checkIn: b.checkIn,
                checkOut: b.checkOut,
                roomId,
                status: b.status,
                guests: guestCount,
                guestCount,
                totalPrice: b.priceBreakdown?.totalAmount,
                guestName: b.guestId?.name ?? 'Guest',
                guestAvatar: b.guestId?.profilePicture ?? null,
                guest: b.guestId ? { name: b.guestId.name, profilePicture: b.guestId.profilePicture } : undefined,
            };
        });
        const unavailableDates = (room.unavailableDates ?? [])
            .filter((r) => new Date(r.from) < to && new Date(r.to) > from)
            .map((r) => ({ from: r.from, to: r.to, reason: r.reason, source: r.source ?? 'manual' }));
        return {
            available: unavailableDates.length === 0 && bookedRanges.length < capacity,
            unavailableDates,
            bookedRanges,
            capacity,
        };
    }
    async expireOverdueBookings(batchSize = 200) {
        const now = new Date();
        const overdue = await this.bookingModel
            .find({
            status: { $in: [booking_schema_1.BookingStatus.PENDING, booking_schema_1.BookingStatus.CONFIRMED] },
            paymentStatus: { $ne: booking_schema_1.PaymentStatus.PAID },
            expiresAt: { $lte: now },
        })
            .select('_id status isInstantBook guestId hostId propertyId checkIn checkOut')
            .limit(batchSize)
            .lean()
            .exec();
        let expired = 0;
        for (const b of overdue) {
            const reason = b.status === booking_schema_1.BookingStatus.CONFIRMED
                ? 'payment_not_received_after_acceptance'
                : b.isInstantBook
                    ? 'payment_timeout'
                    : 'host_did_not_respond';
            const res = await this.bookingModel.updateOne({
                _id: b._id,
                status: { $in: [booking_schema_1.BookingStatus.PENDING, booking_schema_1.BookingStatus.CONFIRMED] },
                paymentStatus: { $ne: booking_schema_1.PaymentStatus.PAID },
            }, {
                $set: {
                    status: booking_schema_1.BookingStatus.CANCELLED,
                    cancellation: { cancelledBy: booking_schema_1.CancelledBy.SYSTEM, cancelledAt: now, reason, refundAmount: 0 },
                },
            });
            if (!res.modifiedCount)
                continue;
            expired++;
            try {
                const [property, guest, host] = await Promise.all([
                    this.propertyModel.findById(b.propertyId).select('title').lean(),
                    this.userModel.findById(b.guestId).select('name').lean(),
                    this.userModel.findById(b.hostId).select('name').lean(),
                ]);
                const fmt = (d) => new Date(d).toISOString().split('T')[0];
                await this.notificationsService.notifyBookingCancelled({
                    guestId: b.guestId.toString(),
                    hostId: b.hostId.toString(),
                    bookingId: b._id.toString(),
                    propertyId: b.propertyId.toString(),
                    propertyTitle: property?.title ?? 'the property',
                    guestName: guest?.name ?? 'Guest',
                    hostName: host?.name ?? 'Host',
                    checkIn: fmt(b.checkIn),
                    checkOut: fmt(b.checkOut),
                    cancelledByGuest: false,
                });
            }
            catch (err) {
                this.logger.warn(`expireOverdueBookings: notification failed for ${b._id}: ${err?.message}`);
            }
        }
        if (expired)
            this.logger.log(`Expired ${expired} unpaid booking(s)`);
        return expired;
    }
    async getAllBookings(query) {
        return this.paginateBookings({}, query);
    }
    async getBookingById(bookingId, user) {
        if (!mongoose_2.Types.ObjectId.isValid(bookingId))
            throw new common_1.BadRequestException('Invalid booking ID');
        const booking = await this.bookingModel
            .findById(bookingId)
            .populate('propertyId', 'title address city neighborhood images price cancellationPolicy isInstantBookable shortTermAmenities.checkInTime shortTermAmenities.checkOutTime shortTermAmenities.petsAllowed shortTermAmenities.smokingAllowed shortTermAmenities.partiesAllowed houseRules')
            .populate('guestId', 'name email phoneNumber profilePicture')
            .populate('hostId', 'name email phoneNumber profilePicture')
            .exec();
        if (!booking)
            throw new common_1.NotFoundException('Booking not found');
        const guestId = booking.guestId?._id ?? booking.guestId;
        const hostId = booking.hostId?._id ?? booking.hostId;
        const isGuest = guestId.toString() === user._id.toString();
        const isHost = hostId.toString() === user._id.toString();
        const isAdmin = user.role === user_schema_1.UserRole.ADMIN;
        if (!isGuest && !isHost && !isAdmin) {
            throw new common_1.ForbiddenException('You do not have access to this booking');
        }
        return booking;
    }
    async updatePayment(bookingId, dto) {
        const updateData = { paymentStatus: dto.paymentStatus };
        if (dto.paymentReference)
            updateData.paymentReference = dto.paymentReference;
        if (dto.paymentMethod)
            updateData.paymentMethod = dto.paymentMethod;
        if (dto.paymentStatus === 'paid')
            updateData.paidAt = new Date();
        const updated = await this.bookingModel
            .findByIdAndUpdate(bookingId, updateData, { new: true })
            .exec();
        if (!updated)
            throw new common_1.NotFoundException('Booking not found');
        return updated;
    }
    async getBookingStats() {
        const stats = await this.bookingModel.aggregate([
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 },
                    totalRevenue: { $sum: '$priceBreakdown.totalAmount' },
                },
            },
        ]);
        const totalBookings = await this.bookingModel.countDocuments();
        const totalRevenue = await this.bookingModel.aggregate([
            { $match: { status: { $in: [booking_schema_1.BookingStatus.CONFIRMED, booking_schema_1.BookingStatus.COMPLETED] } } },
            { $group: { _id: null, total: { $sum: '$priceBreakdown.totalAmount' } } },
        ]);
        return {
            totalBookings,
            totalRevenue: totalRevenue[0]?.total ?? 0,
            byStatus: stats.reduce((acc, s) => {
                acc[s._id] = { count: s.count, revenue: s.totalRevenue };
                return acc;
            }, {}),
        };
    }
    async assertDatesAvailable(propertyId, checkIn, checkOut, excludeBookingId) {
        const filter = {
            propertyId: new mongoose_2.Types.ObjectId(propertyId),
            status: { $in: [booking_schema_1.BookingStatus.CONFIRMED, booking_schema_1.BookingStatus.PENDING] },
            checkIn: { $lt: checkOut },
            checkOut: { $gt: checkIn },
            ...activeHoldFilter(),
        };
        if (excludeBookingId) {
            filter._id = { $ne: new mongoose_2.Types.ObjectId(excludeBookingId) };
        }
        const conflict = await this.bookingModel.findOne(filter).select('_id checkIn checkOut').lean();
        if (conflict) {
            throw new common_1.ConflictException(`The property is already booked from ` +
                `${conflict.checkIn.toISOString().split('T')[0]} to ` +
                `${conflict.checkOut.toISOString().split('T')[0]}`);
        }
        const property = await this.propertyModel
            .findById(propertyId)
            .select('unavailableDates')
            .lean()
            .exec();
        const blocked = (property?.unavailableDates ?? []);
        const isBlocked = blocked.some((r) => new Date(r.from) < checkOut && new Date(r.to) > checkIn);
        if (isBlocked) {
            throw new common_1.ConflictException('Selected dates are blocked by the host');
        }
    }
    computePrice(property, nights, room, checkIn, guests = 1) {
        const rates = this.nightlyRates(property, nights, room, checkIn);
        const included = Number(property.guestsIncluded) || 0;
        const feePerGuest = Number(property.extraGuestFee) || 0;
        const extraGuests = !room && included > 0 && feePerGuest > 0 ? Math.max(0, guests - included) : 0;
        const extraGuestFee = extraGuests * feePerGuest * nights;
        const subtotal = rates.reduce((sum, r) => sum + r, 0) + extraGuestFee;
        const pricePerNight = nights > 0 ? Math.round(subtotal / nights) : 0;
        const cleaningFee = room?.cleaningFee ?? property.cleaningFee ?? 0;
        const serviceFee = Math.round(subtotal * SERVICE_FEE_RATE);
        const taxAmount = 0;
        const discountAmount = this.computeDiscount(subtotal, nights, property.weeklyDiscountPercent ?? 0, property.monthlyDiscountPercent ?? 0, property.customDiscountNights, property.customDiscountPercent);
        const totalAmount = subtotal + cleaningFee + serviceFee + taxAmount - discountAmount;
        return {
            pricePerNight,
            nights,
            subtotal,
            cleaningFee,
            serviceFee,
            taxAmount,
            discountAmount,
            totalAmount,
            extraGuests,
            extraGuestFee,
        };
    }
    nightlyRates(property, nights, room, checkIn) {
        const base = Number(property.price ?? 0);
        if (room)
            return Array(nights).fill(Number(room.price ?? base));
        if (!checkIn)
            return Array(nights).fill(base);
        const overrides = property.priceOverrides ?? {};
        const weekend = Number(property.weekendPrice || 0);
        const d = new Date(Date.UTC(checkIn.getUTCFullYear(), checkIn.getUTCMonth(), checkIn.getUTCDate()));
        const rates = [];
        for (let i = 0; i < nights; i++) {
            const override = Number(overrides[d.toISOString().slice(0, 10)] || 0);
            const day = d.getUTCDay();
            rates.push(override > 0 ? override : weekend > 0 && (day === 5 || day === 6) ? weekend : base);
            d.setUTCDate(d.getUTCDate() + 1);
        }
        return rates;
    }
    computeDiscount(subtotal, nights, weeklyPct, monthlyPct, customNights, customPct) {
        let effectivePct = 0;
        if (nights >= 28 && monthlyPct > 0) {
            effectivePct = Math.max(effectivePct, monthlyPct);
        }
        if (nights >= 7 && weeklyPct > 0) {
            effectivePct = Math.max(effectivePct, weeklyPct);
        }
        if (customNights && customPct && nights >= customNights && customPct > 0) {
            effectivePct = Math.max(effectivePct, customPct);
        }
        return effectivePct > 0 ? Math.round(subtotal * (effectivePct / 100)) : 0;
    }
    async computeRefund(booking, cancelledBy = booking_schema_1.CancelledBy.GUEST) {
        if (booking.paymentStatus !== booking_schema_1.PaymentStatus.PAID)
            return 0;
        if (cancelledBy !== booking_schema_1.CancelledBy.GUEST)
            return booking.priceBreakdown.totalAmount;
        const property = await this.propertyModel
            .findById(booking.propertyId)
            .select('cancellationPolicy')
            .lean()
            .exec();
        const policy = property?.cancellationPolicy ?? 'flexible';
        const paidAmount = booking.priceBreakdown.totalAmount;
        const daysUntilCheckin = Math.ceil((booking.checkIn.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        switch (policy) {
            case 'flexible':
                return daysUntilCheckin >= 1 ? paidAmount : 0;
            case 'moderate':
                return daysUntilCheckin >= 5 ? paidAmount : 0;
            case 'strict':
                if (daysUntilCheckin >= 7)
                    return Math.round(paidAmount * 0.5);
                return 0;
            case 'no_refund':
            default:
                return 0;
        }
    }
    async getCancellationPreview(bookingId, user) {
        const booking = await this.findBookingOrThrow(bookingId);
        const isGuest = booking.guestId.toString() === user._id.toString();
        const isHost = booking.hostId.toString() === user._id.toString();
        const isAdmin = user.role === user_schema_1.UserRole.ADMIN;
        if (!isGuest && !isHost && !isAdmin) {
            throw new common_1.ForbiddenException('You are not authorized to view this booking');
        }
        const cancelledBy = isAdmin ? booking_schema_1.CancelledBy.ADMIN : isGuest ? booking_schema_1.CancelledBy.GUEST : booking_schema_1.CancelledBy.HOST;
        const property = await this.propertyModel.findById(booking.propertyId).select('cancellationPolicy').lean().exec();
        const paid = booking.paymentStatus === booking_schema_1.PaymentStatus.PAID;
        return {
            canCancel: [booking_schema_1.BookingStatus.PENDING, booking_schema_1.BookingStatus.CONFIRMED].includes(booking.status),
            cancelledBy,
            paidAmount: paid ? booking.priceBreakdown.totalAmount : 0,
            refundAmount: await this.computeRefund(booking, cancelledBy),
            policy: property?.cancellationPolicy ?? 'flexible',
        };
    }
    async paginateBookings(baseFilter, query) {
        const { page = 1, limit = 20, status, fromDate, toDate, sortOrder = 'desc' } = query;
        const skip = (page - 1) * limit;
        const filter = { ...baseFilter };
        if (status)
            filter.status = status;
        if (fromDate)
            filter.checkIn = { ...(filter.checkIn ?? {}), $gte: new Date(fromDate) };
        if (toDate)
            filter.checkOut = { ...(filter.checkOut ?? {}), $lte: new Date(toDate) };
        const [bookings, total] = await Promise.all([
            this.bookingModel
                .find(filter)
                .populate('propertyId', 'title address city images price')
                .populate('guestId', 'name email phoneNumber profilePicture')
                .populate('hostId', 'name email phoneNumber profilePicture')
                .sort({ createdAt: sortOrder === 'asc' ? 1 : -1 })
                .skip(skip)
                .limit(limit)
                .exec(),
            this.bookingModel.countDocuments(filter),
        ]);
        return { bookings, total, page, totalPages: Math.ceil(total / limit) };
    }
    async findBookingOrThrow(id) {
        if (!mongoose_2.Types.ObjectId.isValid(id)) {
            throw new common_1.BadRequestException('Invalid booking ID');
        }
        const booking = await this.bookingModel.findById(id).exec();
        if (!booking)
            throw new common_1.NotFoundException('Booking not found');
        return booking;
    }
    async assertCanManageProperty(propertyId, user) {
        if (user.role === user_schema_1.UserRole.ADMIN)
            return;
        if (!mongoose_2.Types.ObjectId.isValid(propertyId))
            throw new common_1.BadRequestException('Invalid property ID');
        const property = await this.propertyModel.findById(propertyId).select('ownerId agentId').lean().exec();
        if (!property)
            throw new common_1.NotFoundException('Property not found');
        const uid = user._id.toString();
        const ownerId = property.ownerId?.toString();
        const agentId = property.agentId?.toString();
        if (ownerId !== uid && agentId !== uid) {
            throw new common_1.ForbiddenException('You do not manage this property');
        }
    }
    assertIsHost(booking, user) {
        const isHost = booking.hostId.toString() === user._id.toString();
        const isAdmin = user.role === user_schema_1.UserRole.ADMIN;
        if (!isHost && !isAdmin) {
            throw new common_1.ForbiddenException('Only the host or an admin can perform this action');
        }
    }
};
exports.BookingsService = BookingsService;
exports.BookingsService = BookingsService = BookingsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(booking_schema_1.Booking.name)),
    __param(1, (0, mongoose_1.InjectModel)(property_schema_1.Property.name)),
    __param(2, (0, mongoose_1.InjectModel)(user_schema_1.User.name)),
    __param(5, (0, common_1.Inject)((0, common_1.forwardRef)(() => payments_service_1.PaymentsService))),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model,
        rooms_service_1.RoomsService,
        notifications_service_1.NotificationsService,
        payments_service_1.PaymentsService])
], BookingsService);
//# sourceMappingURL=bookings.service.js.map