import { Model } from 'mongoose';
import { Booking, BookingDocument, CancelledBy } from './schema/booking.schema';
import { PropertyDocument } from '../properties/schemas/property.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { RoomsService } from '../rooms/rooms.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PaymentsService } from '../payments/services/payments.service';
import { CreateBookingDto, CancelBookingDto, RespondToBookingDto, UpdatePaymentDto, BookingQueryDto } from './dto/booking.dto';
import { HostStatsDto } from './dto/host-stats.dto';
export interface PaginatedBookings {
    bookings: Booking[];
    total: number;
    page: number;
    totalPages: number;
}
export interface AvailabilityResult {
    available: boolean;
    unavailableDates: {
        from: Date;
        to: Date;
        reason?: string;
        source?: string;
    }[];
    capacity?: number;
    bookedRanges: Array<{
        checkIn: Date;
        checkOut: Date;
        roomId?: string;
        status?: string;
        guests?: number;
        guestCount?: number;
        totalPrice?: number;
        guestName?: string;
        guestAvatar?: string | null;
        guest?: {
            name?: string;
            profilePicture?: string;
        };
    }>;
}
export declare class BookingsService {
    private bookingModel;
    private propertyModel;
    private userModel;
    private readonly roomsService;
    private readonly notificationsService;
    private readonly paymentsService;
    private readonly logger;
    constructor(bookingModel: Model<BookingDocument>, propertyModel: Model<PropertyDocument>, userModel: Model<UserDocument>, roomsService: RoomsService, notificationsService: NotificationsService, paymentsService: PaymentsService);
    createBooking(dto: CreateBookingDto, guest: User): Promise<Booking>;
    cancelBooking(bookingId: string, dto: CancelBookingDto, user: User): Promise<Booking>;
    getGuestBookings(guestId: string, query: BookingQueryDto): Promise<PaginatedBookings>;
    confirmBooking(bookingId: string, dto: RespondToBookingDto, host: User): Promise<Booking>;
    rejectBooking(bookingId: string, dto: RespondToBookingDto, host: User): Promise<Booking>;
    completeBooking(bookingId: string, host: User): Promise<Booking>;
    completeFinishedStays(batchSize?: number): Promise<number>;
    private markCompleted;
    getHostBookings(hostId: string, query: BookingQueryDto): Promise<PaginatedBookings>;
    getPropertyBookings(propertyId: string, query: BookingQueryDto, user: User): Promise<PaginatedBookings>;
    getHostStats(hostId: string): Promise<HostStatsDto>;
    getAvailability(propertyId: string, from: Date, to: Date, roomId?: string, opts?: {
        includeGuestDetails?: boolean;
    }): Promise<AvailabilityResult>;
    private getRoomAvailabilityForHost;
    expireOverdueBookings(batchSize?: number): Promise<number>;
    getAllBookings(query: BookingQueryDto): Promise<PaginatedBookings>;
    getBookingById(bookingId: string, user: User): Promise<Booking>;
    updatePayment(bookingId: string, dto: UpdatePaymentDto): Promise<Booking>;
    getBookingStats(): Promise<any>;
    private assertDatesAvailable;
    private computePrice;
    private nightlyRates;
    private computeDiscount;
    private computeRefund;
    getCancellationPreview(bookingId: string, user: User): Promise<{
        canCancel: boolean;
        cancelledBy: CancelledBy;
        paidAmount: number;
        refundAmount: number;
        policy: string;
    }>;
    private paginateBookings;
    private findBookingOrThrow;
    assertCanManageProperty(propertyId: string, user: User): Promise<void>;
    private assertIsHost;
}
