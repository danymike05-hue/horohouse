import { NotificationType } from '../schemas/notification.schema';
export declare class CreateNotificationDto {
    userId: string;
    type: NotificationType;
    title: string;
    message: string;
    link?: string;
    metadata?: {
        propertyId?: string;
        inquiryId?: string;
        senderId?: string;
        bookingId?: string;
        reviewId?: string;
        checkIn?: string;
        checkOut?: string;
        guestName?: string;
        hostName?: string;
        propertyTitle?: string;
        amount?: number;
        currency?: string;
        [key: string]: any;
    };
}
