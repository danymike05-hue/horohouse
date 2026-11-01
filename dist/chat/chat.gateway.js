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
var ChatGateway_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatGateway = void 0;
const websockets_1 = require("@nestjs/websockets");
const socket_io_1 = require("socket.io");
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const call_service_1 = require("./call.service");
const chat_service_1 = require("./chat.service");
const user_schema_1 = require("../users/schemas/user.schema");
const call_dto_1 = require("./dto/call.dto");
let ChatGateway = ChatGateway_1 = class ChatGateway {
    chatService;
    callService;
    jwtService;
    userModel;
    server;
    logger = new common_1.Logger(ChatGateway_1.name);
    userSockets = new Map();
    constructor(chatService, callService, jwtService, userModel) {
        this.chatService = chatService;
        this.callService = callService;
        this.jwtService = jwtService;
        this.userModel = userModel;
    }
    afterInit(server) {
        this.logger.log('🔌 Chat Gateway initialized');
        this.logger.log(`📡 Namespace: /chat`);
        this.logger.log(`🌍 CORS origin: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
        server.use(async (socket, next) => {
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
                }
                catch (error) {
                    this.logger.error(`❌ Token verification failed: ${error.message}`);
                    return next(new Error(`Authentication error: ${error.message}`));
                }
            }
            catch (error) {
                this.logger.error(`❌ Auth middleware error: ${error.message}`);
                return next(new Error('Authentication error'));
            }
        });
        this.logger.log('✅ Authentication middleware registered');
    }
    async handleConnection(client) {
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
            this.userSockets.get(userId).add(client.id);
            this.logger.log(`✅ User ${userId} connected (${this.userSockets.get(userId).size} sockets)`);
            this.server.emit('user:status', { userId, status: 'online' });
            client.emit('connection:success', {
                userId,
                socketId: client.id,
                timestamp: new Date().toISOString(),
                message: 'Connected successfully to chat server',
            });
        }
        catch (error) {
            this.logger.error(`❌ Connection error: ${error.message}`);
            client.emit('error', { message: `Connection failed: ${error.message}` });
            client.disconnect(true);
        }
    }
    async handleDisconnect(client) {
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
        }
        catch (error) {
            this.logger.error(`❌ Disconnection error: ${error.message}`);
        }
    }
    async handleJoinConversation(client, data) {
        try {
            const userId = client.data.user.userId || client.data.user.sub;
            client.join(`conversation:${data.conversationId}`);
            this.logger.log(`✅ User ${userId} joined conversation: ${data.conversationId}`);
            return { success: true };
        }
        catch (error) {
            this.logger.error('❌ Error joining conversation:', error);
            return { success: false, error: error.message };
        }
    }
    async handleSendMessage(client, data) {
        try {
            const userId = client.data.user.userId || client.data.user.sub;
            this.logger.log(`📨 Sending message from user ${userId}, tempId: ${data.tempId}`);
            const message = await this.chatService.sendMessage(userId, {
                conversationId: data.conversationId,
                content: data.content,
                type: data.type || 'text',
            });
            this.server.to(`conversation:${data.conversationId}`).emit('message:new', {
                message,
            });
            client.emit('message:sent', {
                message: {
                    ...message,
                    tempId: data.tempId,
                },
            });
            return { success: true, message };
        }
        catch (error) {
            this.logger.error('❌ Error sending message:', error);
            return { success: false, error: error.message };
        }
    }
    async handleMarkAsRead(client, data) {
        try {
            const userId = client.data.user.userId || client.data.user.sub;
            await this.chatService.markMessagesAsRead(data.conversationId, userId, data.messageIds);
            this.server.to(`conversation:${data.conversationId}`).emit('messages:read', {
                messageIds: data.messageIds,
            });
            return { success: true };
        }
        catch (error) {
            this.logger.error('❌ Error marking messages as read:', error);
            return { success: false, error: error.message };
        }
    }
    handleTypingStart(client, data) {
        const userId = client.data.user.userId || client.data.user.sub;
        client.to(`conversation:${data.conversationId}`).emit('typing:start', {
            conversationId: data.conversationId,
            userId,
        });
    }
    handleTypingStop(client, data) {
        const userId = client.data.user.userId || client.data.user.sub;
        client.to(`conversation:${data.conversationId}`).emit('typing:stop', {
            conversationId: data.conversationId,
            userId,
        });
    }
    async handleCallInitiate(client, dto) {
        try {
            const userId = client.data.user.userId || client.data.user.sub;
            this.logger.log(`📞 Call initiation from user ${userId}`);
            if (!dto.sdpOffer) {
                this.logger.error('❌ No SDP offer provided in call initiation');
                return { success: false, error: 'SDP offer is required to initiate a call' };
            }
            const call = await this.callService.initiateCall(userId, dto);
            const conversation = await this.chatService.getConversation(dto.conversationId, userId);
            const recipientParticipant = conversation.participants.find(p => p.userId._id.toString() !== userId);
            if (!recipientParticipant)
                throw new Error('Recipient not found');
            const recipientId = recipientParticipant.userId._id.toString();
            const initiatorUser = await this.userModel
                .findById(userId)
                .select('name profilePicture email')
                .lean();
            if (!initiatorUser)
                throw new Error('Initiator user not found in database');
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
        }
        catch (error) {
            this.logger.error('❌ Error initiating call:', error);
            return { success: false, error: error.message };
        }
    }
    async handleCallAnswer(client, dto) {
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
        }
        catch (error) {
            this.logger.error('❌ Error answering call:', error);
            return { success: false, error: error.message };
        }
    }
    async handleCallDecline(client, dto) {
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
        }
        catch (error) {
            this.logger.error('❌ Error declining call:', error);
            return { success: false, error: error.message };
        }
    }
    async handleCallEnd(client, dto) {
        try {
            const userId = client.data.user.userId || client.data.user.sub;
            this.logger.log(`📵 User ${userId} ending call ${dto.callId}`);
            const call = await this.callService.endCall(userId, dto);
            const initiatorIdString = call.initiatorId.toString();
            const recipientIdString = call.recipientId.toString();
            const otherUserId = initiatorIdString === userId ? recipientIdString : initiatorIdString;
            this.emitToUser(otherUserId, 'call:ended', { call, reason: dto.reason });
            return { success: true, call };
        }
        catch (error) {
            this.logger.error('❌ Error ending call:', error);
            return { success: false, error: error.message };
        }
    }
    async handleCallConnected(client, data) {
        try {
            this.logger.log(`✅ Call ${data.callId} marked as connected`);
            const call = await this.callService.setCallConnected(data.callId);
            const initiatorIdString = call.initiatorId.toString();
            const recipientIdString = call.recipientId.toString();
            this.emitToUser(initiatorIdString, 'call:status', { callId: data.callId, status: 'connected' });
            this.emitToUser(recipientIdString, 'call:status', { callId: data.callId, status: 'connected' });
            return { success: true, call };
        }
        catch (error) {
            this.logger.error('❌ Error marking call as connected:', error);
            return { success: false, error: error.message };
        }
    }
    async handleIceCandidate(client, dto) {
        try {
            const userId = client.data.user.userId || client.data.user.sub;
            const call = await this.callService.getCall(dto.callId);
            const initiator = call.initiatorId;
            const recipient = call.recipientId;
            const initiatorId = initiator._id ? initiator._id.toString() : initiator.toString();
            const recipientId = recipient._id ? recipient._id.toString() : recipient.toString();
            const targetUserId = userId === initiatorId ? recipientId : initiatorId;
            this.emitToUser(targetUserId, 'call:ice-candidate', {
                callId: dto.callId,
                candidate: dto.candidate,
            });
            await this.callService.addIceCandidate(dto.callId, dto.candidate);
            return { success: true };
        }
        catch (error) {
            this.logger.error('❌ Error handling ICE candidate:', error);
            return { success: false, error: error.message };
        }
    }
    async handleCallMissed(client, data) {
        try {
            this.logger.log(`⏰ Call ${data.callId} marked as missed`);
            const call = await this.callService.markCallAsMissed(data.callId);
            const initiatorIdString = call.initiatorId.toString();
            this.emitToUser(initiatorIdString, 'call:missed', { call });
            return { success: true, call };
        }
        catch (error) {
            this.logger.error('❌ Error marking call as missed:', error);
            return { success: false, error: error.message };
        }
    }
    emitToUser(userId, event, data) {
        const sockets = this.userSockets.get(userId);
        if (sockets) {
            sockets.forEach(socketId => {
                this.server.to(socketId).emit(event, data);
            });
            this.logger.log(`📤 Emitted ${event} to user ${userId} (${sockets.size} sockets)`);
        }
        else {
            this.logger.warn(`⚠️ User ${userId} not connected, cannot emit ${event}`);
        }
    }
    broadcastNewMessage(conversationId, message) {
        this.server.to(`conversation:${conversationId}`).emit('message:new', { message });
    }
};
exports.ChatGateway = ChatGateway;
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", socket_io_1.Server)
], ChatGateway.prototype, "server", void 0);
__decorate([
    (0, websockets_1.SubscribeMessage)('conversation:join'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", Promise)
], ChatGateway.prototype, "handleJoinConversation", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('message:send'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", Promise)
], ChatGateway.prototype, "handleSendMessage", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('messages:read'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", Promise)
], ChatGateway.prototype, "handleMarkAsRead", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('typing:start'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", void 0)
], ChatGateway.prototype, "handleTypingStart", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('typing:stop'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", void 0)
], ChatGateway.prototype, "handleTypingStop", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('call:initiate'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", Promise)
], ChatGateway.prototype, "handleCallInitiate", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('call:answer'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket,
        call_dto_1.AnswerCallDto]),
    __metadata("design:returntype", Promise)
], ChatGateway.prototype, "handleCallAnswer", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('call:decline'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket,
        call_dto_1.DeclineCallDto]),
    __metadata("design:returntype", Promise)
], ChatGateway.prototype, "handleCallDecline", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('call:end'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket,
        call_dto_1.EndCallDto]),
    __metadata("design:returntype", Promise)
], ChatGateway.prototype, "handleCallEnd", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('call:connected'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", Promise)
], ChatGateway.prototype, "handleCallConnected", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('call:ice-candidate'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket,
        call_dto_1.IceCandidateDto]),
    __metadata("design:returntype", Promise)
], ChatGateway.prototype, "handleIceCandidate", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('call:missed'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", Promise)
], ChatGateway.prototype, "handleCallMissed", null);
exports.ChatGateway = ChatGateway = ChatGateway_1 = __decorate([
    (0, websockets_1.WebSocketGateway)({
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
    }),
    __param(3, (0, mongoose_1.InjectModel)(user_schema_1.User.name)),
    __metadata("design:paramtypes", [chat_service_1.ChatService,
        call_service_1.CallService,
        jwt_1.JwtService,
        mongoose_2.Model])
], ChatGateway);
//# sourceMappingURL=chat.gateway.js.map