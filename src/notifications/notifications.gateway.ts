import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards } from '@nestjs/common';
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

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || ['http://localhost:3000', 'http://localhost:3000'],
    credentials: true,
  },
  namespace: 'notifications',
  transports: ['websocket', 'polling'],
})
export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(NotificationsGateway.name);
  
  // Track active user connections: userId -> Set of socketIds
  private userSockets: Map<string, Set<string>> = new Map();
  
  // Track socket metadata: socketId -> userId
  private socketToUser: Map<string, string> = new Map();

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  /**
   * Handle new WebSocket connections
   */
 async handleConnection(client: AuthenticatedSocket) {
  try {
    this.logger.log(`Client attempting connection: ${client.id}`);

    // Extract token from various sources
    const token = 
      client.handshake.auth?.token || 
      client.handshake.headers?.authorization?.replace('Bearer ', '') ||
      client.handshake.query?.token as string;

    if (!token) {
      this.logger.warn(`Client ${client.id} connected without token`);
      client.emit('error', { message: 'Authentication required' });
      client.disconnect();
      return;
    }

    // Verify JWT token
    let payload;
    try {
      payload = this.jwtService.verify(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });
    } catch (error) {
      this.logger.warn(`Invalid token for client ${client.id}: ${error.message}`);
      client.emit('error', { message: 'Invalid or expired token' });
      client.disconnect();
      return;
    }

    // 🔥 CRITICAL FIX: Use 'sub' from JWT payload - this is the user's MongoDB _id
    // Your JWT structure: { sub: userId, sessionId, role }
    const userId = payload.sub;  // ✅ Changed from: payload.userId || payload.sub
    const sessionId = payload.sessionId;
    const role = payload.role;

    if (!userId) {
      this.logger.warn(`No userId (sub) in token for client ${client.id}`);
      client.emit('error', { message: 'Invalid token payload' });
      client.disconnect();
      return;
    }

    // Store user data in socket
    client.data.userId = userId;
    client.data.sessionId = sessionId;
    client.data.role = role;

    // Track user's sockets (support multiple devices/tabs)
    if (!this.userSockets.has(userId)) {
      this.userSockets.set(userId, new Set());
    }
    this.userSockets.get(userId)!.add(client.id);
    this.socketToUser.set(client.id, userId);

    // Join user-specific room
    await client.join(`user:${userId}`);

    // Join role-specific room if applicable
    if (role) {
      await client.join(`role:${role}`);
    }

    this.logger.log(
      `✅ Client ${client.id} authenticated - User: ${userId}, Role: ${role}, Active connections: ${this.userSockets.get(userId)!.size}`
    );

    // Send connection confirmation with user info
    client.emit('connected', {
      userId,
      socketId: client.id,
      timestamp: new Date().toISOString(),
      activeConnections: this.userSockets.get(userId)!.size,
    });

  } catch (error) {
    this.logger.error(`Connection error for client ${client.id}: ${error.message}`);
    client.emit('error', { message: 'Connection failed' });
    client.disconnect();
  }
}

  /**
   * Handle client disconnection
   */
  handleDisconnect(client: AuthenticatedSocket) {
    const userId = this.socketToUser.get(client.id);

    if (userId) {
      // Remove socket from user's set
      const userSocketSet = this.userSockets.get(userId);
      if (userSocketSet) {
        userSocketSet.delete(client.id);
        
        // If no more sockets for this user, remove the entry
        if (userSocketSet.size === 0) {
          this.userSockets.delete(userId);
          this.logger.log(`User ${userId} fully disconnected (no active connections)`);
        } else {
          this.logger.log(`Client ${client.id} disconnected - User ${userId} still has ${userSocketSet.size} active connection(s)`);
        }
      }

      // Clean up socket tracking
      this.socketToUser.delete(client.id);
    } else {
      this.logger.log(`Client ${client.id} disconnected (no user associated)`);
    }
  }

  /**
   * Send new notification to specific user in real-time
   */
  sendNotificationToUser(userId: any, notification: Notification | any) {
    const userIdStr = userId?.toString();
    const room = `user:${userIdStr}`;
    const connectionCount = this.getUserConnectionCount(userIdStr);

    if (connectionCount > 0) {
      this.server.to(room).emit('notification', {
        ...notification,
        receivedAt: new Date().toISOString(),
      });
      
      this.logger.log(
        `📬 Sent notification to user ${userIdStr} (${connectionCount} active connection(s)) - Type: ${notification.type}`
      );
    } else {
      this.logger.debug(
        `User ${userIdStr} not connected - notification will be fetched via REST API`
      );
    }
  }

  /**
   * Send unread count update to user
   */
  sendUnreadCountUpdate(userId: any, count: number) {
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

  /**
   * Notify user that a notification was marked as read
   */
  notifyNotificationRead(userId: any, notificationId: string) {
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

  /**
   * Notify user that all notifications were marked as read
   */
  notifyAllRead(userId: any) {
    const userIdStr = userId?.toString();
    const room = `user:${userIdStr}`;
    
    if (this.isUserConnected(userIdStr)) {
      this.server.to(room).emit('allNotificationsRead', {
        timestamp: new Date().toISOString(),
      });
      
      this.logger.debug(`Notified user ${userIdStr} that all notifications were marked as read`);
    }
  }

  /**
   * Notify user that a notification was deleted
   */
  notifyNotificationDeleted(userId: any, notificationId: string) {
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

  /**
   * Broadcast system notification to all connected users
   */
  broadcastSystemNotification(notification: any) {
    this.server.emit('systemNotification', {
      ...notification,
      receivedAt: new Date().toISOString(),
    });
    
    this.logger.log(`📢 Broadcasted system notification to all users`);
  }

  /**
   * Broadcast notification to specific role
   */
  broadcastToRole(role: string, notification: any) {
    this.server.to(`role:${role}`).emit('notification', {
      ...notification,
      receivedAt: new Date().toISOString(),
    });
    
    this.logger.log(`📢 Broadcasted notification to role: ${role}`);
  }

  /**
   * Check if user is currently connected
   */
  isUserConnected(userId: any): boolean {
    const socketSet = this.userSockets.get(userId?.toString());
    return socketSet !== undefined && socketSet.size > 0;
  }

  /**
   * Get number of active connections for a user
   */
  getUserConnectionCount(userId: any): number {
    return this.userSockets.get(userId?.toString())?.size || 0;
  }

  /**
   * Get all connected user IDs
   */
  getConnectedUserIds(): string[] {
    return Array.from(this.userSockets.keys());
  }

  /**
   * Get total number of connected users
   */
  getTotalConnectedUsers(): number {
    return this.userSockets.size;
  }

  /**
   * Get total number of socket connections
   */
  getTotalConnections(): number {
    let total = 0;
    this.userSockets.forEach(sockets => {
      total += sockets.size;
    });
    return total;
  }

  /**
   * Handle client ping for connection health check
   */
  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() client: AuthenticatedSocket): void {
    client.emit('pong', { 
      timestamp: new Date().toISOString(),
      serverTime: Date.now(),
    });
  }

  /**
   * Handle client requesting connection status
   */
  @SubscribeMessage('getStatus')
  handleGetStatus(@ConnectedSocket() client: AuthenticatedSocket): void {
    const userId = client.data.userId;
    
    client.emit('status', {
      connected: true,
      userId,
      socketId: client.id,
      activeConnections: this.getUserConnectionCount(userId),
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Manual subscription to notifications (optional, auto-subscribed on connect)
   */
  @SubscribeMessage('subscribeToNotifications')
  handleSubscribe(@ConnectedSocket() client: AuthenticatedSocket): void {
    const userId = client.data.userId;
    client.join(`user:${userId}`);
    
    client.emit('subscribed', {
      userId,
      timestamp: new Date().toISOString(),
    });
    
    this.logger.log(`Client ${client.id} manually subscribed to notifications`);
  }

  /**
   * Get gateway statistics (admin only)
   */
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
}