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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const swagger_1 = require("@nestjs/swagger");
const jwt_auth_guard_1 = require("../auth/guards/jwt.auth.guard");
const chat_service_1 = require("./chat.service");
const call_service_1 = require("./call.service");
const chat_dto_1 = require("./dto/chat.dto");
const cloudinary_1 = require("../utils/cloudinary");
const message_schema_1 = require("./schemas/message.schema");
const call_dto_1 = require("./dto/call.dto");
const chat_gateway_1 = require("./chat.gateway");
let ChatController = class ChatController {
    chatService;
    callService;
    chatGateway;
    constructor(chatService, callService, chatGateway) {
        this.chatService = chatService;
        this.callService = callService;
        this.chatGateway = chatGateway;
    }
    async createConversation(req, dto) {
        return this.chatService.createConversation(req.user.userId, dto);
    }
    async getConversations(req, query) {
        return this.chatService.getConversations(req.user.userId, query);
    }
    async getConversation(req, id) {
        return this.chatService.getConversation(id, req.user.userId);
    }
    async archiveConversation(req, id, dto) {
        return this.chatService.archiveConversation(id, req.user.userId, dto.archive);
    }
    async deleteConversation(req, id) {
        await this.chatService.deleteConversation(id, req.user.userId);
        return { message: 'Conversation deleted successfully' };
    }
    async sendMessage(req, dto) {
        return this.chatService.sendMessage(req.user.userId, dto);
    }
    async sendMessageWithAttachments(req, dto, files) {
        if (!files || files.length === 0) {
            throw new common_1.BadRequestException('No files uploaded');
        }
        const attachments = await Promise.all(files.map(async (file, index) => {
            const publicId = `chat_${dto.conversationId}_${Date.now()}_${index}`;
            const folder = file.mimetype.startsWith('image/')
                ? 'horohouse/chat/images'
                : file.mimetype.startsWith('video/')
                    ? 'horohouse/chat/videos'
                    : 'horohouse/chat/documents';
            const resourceType = file.mimetype.startsWith('image/')
                ? 'image'
                : file.mimetype.startsWith('video/')
                    ? 'video'
                    : 'raw';
            const result = await (0, cloudinary_1.uploadBufferToCloudinary)(file.buffer, {
                publicId,
                folder,
                resourceType: resourceType,
            });
            return {
                url: result.secure_url,
                publicId: result.public_id,
                filename: file.originalname,
                size: file.size,
                mimeType: file.mimetype,
            };
        }));
        let messageType = message_schema_1.MessageType.DOCUMENT;
        if (files[0].mimetype.startsWith('image/')) {
            messageType = message_schema_1.MessageType.IMAGE;
        }
        else if (files[0].mimetype.startsWith('video/')) {
            messageType = message_schema_1.MessageType.VIDEO;
        }
        else if (files[0].mimetype.startsWith('audio/')) {
            messageType = message_schema_1.MessageType.AUDIO;
        }
        const messageDto = { ...dto, type: messageType, attachments };
        const message = await this.chatService.sendMessage(req.user.userId, messageDto);
        this.chatGateway.broadcastNewMessage(dto.conversationId, message);
        return message;
    }
    async getMessages(req, conversationId, query) {
        return this.chatService.getMessages(conversationId, req.user.userId, query);
    }
    async markMessagesAsRead(req, dto) {
        await this.chatService.markMessagesAsRead(dto.conversationId, req.user.userId, dto.messageIds);
        return { message: 'Messages marked as read' };
    }
    async editMessage(req, messageId, dto) {
        return this.chatService.editMessage(messageId, req.user.userId, dto);
    }
    async deleteMessage(req, messageId) {
        await this.chatService.deleteMessage(messageId, req.user.userId);
        return { message: 'Message deleted successfully' };
    }
    async getUnreadCount(req) {
        const count = await this.chatService.getUnreadCount(req.user.userId);
        return { unreadCount: count };
    }
    async getConversationCallHistory(req, conversationId, limit) {
        return this.callService.getCallHistory(conversationId, req.user.userId, limit);
    }
    async getUserCallHistory(req, limit) {
        return this.callService.getUserCallHistory(req.user.userId, limit);
    }
    async getCall(id) {
        return this.callService.getCall(id);
    }
    async initiateCall(req, dto) {
        return this.callService.initiateCall(req.user.userId, dto);
    }
};
exports.ChatController = ChatController;
__decorate([
    (0, common_1.Post)('conversations'),
    (0, swagger_1.ApiOperation)({ summary: 'Create or get existing conversation' }),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, chat_dto_1.CreateConversationDto]),
    __metadata("design:returntype", Promise)
], ChatController.prototype, "createConversation", null);
__decorate([
    (0, common_1.Get)('conversations'),
    (0, swagger_1.ApiOperation)({ summary: 'Get user conversations with pagination' }),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, chat_dto_1.GetConversationsQueryDto]),
    __metadata("design:returntype", Promise)
], ChatController.prototype, "getConversations", null);
__decorate([
    (0, common_1.Get)('conversations/:id'),
    (0, swagger_1.ApiOperation)({ summary: 'Get conversation by ID' }),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ChatController.prototype, "getConversation", null);
__decorate([
    (0, common_1.Put)('conversations/:id/archive'),
    (0, swagger_1.ApiOperation)({ summary: 'Archive or unarchive conversation' }),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, chat_dto_1.ArchiveConversationDto]),
    __metadata("design:returntype", Promise)
], ChatController.prototype, "archiveConversation", null);
__decorate([
    (0, common_1.Delete)('conversations/:id'),
    (0, swagger_1.ApiOperation)({ summary: 'Delete conversation (archive for user)' }),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ChatController.prototype, "deleteConversation", null);
__decorate([
    (0, common_1.Post)('messages'),
    (0, swagger_1.ApiOperation)({ summary: 'Send a message' }),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, chat_dto_1.SendMessageDto]),
    __metadata("design:returntype", Promise)
], ChatController.prototype, "sendMessage", null);
__decorate([
    (0, common_1.Post)('messages/with-attachments'),
    (0, swagger_1.ApiOperation)({ summary: 'Send message with file attachments' }),
    (0, swagger_1.ApiConsumes)('multipart/form-data'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FilesInterceptor)('files', 5)),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.UploadedFiles)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, chat_dto_1.SendMessageDto, Array]),
    __metadata("design:returntype", Promise)
], ChatController.prototype, "sendMessageWithAttachments", null);
__decorate([
    (0, common_1.Get)('conversations/:id/messages'),
    (0, swagger_1.ApiOperation)({ summary: 'Get messages in conversation with pagination' }),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, chat_dto_1.GetMessagesQueryDto]),
    __metadata("design:returntype", Promise)
], ChatController.prototype, "getMessages", null);
__decorate([
    (0, common_1.Post)('messages/mark-read'),
    (0, swagger_1.ApiOperation)({ summary: 'Mark messages as read' }),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ChatController.prototype, "markMessagesAsRead", null);
__decorate([
    (0, common_1.Put)('messages/:id'),
    (0, swagger_1.ApiOperation)({ summary: 'Edit a message' }),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, chat_dto_1.EditMessageDto]),
    __metadata("design:returntype", Promise)
], ChatController.prototype, "editMessage", null);
__decorate([
    (0, common_1.Delete)('messages/:id'),
    (0, swagger_1.ApiOperation)({ summary: 'Delete a message' }),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ChatController.prototype, "deleteMessage", null);
__decorate([
    (0, common_1.Get)('unread-count'),
    (0, swagger_1.ApiOperation)({ summary: 'Get total unread messages count' }),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ChatController.prototype, "getUnreadCount", null);
__decorate([
    (0, common_1.Get)('conversations/:id/calls'),
    (0, swagger_1.ApiOperation)({ summary: 'Get call history for conversation' }),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Number]),
    __metadata("design:returntype", Promise)
], ChatController.prototype, "getConversationCallHistory", null);
__decorate([
    (0, common_1.Get)('calls/history'),
    (0, swagger_1.ApiOperation)({ summary: 'Get user call history' }),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number]),
    __metadata("design:returntype", Promise)
], ChatController.prototype, "getUserCallHistory", null);
__decorate([
    (0, common_1.Get)('calls/:id'),
    (0, swagger_1.ApiOperation)({ summary: 'Get call by ID' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ChatController.prototype, "getCall", null);
__decorate([
    (0, common_1.Post)('calls/initiate'),
    (0, swagger_1.ApiOperation)({ summary: 'Initiate a call (use WebSocket for real-time)' }),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, call_dto_1.InitiateCallDto]),
    __metadata("design:returntype", Promise)
], ChatController.prototype, "initiateCall", null);
exports.ChatController = ChatController = __decorate([
    (0, swagger_1.ApiTags)('Chat'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('chat'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [chat_service_1.ChatService,
        call_service_1.CallService,
        chat_gateway_1.ChatGateway])
], ChatController);
//# sourceMappingURL=chat.controller.js.map