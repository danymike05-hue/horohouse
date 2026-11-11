import { MessageType } from '../schemas/message.schema';
export declare class CreateConversationDto {
    participantId: string;
    propertyId?: string;
    initialMessage?: string;
}
export declare class SendMessageDto {
    conversationId: string;
    content?: string;
    type?: MessageType;
    propertyId?: string;
    replyTo?: string;
}
export declare class EditMessageDto {
    content: string;
}
export declare class GetMessagesQueryDto {
    page?: number;
    limit?: number;
    before?: string;
}
export declare class GetConversationsQueryDto {
    page?: number;
    limit?: number;
    includeArchived?: boolean;
    filter?: 'unread' | 'all';
}
export declare class MarkAsReadDto {
    messageIds: string[];
}
export declare class TypingIndicatorDto {
    conversationId: string;
    isTyping: boolean;
}
export declare class ArchiveConversationDto {
    archive: boolean;
}
export declare class BlockUserDto {
    userId: string;
    block: boolean;
}
export declare class WsMessageDto {
    conversationId: string;
    content?: string;
    type?: MessageType;
    propertyId?: string;
    replyTo?: string;
}
export declare class WsTypingDto {
    conversationId: string;
    isTyping: boolean;
}
export declare class WsMarkReadDto {
    conversationId: string;
    messageIds: string[];
}
