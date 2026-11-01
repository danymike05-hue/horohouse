import { Model } from 'mongoose';
import { NotificationsService } from './notifications.service';
import { BookingDocument } from '../bookings/schema/booking.schema';
import { ReviewsService } from '../reviews/reviews.service';
export declare class NotificationsScheduler {
    private readonly notificationsService;
    private readonly reviewsService;
    private bookingModel;
    private readonly logger;
    constructor(notificationsService: NotificationsService, reviewsService: ReviewsService, bookingModel: Model<BookingDocument>);
    sendCheckInReminders(): Promise<void>;
    sendReviewReminders(): Promise<void>;
    publishExpiredReviews(): Promise<void>;
}
