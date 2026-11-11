import { OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Notification } from './schemas/notification.schema';
interface AuthenticatedSocket extends Socket {
    data: {
        userId: string;
        sessionId?: string;
        role?: string;
    };
}
export declare class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
    private jwtService;
    private configService;
    server: Server;
    private readonly logger;
    private userSockets;
    private socketToUser;
    constructor(jwtService: JwtService, configService: ConfigService);
    handleConnection(client: AuthenticatedSocket): Promise<void>;
    handleDisconnect(client: AuthenticatedSocket): void;
    sendNotificationToUser(userId: any, notification: Notification | any): void;
    sendUnreadCountUpdate(userId: any, count: number): void;
    notifyNotificationRead(userId: any, notificationId: string): void;
    notifyAllRead(userId: any): void;
    notifyNotificationDeleted(userId: any, notificationId: string): void;
    broadcastSystemNotification(notification: any): void;
    broadcastToRole(role: string, notification: any): void;
    isUserConnected(userId: any): boolean;
    getUserConnectionCount(userId: any): number;
    getConnectedUserIds(): string[];
    getTotalConnectedUsers(): number;
    getTotalConnections(): number;
    handlePing(client: AuthenticatedSocket): void;
    handleGetStatus(client: AuthenticatedSocket): void;
    handleSubscribe(client: AuthenticatedSocket): void;
    getGatewayStats(): {
        totalUsers: number;
        totalConnections: number;
        connectedUsers: {
            userId: string;
            connections: number;
        }[];
        timestamp: string;
    };
}
export {};
