import { FastifyRequest } from 'fastify';
import { BookingsService } from './bookings.service';
import { CreateBookingDto, CancelBookingDto, RespondToBookingDto, UpdatePaymentDto, BookingQueryDto, AvailabilityQueryDto } from './dto/booking.dto';
import { User } from '../users/schemas/user.schema';
export declare class BookingsController {
    private readonly bookingsService;
    constructor(bookingsService: BookingsService);
    createBooking(dto: CreateBookingDto, req: FastifyRequest & {
        user: User;
    }): Promise<import("./schema/booking.schema").Booking>;
    getMyBookings(req: FastifyRequest & {
        user: User;
    }, query: BookingQueryDto): Promise<import("./bookings.service").PaginatedBookings>;
    cancelBooking(id: string, dto: CancelBookingDto, req: FastifyRequest & {
        user: User;
    }): Promise<import("./schema/booking.schema").Booking>;
    getHostBookings(req: FastifyRequest & {
        user: User;
    }, query: BookingQueryDto): Promise<import("./bookings.service").PaginatedBookings>;
    confirmBooking(id: string, dto: RespondToBookingDto, req: FastifyRequest & {
        user: User;
    }): Promise<import("./schema/booking.schema").Booking>;
    rejectBooking(id: string, dto: RespondToBookingDto, req: FastifyRequest & {
        user: User;
    }): Promise<import("./schema/booking.schema").Booking>;
    completeBooking(id: string, req: FastifyRequest & {
        user: User;
    }): Promise<import("./schema/booking.schema").Booking>;
    getAvailability(propertyId: string, query: AvailabilityQueryDto): Promise<import("./bookings.service").AvailabilityResult>;
    getPropertyBookings(propertyId: string, query: BookingQueryDto): Promise<import("./bookings.service").PaginatedBookings>;
    getAllBookings(query: BookingQueryDto): Promise<import("./bookings.service").PaginatedBookings>;
    getBookingStats(): Promise<any>;
    updatePayment(id: string, dto: UpdatePaymentDto): Promise<import("./schema/booking.schema").Booking>;
    getBookingById(id: string, req: FastifyRequest & {
        user: User;
    }): Promise<import("./schema/booking.schema").Booking>;
    getHostStats(req: FastifyRequest & {
        user: User;
    }): Promise<import("./dto/host-stats.dto").HostStatsDto>;
}
