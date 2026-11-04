import { BookingsService } from './bookings.service';
export declare class BookingsScheduler {
    private readonly bookingsService;
    private readonly logger;
    private running;
    constructor(bookingsService: BookingsService);
    expireUnpaidBookings(): Promise<void>;
    completeFinishedStays(): Promise<void>;
}
