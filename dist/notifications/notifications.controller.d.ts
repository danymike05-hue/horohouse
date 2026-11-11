import { NotificationsService } from './notifications.service';
import { QueryNotificationDto } from './dto/query-notification.dto';
import { AdminSendNotificationDto } from './dto/admin-send-notification.dto';
export declare class NotificationsController {
    private readonly notificationsService;
    constructor(notificationsService: NotificationsService);
    getNotifications(req: any, query: QueryNotificationDto): Promise<{
        notifications: import("./schemas/notification.schema").Notification[];
        unreadCount: number;
        total: number;
    }>;
    getUnreadCount(req: any): Promise<{
        count: number;
    }>;
    markAllAsRead(req: any): Promise<{
        modifiedCount: number;
    }>;
    markAsRead(req: any, notificationId: string): Promise<import("./schemas/notification.schema").Notification>;
    triggerTestNotification(req: any): Promise<any>;
    deleteAllRead(req: any): Promise<{
        deletedCount: number;
    }>;
    deleteAll(req: any): Promise<{
        deletedCount: number;
    }>;
    deleteNotification(req: any, notificationId: string): Promise<void>;
    adminSendNotification(req: any, dto: AdminSendNotificationDto): Promise<{
        sent: number;
        channel: string;
        target: string;
    }>;
    adminGetStats(): Promise<{
        totalUsers: number;
        totalConnections: number;
        connectedUsers: {
            userId: string;
            connections: number;
        }[];
        timestamp: string;
    }>;
}
