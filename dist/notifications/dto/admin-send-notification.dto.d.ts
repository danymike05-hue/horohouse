import { NotificationType } from '../schemas/notification.schema';
export declare enum AdminNotifChannel {
    PUSH = "push",
    EMAIL = "email",
    BOTH = "both"
}
export declare enum AdminNotifTarget {
    ALL = "all",
    ROLE = "role",
    USERS = "users"
}
export declare class AdminSendNotificationDto {
    target: AdminNotifTarget;
    role?: string;
    userIds?: string[];
    title: string;
    message: string;
    type?: NotificationType;
    link?: string;
    channel?: AdminNotifChannel;
    metadata?: Record<string, any>;
}
