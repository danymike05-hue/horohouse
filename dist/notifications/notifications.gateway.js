"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var NotificationsGateway_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationsGateway = void 0;
const websockets_1 = require("@nestjs/websockets");
const socket_io_1 = require("socket.io");
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const jwt_1 = require("@nestjs/jwt");
let NotificationsGateway = NotificationsGateway_1 = class NotificationsGateway {
    jwtService;
    configService;
    server;
    logger = new common_1.Logger(NotificationsGateway_1.name);
    userSockets = new Map();
    socketToUser = new Map();
    constructor(jwtService, configService) {
        this.jwtService = jwtService;
        this.configService = configService;
    }
    async handleConnection(client) {
        try {
            this.logger.log(`Client attempting connection: ${client.id}`);
            const token = client.handshake.auth?.token ||
                client.handshake.headers?.authorization?.replace('Bearer ', '') ||
                client.handshake.query?.token;
            if (!token) {
                this.logger.warn(`Client ${client.id} connected without token`);
                client.emit('error', { message: 'Authentication required' });
                client.disconnect();
                return;
            }
            let payload;
            try {
                payload = this.jwtService.verify(token, {
                    secret: this.configService.get('JWT_SECRET'),
                });
            }
            catch (error) {
                this.logger.warn(`Invalid token for client ${client.id}: ${error.message}`);
                client.emit('error', { message: 'Invalid or expired token' });
                client.disconnect();
                return;
            }
            const userId = payload.sub;
            const sessionId = payload.sessionId;
            const role = payload.role;
            if (!userId) {
                this.logger.warn(`No userId (sub) in token for client ${client.id}`);
                client.emit('error', { message: 'Invalid token payload' });
                client.disconnect();
                return;
            }
            client.data.userId = userId;
            client.data.sessionId = sessionId;
            client.data.role = role;
            if (!this.userSockets.has(userId)) {
                this.userSockets.set(userId, new Set());
            }
            this.userSockets.get(userId).add(client.id);
            this.socketToUser.set(client.id, userId);
            await client.join(`user:${userId}`);
            if (role) {
                await client.join(`role:${role}`);
            }
            this.logger.log(`✅ Client ${client.id} authenticated - User: ${userId}, Role: ${role}, Active connections: ${this.userSockets.get(userId).size}`);
            client.emit('connected', {
                userId,
                socketId: client.id,
                timestamp: new Date().toISOString(),
                activeConnections: this.userSockets.get(userId).size,
            });
        }
        catch (error) {
            this.logger.error(`Connection error for client ${client.id}: ${error.message}`);
            client.emit('error', { message: 'Connection failed' });
            client.disconnect();
        }
    }
    handleDisconnect(client) {
        const userId = this.socketToUser.get(client.id);
        if (userId) {
            const userSocketSet = this.userSockets.get(userId);
            if (userSocketSet) {
                userSocketSet.delete(client.id);
                if (userSocketSet.size === 0) {
                    this.userSockets.delete(userId);
                    this.logger.log(`User ${userId} fully disconnected (no active connections)`);
                }
                else {
                    this.logger.log(`Client ${client.id} disconnected - User ${userId} still has ${userSocketSet.size} active connection(s)`);
                }
            }
            this.socketToUser.delete(client.id);
        }
        else {
            this.logger.log(`Client ${client.id} disconnected (no user associated)`);
        }
    }
    sendNotificationToUser(userId, notification) {
        const userIdStr = userId?.toString();
        const room = `user:${userIdStr}`;
        const connectionCount = this.getUserConnectionCount(userIdStr);
        if (connectionCount > 0) {
            this.server.to(room).emit('notification', {
                ...notification,
                receivedAt: new Date().toISOString(),
            });
            this.logger.log(`📬 Sent notification to user ${userIdStr} (${connectionCount} active connection(s)) - Type: ${notification.type}`);
        }
        else {
            this.logger.debug(`User ${userIdStr} not connected - notification will be fetched via REST API`);
        }
    }
    sendUnreadCountUpdate(userId, count) {
        const userIdStr = userId?.toString();
        const room = `user:${userIdStr}`;
        if (this.isUserConnected(userIdStr)) {
            this.server.to(room).emit('unreadCount', {
                count,
                timestamp: new Date().toISOString(),
            });
            this.logger.debug(`Updated unread count for user ${userIdStr}: ${count}`);
        }
    }
    notifyNotificationRead(userId, notificationId) {
        const userIdStr = userId?.toString();
        const room = `user:${userIdStr}`;
        if (this.isUserConnected(userIdStr)) {
            this.server.to(room).emit('notificationRead', {
                notificationId,
                timestamp: new Date().toISOString(),
            });
            this.logger.debug(`Notified user ${userIdStr} that notification ${notificationId} was read`);
        }
    }
    notifyAllRead(userId) {
        const userIdStr = userId?.toString();
        const room = `user:${userIdStr}`;
        if (this.isUserConnected(userIdStr)) {
            this.server.to(room).emit('allNotificationsRead', {
                timestamp: new Date().toISOString(),
            });
            this.logger.debug(`Notified user ${userIdStr} that all notifications were marked as read`);
        }
    }
    notifyNotificationDeleted(userId, notificationId) {
        const userIdStr = userId?.toString();
        const room = `user:${userIdStr}`;
        if (this.isUserConnected(userIdStr)) {
            this.server.to(room).emit('notificationDeleted', {
                notificationId,
                timestamp: new Date().toISOString(),
            });
            this.logger.debug(`Notified user ${userIdStr} that notification ${notificationId} was deleted`);
        }
    }
    broadcastSystemNotification(notification) {
        this.server.emit('systemNotification', {
            ...notification,
            receivedAt: new Date().toISOString(),
        });
        this.logger.log(`📢 Broadcasted system notification to all users`);
    }
    broadcastToRole(role, notification) {
        this.server.to(`role:${role}`).emit('notification', {
            ...notification,
            receivedAt: new Date().toISOString(),
        });
        this.logger.log(`📢 Broadcasted notification to role: ${role}`);
    }
    isUserConnected(userId) {
        const socketSet = this.userSockets.get(userId?.toString());
        return socketSet !== undefined && socketSet.size > 0;
    }
    getUserConnectionCount(userId) {
        return this.userSockets.get(userId?.toString())?.size || 0;
    }
    getConnectedUserIds() {
        return Array.from(this.userSockets.keys());
    }
    getTotalConnectedUsers() {
        return this.userSockets.size;
    }
    getTotalConnections() {
        let total = 0;
        this.userSockets.forEach(sockets => {
            total += sockets.size;
        });
        return total;
    }
    handlePing(client) {
        client.emit('pong', {
            timestamp: new Date().toISOString(),
            serverTime: Date.now(),
        });
    }
    handleGetStatus(client) {
        const userId = client.data.userId;
        client.emit('status', {
            connected: true,
            userId,
            socketId: client.id,
            activeConnections: this.getUserConnectionCount(userId),
            timestamp: new Date().toISOString(),
        });
    }
    handleSubscribe(client) {
        const userId = client.data.userId;
        client.join(`user:${userId}`);
        client.emit('subscribed', {
            userId,
            timestamp: new Date().toISOString(),
        });
        this.logger.log(`Client ${client.id} manually subscribed to notifications`);
    }
    getGatewayStats() {
        return {
            totalUsers: this.getTotalConnectedUsers(),
            totalConnections: this.getTotalConnections(),
            connectedUsers: this.getConnectedUserIds().map(userId => ({
                userId,
                connections: this.getUserConnectionCount(userId),
            })),
            timestamp: new Date().toISOString(),
        };
    }
};
exports.NotificationsGateway = NotificationsGateway;
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", socket_io_1.Server)
], NotificationsGateway.prototype, "server", void 0);
__decorate([
    (0, websockets_1.SubscribeMessage)('ping'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], NotificationsGateway.prototype, "handlePing", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('getStatus'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], NotificationsGateway.prototype, "handleGetStatus", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('subscribeToNotifications'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], NotificationsGateway.prototype, "handleSubscribe", null);
exports.NotificationsGateway = NotificationsGateway = NotificationsGateway_1 = __decorate([
    (0, websockets_1.WebSocketGateway)({
        cors: {
            origin: process.env.FRONTEND_URL || ['http://localhost:3000', 'http://localhost:3000'],
            credentials: true,
        },
        namespace: 'notifications',
        transports: ['websocket', 'polling'],
    }),
    __metadata("design:paramtypes", [jwt_1.JwtService,
        config_1.ConfigService])
], NotificationsGateway);
//# sourceMappingURL=notifications.gateway.js.map