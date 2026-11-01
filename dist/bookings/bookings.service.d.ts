import { Model } from 'mongoose';
import { Booking, BookingDocument } from './schema/booking.schema';
import { PropertyDocument } from '../properties/schemas/property.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { RoomsService } from '../rooms/rooms.service';
import { NotificationsService } from '../notifications/notifications.service';
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
    }[];
    bookedRanges: Array<{
        checkIn: Date;
        checkOut: Date;
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
    private readonly logger;
    constructor(bookingModel: Model<BookingDocument>, propertyModel: Model<PropertyDocument>, userModel: Model<UserDocument>, roomsService: RoomsService, notificationsService: NotificationsService);
    createBooking(dto: CreateBookingDto, guest: User): Promise<Booking>;
    cancelBooking(bookingId: string, dto: CancelBookingDto, user: User): Promise<Booking>;
    getGuestBookings(guestId: string, query: BookingQueryDto): Promise<PaginatedBookings>;
    confirmBooking(bookingId: string, dto: RespondToBookingDto, host: User): Promise<Booking>;
    rejectBooking(bookingId: string, dto: RespondToBookingDto, host: User): Promise<Booking>;
    completeBooking(bookingId: string, host: User): Promise<Booking>;
    getHostBookings(hostId: string, query: BookingQueryDto): Promise<PaginatedBookings>;
    getPropertyBookings(propertyId: string, query: BookingQueryDto): Promise<PaginatedBookings>;
    getHostStats(hostId: string): Promise<HostStatsDto>;
    getAvailability(propertyId: string, from: Date, to: Date, roomId?: string): Promise<AvailabilityResult>;
    getAllBookings(query: BookingQueryDto): Promise<PaginatedBookings>;
    getBookingById(bookingId: string, user: User): Promise<Booking>;
    updatePayment(bookingId: string, dto: UpdatePaymentDto): Promise<Booking>;
    getBookingStats(): Promise<any>;
    private assertDatesAvailable;
    private computePrice;
    private computeDiscount;
    private computeRefund;
    private paginateBookings;
    private findBookingOrThrow;
    private assertIsHost;
}
