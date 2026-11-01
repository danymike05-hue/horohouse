import { ChatService } from './chat.service';
import { CallService } from './call.service';
import { CreateConversationDto, SendMessageDto, GetMessagesQueryDto, GetConversationsQueryDto, EditMessageDto, MarkAsReadDto, ArchiveConversationDto } from './dto/chat.dto';
import { InitiateCallDto } from './dto/call.dto';
import { ChatGateway } from './chat.gateway';
export declare class ChatController {
    private readonly chatService;
    private readonly callService;
    private readonly chatGateway;
    constructor(chatService: ChatService, callService: CallService, chatGateway: ChatGateway);
    createConversation(req: any, dto: CreateConversationDto): Promise<import("./schemas/conversation.schema").Conversation>;
    getConversations(req: any, query: GetConversationsQueryDto): Promise<any>;
    getConversation(req: any, id: string): Promise<import("./schemas/conversation.schema").Conversation>;
    archiveConversation(req: any, id: string, dto: ArchiveConversationDto): Promise<import("./schemas/conversation.schema").Conversation>;
    deleteConversation(req: any, id: string): Promise<{
        message: string;
    }>;
    sendMessage(req: any, dto: SendMessageDto): Promise<import("./schemas/message.schema").Message>;
    sendMessageWithAttachments(req: any, dto: SendMessageDto, files: Express.Multer.File[]): Promise<import("./schemas/message.schema").Message>;
    getMessages(req: any, conversationId: string, query: GetMessagesQueryDto): Promise<{
        messages: (import("mongoose").FlattenMaps<import("./schemas/message.schema").MessageDocument> & Required<{
            _id: import("mongoose").Types.ObjectId;
        }> & {
            __v: number;
        })[];
        total: number;
        page: number;
        totalPages: number;
        hasMore: boolean;
    }>;
    markMessagesAsRead(req: any, dto: MarkAsReadDto & {
        conversationId: string;
    }): Promise<{
        message: string;
    }>;
    editMessage(req: any, messageId: string, dto: EditMessageDto): Promise<import("./schemas/message.schema").Message>;
    deleteMessage(req: any, messageId: string): Promise<{
        message: string;
    }>;
    getUnreadCount(req: any): Promise<{
        unreadCount: number;
    }>;
    getConversationCallHistory(req: any, conversationId: string, limit?: number): Promise<import("./schemas/call.schema").Call[]>;
    getUserCallHistory(req: any, limit?: number): Promise<import("./schemas/call.schema").Call[]>;
    getCall(id: string): Promise<import("./schemas/call.schema").Call>;
    initiateCall(req: any, dto: InitiateCallDto): Promise<import("./schemas/call.schema").Call>;
}
