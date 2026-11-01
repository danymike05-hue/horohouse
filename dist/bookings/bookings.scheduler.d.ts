import { Model } from 'mongoose';
import { BookingDocument } from './schema/booking.schema';
import { NotificationsService } from '../notifications/notifications.service';
export declare class BookingsScheduler {
    private bookingModel;
    private readonly notificationsService;
    private readonly logger;
    constructor(bookingModel: Model<BookingDocument>, notificationsService: NotificationsService);
    autoCancelUnpaidBookings(): Promise<void>;
    detectNoShows(): Promise<void>;
}
