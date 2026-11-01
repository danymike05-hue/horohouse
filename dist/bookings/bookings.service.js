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
const SERVICE_FEE_RATE = 0;
const AUTO_CANCEL_HOURS = 24;
let BookingsService = BookingsService_1 = class BookingsService {
    bookingModel;
    propertyModel;
    userModel;
    roomsService;
    notificationsService;
    logger = new common_1.Logger(BookingsService_1.name);
    constructor(bookingModel, propertyModel, userModel, roomsService, notificationsService) {
        this.bookingModel = bookingModel;
        this.propertyModel = propertyModel;
        this.userModel = userModel;
        this.roomsService = roomsService;
        this.notificationsService = notificationsService;
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
        const advanceNoticeDays = property.advanceNoticeDays ?? 0;
        const bookingWindowDays = property.bookingWindowDays ?? 365;
        const daysTilCheckin = Math.ceil((checkIn.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        if (daysTilCheckin < advanceNoticeDays) {
            throw new common_1.BadRequestException(`This property requires at least ${advanceNoticeDays} day(s) advance notice before check-in`);
        }
        if (daysTilCheckin > bookingWindowDays) {
            throw new common_1.BadRequestException(`Bookings can only be made up to ${bookingWindowDays} day(s) in advance for this property`);
        }
        const maxGuests = property.shortTermAmenities?.maxGuests ?? 99;
        const totalGuests = dto.guests.adults + (dto.guests.children ?? 0);
        if (totalGuests > maxGuests) {
            throw new common_1.BadRequestException(`This property accommodates a maximum of ${maxGuests} guest(s)`);
        }
        if (dto.roomId) {
            await this.roomsService.assertRoomDatesAvailable(dto.roomId, checkIn, checkOut);
        }
        else {
            await this.assertDatesAvailable(dto.propertyId, checkIn, checkOut);
        }
        const priceBreakdown = this.computePrice(property, nights);
        const rawHostRef = property.ownerId ?? property.agentId;
        const hostIdStr = rawHostRef?._id
            ? rawHostRef._id.toString()
            : rawHostRef?.toString();
        const validHostObjectId = hostIdStr && mongoose_2.Types.ObjectId.isValid(hostIdStr)
            ? new mongoose_2.Types.ObjectId(hostIdStr)
            : undefined;
        const isInstantBook = !!property.isInstantBookable;
        const initialStatus = booking_schema_1.BookingStatus.PENDING;
        const confirmedAt = undefined;
        const expiresAt = isInstantBook
            ? new Date(Date.now() + 30 * 60 * 1000)
            : new Date(Date.now() + 48 * 60 * 60 * 1000);
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
            },
            priceBreakdown,
            currency: dto.currency ?? property.currency ?? 'XAF',
            status: initialStatus,
            paymentStatus: booking_schema_1.PaymentStatus.UNPAID,
            isInstantBook,
            confirmedAt,
            guestNote: dto.guestNote,
        });
        const saved = await booking.save();
        const fmt = (d) => d.toISOString().split('T')[0];
        const propertyTitle = property.title ?? 'your property';
        const guestIdStr = guest._id.toString();
        const bookingIdStr = saved._id.toString();
        try {
            if (isInstantBook) {
                await this.notificationsService.notifyBookingConfirmed(guestIdStr, {
                    bookingId: bookingIdStr,
                    propertyId: dto.propertyId,
                    propertyTitle,
                    hostName: property.ownerId?.name ?? 'Host',
                    checkIn: fmt(checkIn),
                    checkOut: fmt(checkOut),
                });
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
        const refundAmount = await this.computeRefund(booking);
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
                refundAmount: refundAmount > 0 ? refundAmount : undefined,
                currency: booking.currency,
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
        await this.assertDatesAvailable(booking.propertyId.toString(), booking.checkIn, booking.checkOut, bookingId);
        const paymentDeadline = new Date(Date.now() + 24 * 60 * 60 * 1000);
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
        if (booking.status !== booking_schema_1.BookingStatus.CONFIRMED) {
            throw new common_1.BadRequestException('Only CONFIRMED bookings can be completed');
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
    async getPropertyBookings(propertyId, query) {
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
    async getAvailability(propertyId, from, to, roomId) {
        const property = await this.propertyModel.findById(propertyId).exec();
        if (!property)
            throw new common_1.NotFoundException('Property not found');
        if (roomId) {
            const roomResult = await this.roomsService.getRoomAvailability(roomId, from, to);
            return {
                available: roomResult.available,
                unavailableDates: roomResult.unavailableDates.map((r) => ({ from: r.from, to: r.to })),
                bookedRanges: roomResult.bookedRanges.map((r) => ({ checkIn: r.checkIn, checkOut: r.checkOut })),
            };
        }
        const hostBlockedRanges = (property.unavailableDates ?? []).filter((r) => r.from < to && r.to > from);
        const bookings = await this.bookingModel
            .find({
            propertyId: new mongoose_2.Types.ObjectId(propertyId),
            $or: [{ roomId: { $exists: false } }, { roomId: null }],
            status: { $in: [booking_schema_1.BookingStatus.CONFIRMED, booking_schema_1.BookingStatus.PENDING, booking_schema_1.BookingStatus.COMPLETED] },
            checkIn: { $lt: to },
            checkOut: { $gt: from },
        })
            .select('checkIn checkOut status guestCount totalPrice guestId')
            .populate('guestId', 'name profilePicture')
            .lean()
            .exec();
        const bookedRanges = bookings.map((b) => ({
            checkIn: b.checkIn,
            checkOut: b.checkOut,
            status: b.status,
            guests: b.guestCount,
            guestCount: b.guestCount,
            totalPrice: b.totalPrice,
            guestName: b.guestId?.name ?? 'Guest',
            guestAvatar: b.guestId?.profilePicture ?? null,
            guest: b.guestId ? { name: b.guestId.name, profilePicture: b.guestId.profilePicture } : undefined,
        }));
        const available = hostBlockedRanges.length === 0 && bookedRanges.length === 0;
        return { available, unavailableDates: hostBlockedRanges, bookedRanges };
    }
    async getAllBookings(query) {
        return this.paginateBookings({}, query);
    }
    async getBookingById(bookingId, user) {
        const booking = await this.bookingModel
            .findById(bookingId)
            .populate('propertyId', 'title address city images price')
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
    computePrice(property, nights) {
        const pricePerNight = property.price ?? 0;
        const subtotal = pricePerNight * nights;
        const cleaningFee = property.cleaningFee ?? 0;
        const serviceFee = Math.round(subtotal * SERVICE_FEE_RATE);
        const taxAmount = 0;
        const discountAmount = this.computeDiscount(subtotal, nights, property.weeklyDiscountPercent ?? 10, property.monthlyDiscountPercent ?? 15, property.customDiscountNights, property.customDiscountPercent);
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
        };
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
    async computeRefund(booking) {
        if (booking.paymentStatus !== booking_schema_1.PaymentStatus.PAID)
            return 0;
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
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model,
        rooms_service_1.RoomsService,
        notifications_service_1.NotificationsService])
], BookingsService);
//# sourceMappingURL=bookings.service.js.map