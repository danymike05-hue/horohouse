
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CallService } from './call.service';
import { ChatService } from './chat.service';
import { User, UserDocument } from '../users/schemas/user.schema';
import { PushNotificationsService } from '../notifications/push-notifications.service';
import {
  InitiateCallDto,
  AnswerCallDto,
  DeclineCallDto,
  EndCallDto,
  IceCandidateDto,
} from './dto/call.dto';

@WebSocketGateway({
  namespace: '/chat',
  cors: {
    origin: [
      process.env.FRONTEND_URL || 'http://localhost:3000',
      'http://localhost:3000',
      'http://localhost:3001',
    ],
    credentials: true,
    methods: ['GET', 'POST'],
  },
  transports: ['websocket', 'polling'],
  allowEIO3: true,
})
export class ChatGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);
  private userSockets = new Map<string, Set<string>>();

  constructor(
    private readonly chatService: ChatService,
    private readonly callService: CallService,
    private readonly jwtService: JwtService,
    private readonly pushNotificationsService: PushNotificationsService,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) { }

  afterInit(server: Server) {
    this.logger.log('🔌 Chat Gateway initialized');
    this.logger.log(`📡 Namespace: /chat`);
    this.logger.log(`🌍 CORS origin: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);

    server.use(async (socket: Socket, next) => {
      try {
        const token = socket.handshake?.auth?.token;

        this.logger.log(`🔐 Connection attempt - Socket ID: ${socket.id}, Token present: ${!!token}`);

        if (!token) {
          this.logger.warn('❌ Connection rejected: No token provided');
          return next(new Error('Authentication error: No token provided'));
        }

        try {
          const payload = await this.jwtService.verifyAsync(token, {
            secret: process.env.JWT_SECRET,
          });

          socket.data.user = {
            ...payload,
            userId: payload.sub || payload.userId,
          };

          this.logger.log(`✅ Token verified - User ID: ${payload.sub || payload.userId}, Email: ${payload.email}`);
          next();
        } catch (error) {
          this.logger.error(`❌ Token verification failed: ${error.message}`);
          return next(new Error(`Authentication error: ${error.message}`));
        }
      } catch (error) {
        this.logger.error(`❌ Auth middleware error: ${error.message}`);
        return next(new Error('Authentication error'));
      }
    });

    this.logger.log('✅ Authentication middleware registered');
  }
  

  async handleConnection(client: Socket) {
    try {
      const userId = client.data.user?.userId || client.data.user?.sub;

      this.logger.log(`📥 New connection - Socket ID: ${client.id}, User ID: ${userId}`);

      if (!userId) {
        this.logger.warn('❌ Connection rejected: No user data in socket.data');
        client.emit('error', { message: 'Authentication failed: No user data' });
        client.disconnect(true);
        return;
      }

      if (!this.userSockets.has(userId)) {
        this.userSockets.set(userId, new Set());
      }
      this.userSockets.get(userId)!.add(client.id);

      this.logger.log(`✅ User ${userId} connected (${this.userSockets.get(userId)!.size} sockets)`);

      this.server.emit('user:status', { userId, status: 'online' });

      client.emit('connection:success', {
        userId,
        socketId: client.id,
        timestamp: new Date().toISOString(),
        message: 'Connected successfully to chat server',
      });
    } catch (error) {
      this.logger.error(`❌ Connection error: ${error.message}`);
      client.emit('error', { message: `Connection failed: ${error.message}` });
      client.disconnect(true);
    }
  }

  async handleDisconnect(client: Socket) {
    try {
      const userId = client.data.user?.userId || client.data.user?.sub;

      this.logger.log(`📤 Disconnection - Socket ID: ${client.id}, User ID: ${userId}`);

      if (userId) {
        const sockets = this.userSockets.get(userId);
        if (sockets) {
          sockets.delete(client.id);
          if (sockets.size === 0) {
            this.userSockets.delete(userId);
            this.server.emit('user:status', { userId, status: 'offline' });
            this.logger.log(`   User ${userId} is now offline`);
          }
        }
      }
    } catch (error) {
      this.logger.error(`❌ Disconnection error: ${error.message}`);
    }
  }

  @SubscribeMessage('conversation:join')
  async handleJoinConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    try {
      const userId = client.data.user.userId || client.data.user.sub;
      client.join(`conversation:${data.conversationId}`);
      this.logger.log(`✅ User ${userId} joined conversation: ${data.conversationId}`);
      return { success: true };
    } catch (error) {
      this.logger.error('❌ Error joining conversation:', error);
      return { success: false, error: error.message };
    }
  }

  @SubscribeMessage('message:send')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: any,
  ) {
    try {
      const userId = client.data.user.userId || client.data.user.sub;
      this.logger.log(`📨 Sending message from user ${userId}, tempId: ${data.tempId}`);

      const message = await this.chatService.sendMessage(userId, {
        conversationId: data.conversationId,
        content: data.content,
        type: data.type || 'text',
      });

      // Broadcast to everyone in the room (including sender via message:new)
      this.server.to(`conversation:${data.conversationId}`).emit('message:new', {
        message,
      });

      // FIX: Echo tempId back to sender so the optimistic message can be replaced
      // by the real server message. Without tempId the frontend can't match them.
      client.emit('message:sent', {
        message: {
          ...message,
          tempId: data.tempId, // ← KEY FIX: return tempId so frontend replaces optimistic msg
        },
      });

      // ── Push notification for offline / backgrounded recipient ────────────────
      // Only send if the recipient has no active WebSocket connections, so we
      // don't double-notify users who are already in the conversation.
      const recipientId = (message as any).recipientId?.toString?.();
      if (recipientId && !this.userSockets.has(recipientId)) {
        const sender = await this.userModel
          .findById(userId)
          .select('name')
          .lean()
          .catch(() => null);

        const senderName: string = (sender as any)?.name ?? 'Someone';
        const messageContent: string =
          data.type === 'image'
            ? `${senderName} sent you a photo`
            : data.type === 'audio'
            ? `${senderName} sent you a voice message`
            : `${senderName}: ${String(data.content ?? '').slice(0, 100)}`;

        this.pushNotificationsService
          .sendToUser(recipientId, {
            title: '💬 New message',
            body: messageContent,
            data: {
              type: 'new_message',
              conversationId: data.conversationId,
              route: `/messages/${data.conversationId}`,
            },
          })
          .catch((err: any) =>
            this.logger.warn(`⚠️ Push notification failed for user ${recipientId}: ${err?.message}`),
          );
      }

      return { success: true, message };
    } catch (error) {
      this.logger.error('❌ Error sending message:', error);
      return { success: false, error: error.message };
    }
  }

  @SubscribeMessage('messages:read')
  async handleMarkAsRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string; messageIds: string[] },
  ) {
    try {
      const userId = client.data.user.userId || client.data.user.sub;
      await this.chatService.markMessagesAsRead(data.conversationId, userId, data.messageIds);

      this.server.to(`conversation:${data.conversationId}`).emit('messages:read', {
        messageIds: data.messageIds,
      });

      return { success: true };
    } catch (error) {
      this.logger.error('❌ Error marking messages as read:', error);
      return { success: false, error: error.message };
    }
  }

  @SubscribeMessage('typing:start')
  handleTypingStart(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    const userId = client.data.user.userId || client.data.user.sub;
    client.to(`conversation:${data.conversationId}`).emit('typing:start', {
      conversationId: data.conversationId,
      userId,
    });
  }

  @SubscribeMessage('typing:stop')
  handleTypingStop(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    const userId = client.data.user.userId || client.data.user.sub;
    client.to(`conversation:${data.conversationId}`).emit('typing:stop', {
      conversationId: data.conversationId,
      userId,
    });
  }

  // ============================================
  // CALL EVENTS
  // ============================================

  @SubscribeMessage('call:initiate')
  async handleCallInitiate(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: InitiateCallDto & { forceNew?: boolean },
  ) {
    try {
      const userId = client.data.user.userId || client.data.user.sub;
      this.logger.log(`📞 Call initiation from user ${userId}`);

      if (!dto.sdpOffer) {
        this.logger.error('❌ No SDP offer provided in call initiation');
        return { success: false, error: 'SDP offer is required to initiate a call' };
      }

      const call = await this.callService.initiateCall(userId, dto);
      const conversation = await this.chatService.getConversation(dto.conversationId, userId);

      const recipientParticipant = conversation.participants.find(
        p => p.userId._id.toString() !== userId,
      );

      if (!recipientParticipant) throw new Error('Recipient not found');

      const recipientId = recipientParticipant.userId._id.toString();

      const initiatorUser = await this.userModel
        .findById(userId)
        .select('name profilePicture email')
        .lean();

      if (!initiatorUser) throw new Error('Initiator user not found in database');

      const incomingCallData = {
        call,
        sdpOffer: dto.sdpOffer,
        initiator: {
          _id: userId,
          name: initiatorUser.name,
          profilePicture: initiatorUser.profilePicture,
          email: initiatorUser.email,
        },
      };

      this.emitToUser(recipientId, 'call:incoming', incomingCallData);
      await this.callService.setCallRinging(call._id.toString());

      this.logger.log(`✅ Call ${call._id} initiated successfully`);
      return { success: true, call };
    } catch (error) {
      this.logger.error('❌ Error initiating call:', error);
      return { success: false, error: error.message };
    }
  }

  @SubscribeMessage('call:answer')
  async handleCallAnswer(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: AnswerCallDto,
  ) {
    try {
      const userId = client.data.user.userId || client.data.user.sub;
      this.logger.log(`📞 User ${userId} answering call ${dto.callId}`);

      if (!dto.sdpAnswer) {
        return { success: false, error: 'SDP answer is required' };
      }

      const call = await this.callService.answerCall(userId, dto);

      const answererUser = await this.userModel
        .findById(userId)
        .select('name profilePicture email')
        .lean();

      const answerData = {
        call,
        sdpAnswer: dto.sdpAnswer,
        answerer: answererUser ? {
          _id: userId,
          name: answererUser.name,
          profilePicture: answererUser.profilePicture,
          email: answererUser.email,
        } : null,
      };

      const initiatorIdString = call.initiatorId.toString();
      this.emitToUser(initiatorIdString, 'call:answered', answerData);

      this.logger.log(`✅ Call ${dto.callId} answered successfully`);
      return { success: true, call };
    } catch (error) {
      this.logger.error('❌ Error answering call:', error);
      return { success: false, error: error.message };
    }
  }

  @SubscribeMessage('call:decline')
  async handleCallDecline(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: DeclineCallDto,
  ) {
    try {
      const userId = client.data.user.userId || client.data.user.sub;
      this.logger.log(`❌ User ${userId} declining call ${dto.callId}`);

      const call = await this.callService.declineCall(userId, dto);
      const initiatorIdString = call.initiatorId.toString();

      this.emitToUser(initiatorIdString, 'call:declined', {
        call,
        reason: dto.reason,
      });

      return { success: true, call };
    } catch (error) {
      this.logger.error('❌ Error declining call:', error);
      return { success: false, error: error.message };
    }
  }

  @SubscribeMessage('call:end')
  async handleCallEnd(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: EndCallDto,
  ) {
    try {
      const userId = client.data.user.userId || client.data.user.sub;
      this.logger.log(`📵 User ${userId} ending call ${dto.callId}`);

      const call = await this.callService.endCall(userId, dto);
      const initiatorIdString = call.initiatorId.toString();
      const recipientIdString = call.recipientId.toString();

      const otherUserId = initiatorIdString === userId ? recipientIdString : initiatorIdString;

      this.emitToUser(otherUserId, 'call:ended', { call, reason: dto.reason });

      return { success: true, call };
    } catch (error) {
      this.logger.error('❌ Error ending call:', error);
      return { success: false, error: error.message };
    }
  }

  @SubscribeMessage('call:connected')
  async handleCallConnected(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { callId: string },
  ) {
    try {
      this.logger.log(`✅ Call ${data.callId} marked as connected`);
      const call = await this.callService.setCallConnected(data.callId);

      const initiatorIdString = call.initiatorId.toString();
      const recipientIdString = call.recipientId.toString();

      this.emitToUser(initiatorIdString, 'call:status', { callId: data.callId, status: 'connected' });
      this.emitToUser(recipientIdString, 'call:status', { callId: data.callId, status: 'connected' });

      return { success: true, call };
    } catch (error) {
      this.logger.error('❌ Error marking call as connected:', error);
      return { success: false, error: error.message };
    }
  }

  @SubscribeMessage('call:ice-candidate')
  async handleIceCandidate(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: IceCandidateDto,
  ) {
    try {
      const userId = client.data.user.userId || client.data.user.sub;
      const call = await this.callService.getCall(dto.callId);

      const initiator = call.initiatorId as any;
      const recipient = call.recipientId as any;
      const initiatorId = initiator._id ? initiator._id.toString() : initiator.toString();
      const recipientId = recipient._id ? recipient._id.toString() : recipient.toString();
      const targetUserId = userId === initiatorId ? recipientId : initiatorId;

      this.emitToUser(targetUserId, 'call:ice-candidate', {
        callId: dto.callId,
        candidate: dto.candidate,
      });

      await this.callService.addIceCandidate(dto.callId, dto.candidate);
      return { success: true };
    } catch (error) {
      this.logger.error('❌ Error handling ICE candidate:', error);
      return { success: false, error: error.message };
    }
  }

  @SubscribeMessage('call:missed')
  async handleCallMissed(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { callId: string },
  ) {
    try {
      this.logger.log(`⏰ Call ${data.callId} marked as missed`);
      const call = await this.callService.markCallAsMissed(data.callId);
      const initiatorIdString = call.initiatorId.toString();

      this.emitToUser(initiatorIdString, 'call:missed', { call });
      return { success: true, call };
    } catch (error) {
      this.logger.error('❌ Error marking call as missed:', error);
      return { success: false, error: error.message };
    }
  }

// ============================================
  // HELPER METHODS
  // ============================================

  private emitToUser(userId: string, event: string, data: any) {
    const sockets = this.userSockets.get(userId);
    if (sockets) {
      sockets.forEach(socketId => {
        this.server.to(socketId).emit(event, data);
      });
      this.logger.log(`📤 Emitted ${event} to user ${userId} (${sockets.size} sockets)`);
    } else {
      this.logger.warn(`⚠️ User ${userId} not connected, cannot emit ${event}`);
    }
  }

  broadcastNewMessage(conversationId: string, message: any) {
    this.server.to(`conversation:${conversationId}`).emit('message:new', { message });
  }
}