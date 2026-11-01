import { OnModuleInit } from '@nestjs/common';
import { Model, Types } from 'mongoose';
import { Conversation, ConversationDocument } from './schemas/conversation.schema';
import { Message, MessageAttachment, MessageDocument, MessageStatus } from './schemas/message.schema';
import { PropertyDocument } from '../properties/schemas/property.schema';
import { UserDocument } from '../users/schemas/user.schema';
import { CreateConversationDto, SendMessageDto, GetMessagesQueryDto, GetConversationsQueryDto, EditMessageDto } from './dto/chat.dto';
export declare class ChatService implements OnModuleInit {
    private conversationModel;
    private messageModel;
    private propertyModel;
    private userModel;
    private readonly logger;
    constructor(conversationModel: Model<ConversationDocument>, messageModel: Model<MessageDocument>, propertyModel: Model<PropertyDocument>, userModel: Model<UserDocument>);
    onModuleInit(): Promise<void>;
    createConversation(userId: string, dto: CreateConversationDto): Promise<Conversation>;
    private findExistingConversation;
    getConversations(userId: string, query: GetConversationsQueryDto): Promise<{
        conversations: any[];
        total: number;
        page: number;
        totalPages: number;
    }>;
    getConversation(conversationId: string, userId: string): Promise<Conversation>;
    sendMessage(userId: string, dto: SendMessageDto & {
        attachments?: MessageAttachment[];
    }): Promise<Message>;
    getMessages(conversationId: string, userId: string, query: GetMessagesQueryDto): Promise<{
        messages: (import("mongoose").FlattenMaps<MessageDocument> & Required<{
            _id: Types.ObjectId;
        }> & {
            __v: number;
        })[];
        total: number;
        page: number;
        totalPages: number;
        hasMore: boolean;
    }>;
    markMessagesAsRead(conversationId: string, userId: string, messageIds: string[]): Promise<void>;
    updateMessageStatus(messageId: string, status: MessageStatus): Promise<void>;
    editMessage(messageId: string, userId: string, dto: EditMessageDto): Promise<Message>;
    deleteMessage(messageId: string, userId: string): Promise<void>;
    archiveConversation(conversationId: string, userId: string, archive: boolean): Promise<Conversation>;
    deleteConversation(conversationId: string, userId: string): Promise<void>;
    getUnreadCount(userId: string): Promise<number>;
    updateTypingIndicator(conversationId: string, userId: string, isTyping: boolean): Promise<void>;
    updateOnlineStatus(userId: string, status: 'online' | 'offline' | 'away'): Promise<void>;
}
