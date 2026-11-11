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
Object.defineProperty(exports, "__esModule", { value: true });
exports.WsMarkReadDto = exports.WsTypingDto = exports.WsMessageDto = exports.BlockUserDto = exports.ArchiveConversationDto = exports.TypingIndicatorDto = exports.MarkAsReadDto = exports.GetConversationsQueryDto = exports.GetMessagesQueryDto = exports.EditMessageDto = exports.SendMessageDto = exports.CreateConversationDto = void 0;
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
const swagger_1 = require("@nestjs/swagger");
const message_schema_1 = require("../schemas/message.schema");
class CreateConversationDto {
    participantId;
    propertyId;
    initialMessage;
}
exports.CreateConversationDto = CreateConversationDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        example: '507f1f77bcf86cd799439011',
        description: 'ID of the other participant'
    }),
    (0, class_validator_1.IsMongoId)(),
    __metadata("design:type", String)
], CreateConversationDto.prototype, "participantId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: '507f1f77bcf86cd799439012',
        description: 'Property ID if conversation is about a property'
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsMongoId)(),
    __metadata("design:type", String)
], CreateConversationDto.prototype, "propertyId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: 'Hi, I am interested in this property',
        description: 'Initial message content'
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateConversationDto.prototype, "initialMessage", void 0);
class SendMessageDto {
    conversationId;
    content;
    type;
    propertyId;
    replyTo;
}
exports.SendMessageDto = SendMessageDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        example: '507f1f77bcf86cd799439011',
        description: 'Conversation ID'
    }),
    (0, class_validator_1.IsMongoId)(),
    __metadata("design:type", String)
], SendMessageDto.prototype, "conversationId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: 'Hello, is this property still available?',
        description: 'Message content'
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SendMessageDto.prototype, "content", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        enum: message_schema_1.MessageType,
        example: message_schema_1.MessageType.TEXT,
        description: 'Type of message'
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(message_schema_1.MessageType),
    __metadata("design:type", String)
], SendMessageDto.prototype, "type", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: '507f1f77bcf86cd799439012',
        description: 'Property ID if sharing a property'
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsMongoId)(),
    __metadata("design:type", String)
], SendMessageDto.prototype, "propertyId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: '507f1f77bcf86cd799439013',
        description: 'Message ID to reply to'
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsMongoId)(),
    __metadata("design:type", String)
], SendMessageDto.prototype, "replyTo", void 0);
class EditMessageDto {
    content;
}
exports.EditMessageDto = EditMessageDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 'Updated message content',
        description: 'New message content'
    }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], EditMessageDto.prototype, "content", void 0);
class GetMessagesQueryDto {
    page = 1;
    limit = 50;
    before;
}
exports.GetMessagesQueryDto = GetMessagesQueryDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: 1,
        description: 'Page number'
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], GetMessagesQueryDto.prototype, "page", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: 50,
        description: 'Messages per page'
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(100),
    __metadata("design:type", Number)
], GetMessagesQueryDto.prototype, "limit", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: '507f1f77bcf86cd799439011',
        description: 'Get messages before this message ID (for pagination)'
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsMongoId)(),
    __metadata("design:type", String)
], GetMessagesQueryDto.prototype, "before", void 0);
class GetConversationsQueryDto {
    page = 1;
    limit = 20;
    includeArchived = false;
    filter;
}
exports.GetConversationsQueryDto = GetConversationsQueryDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: 1,
        description: 'Page number'
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], GetConversationsQueryDto.prototype, "page", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: 20,
        description: 'Conversations per page'
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(50),
    __metadata("design:type", Number)
], GetConversationsQueryDto.prototype, "limit", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: false,
        description: 'Include archived conversations'
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    (0, class_transformer_1.Type)(() => Boolean),
    __metadata("design:type", Boolean)
], GetConversationsQueryDto.prototype, "includeArchived", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: 'unread',
        description: 'Filter by unread messages'
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], GetConversationsQueryDto.prototype, "filter", void 0);
class MarkAsReadDto {
    messageIds;
}
exports.MarkAsReadDto = MarkAsReadDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        example: ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012'],
        description: 'Array of message IDs to mark as read'
    }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsMongoId)({ each: true }),
    __metadata("design:type", Array)
], MarkAsReadDto.prototype, "messageIds", void 0);
class TypingIndicatorDto {
    conversationId;
    isTyping;
}
exports.TypingIndicatorDto = TypingIndicatorDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        example: '507f1f77bcf86cd799439011',
        description: 'Conversation ID'
    }),
    (0, class_validator_1.IsMongoId)(),
    __metadata("design:type", String)
], TypingIndicatorDto.prototype, "conversationId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: true,
        description: 'Whether user is typing'
    }),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], TypingIndicatorDto.prototype, "isTyping", void 0);
class ArchiveConversationDto {
    archive;
}
exports.ArchiveConversationDto = ArchiveConversationDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        example: true,
        description: 'Whether to archive or unarchive'
    }),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], ArchiveConversationDto.prototype, "archive", void 0);
class BlockUserDto {
    userId;
    block;
}
exports.BlockUserDto = BlockUserDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        example: '507f1f77bcf86cd799439011',
        description: 'User ID to block'
    }),
    (0, class_validator_1.IsMongoId)(),
    __metadata("design:type", String)
], BlockUserDto.prototype, "userId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: true,
        description: 'Whether to block or unblock'
    }),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], BlockUserDto.prototype, "block", void 0);
class WsMessageDto {
    conversationId;
    content;
    type;
    propertyId;
    replyTo;
}
exports.WsMessageDto = WsMessageDto;
__decorate([
    (0, class_validator_1.IsMongoId)(),
    __metadata("design:type", String)
], WsMessageDto.prototype, "conversationId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], WsMessageDto.prototype, "content", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(message_schema_1.MessageType),
    __metadata("design:type", String)
], WsMessageDto.prototype, "type", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsMongoId)(),
    __metadata("design:type", String)
], WsMessageDto.prototype, "propertyId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsMongoId)(),
    __metadata("design:type", String)
], WsMessageDto.prototype, "replyTo", void 0);
class WsTypingDto {
    conversationId;
    isTyping;
}
exports.WsTypingDto = WsTypingDto;
__decorate([
    (0, class_validator_1.IsMongoId)(),
    __metadata("design:type", String)
], WsTypingDto.prototype, "conversationId", void 0);
__decorate([
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], WsTypingDto.prototype, "isTyping", void 0);
class WsMarkReadDto {
    conversationId;
    messageIds;
}
exports.WsMarkReadDto = WsMarkReadDto;
__decorate([
    (0, class_validator_1.IsMongoId)(),
    __metadata("design:type", String)
], WsMarkReadDto.prototype, "conversationId", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsMongoId)({ each: true }),
    __metadata("design:type", Array)
], WsMarkReadDto.prototype, "messageIds", void 0);
//# sourceMappingURL=chat.dto.js.map