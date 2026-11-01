import { Model } from 'mongoose';
import { Notification, NotificationDocument } from './schemas/notification.schema';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { AdminSendNotificationDto } from './dto/admin-send-notification.dto';
import { QueryNotificationDto } from './dto/query-notification.dto';
import { NotificationsGateway } from './notifications.gateway';
import { PushNotificationsService } from './push-notifications.service';
import { EmailService } from '../email/email.service';
import { UserDocument } from '../users/schemas/user.schema';
export declare class NotificationsService {
    private notificationModel;
    private userModel;
    private notificationsGateway;
    private pushNotificationsService;
    private emailService;
    private readonly logger;
    constructor(notificationModel: Model<NotificationDocument>, userModel: Model<UserDocument>, notificationsGateway: NotificationsGateway, pushNotificationsService: PushNotificationsService, emailService: EmailService);
    create(createNotificationDto: CreateNotificationDto): Promise<Notification>;
    createBulk(userIds: string[], notificationData: Omit<CreateNotificationDto, 'userId'>): Promise<any[]>;
    findByUser(userId: string, query: QueryNotificationDto): Promise<{
        notifications: Notification[];
        unreadCount: number;
        total: number;
    }>;
    getUnreadCount(userId: string): Promise<number>;
    markAsRead(notificationId: string, userId: string): Promise<Notification>;
    markAllAsRead(userId: string): Promise<{
        modifiedCount: number;
    }>;
    delete(notificationId: string, userId: string): Promise<void>;
    deleteAllRead(userId: string): Promise<{
        deletedCount: number;
    }>;
    deleteAllForUser(userId: string): Promise<{
        deletedCount: number;
    }>;
    createInquiryNotification(propertyOwnerId: string, inquiryId: string, propertyId: string, senderName: string, propertyTitle: string): Promise<Notification>;
    createFavoriteNotification(propertyOwnerId: string, propertyId: string, userName: string, propertyTitle: string): Promise<Notification>;
    createPropertyUpdateNotification(userId: string, propertyId: string, propertyTitle: string, updateType: string): Promise<Notification>;
    createInquiryResponseNotification(userId: string, inquiryId: string, propertyId: string, agentName: string, responseSnippet?: string): Promise<Notification>;
    notifyBookingRequest(hostId: string, params: {
        guestId?: string;
        bookingId: string;
        propertyId: string;
        propertyTitle: string;
        guestName: string;
        checkIn: string;
        checkOut: string;
    }): Promise<void>;
    notifyBookingConfirmed(guestId: string, params: {
        bookingId: string;
        propertyId: string;
        propertyTitle: string;
        hostName: string;
        checkIn: string;
        checkOut: string;
    }): Promise<void>;
    notifyBookingRejected(guestId: string, params: {
        bookingId: string;
        propertyId: string;
        propertyTitle: string;
        hostName: string;
        checkIn: string;
        checkOut: string;
    }): Promise<void>;
    notifyBookingCancelled(params: {
        guestId: string;
        hostId: string;
        bookingId: string;
        propertyId: string;
        propertyTitle: string;
        guestName: string;
        hostName: string;
        checkIn: string;
        checkOut: string;
        cancelledByGuest: boolean;
        refundAmount?: number;
        currency?: string;
    }): Promise<void>;
    notifyBookingCompleted(params: {
        guestId: string;
        hostId: string;
        bookingId: string;
        propertyId: string;
        propertyTitle: string;
        guestName: string;
    }): Promise<void>;
    notifyCheckInReminder(guestId: string, params: {
        bookingId: string;
        propertyId: string;
        propertyTitle: string;
        checkIn: string;
        checkInTime?: string;
    }): Promise<void>;
    notifyReviewRequest(params: {
        guestId: string;
        hostId: string;
        bookingId: string;
        propertyId: string;
        propertyTitle: string;
        guestName: string;
    }): Promise<void>;
    notifyReviewReceived(hostId: string, params: {
        reviewId: string;
        bookingId: string;
        propertyId: string;
        propertyTitle: string;
        guestName: string;
        rating: number;
    }): Promise<void>;
    notifyReviewsPublished(params: {
        guestId: string;
        hostId: string;
        bookingId: string;
        propertyId: string;
        propertyTitle: string;
    }): Promise<void>;
    notifyReviewResponse(guestId: string, params: {
        reviewId: string;
        propertyId: string;
        propertyTitle: string;
        hostName: string;
    }): Promise<void>;
    notifyPaymentReceived(hostId: string, params: {
        bookingId: string;
        propertyTitle: string;
        guestName: string;
        amount: number;
        currency: string;
    }): Promise<void>;
    notifyRefundProcessed(guestId: string, params: {
        bookingId: string;
        propertyTitle: string;
        amount: number;
        currency: string;
    }): Promise<void>;
    adminSendNotification(adminId: string, dto: AdminSendNotificationDto): Promise<{
        sent: number;
        channel: string;
        target: string;
    }>;
    private resolveTargetUsers;
    getAdminStats(): {
        totalUsers: number;
        totalConnections: number;
        connectedUsers: {
            userId: string;
            connections: number;
        }[];
        timestamp: string;
    };
}
