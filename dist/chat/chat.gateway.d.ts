import { OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { Model } from 'mongoose';
import { CallService } from './call.service';
import { ChatService } from './chat.service';
import { UserDocument } from '../users/schemas/user.schema';
import { InitiateCallDto, AnswerCallDto, DeclineCallDto, EndCallDto, IceCandidateDto } from './dto/call.dto';
export declare class ChatGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
    private readonly chatService;
    private readonly callService;
    private readonly jwtService;
    private userModel;
    server: Server;
    private readonly logger;
    private userSockets;
    constructor(chatService: ChatService, callService: CallService, jwtService: JwtService, userModel: Model<UserDocument>);
    afterInit(server: Server): void;
    handleConnection(client: Socket): Promise<void>;
    handleDisconnect(client: Socket): Promise<void>;
    handleJoinConversation(client: Socket, data: {
        conversationId: string;
    }): Promise<{
        success: boolean;
        error?: undefined;
    } | {
        success: boolean;
        error: any;
    }>;
    handleSendMessage(client: Socket, data: any): Promise<{
        success: boolean;
        message: import("./schemas/message.schema").Message;
        error?: undefined;
    } | {
        success: boolean;
        error: any;
        message?: undefined;
    }>;
    handleMarkAsRead(client: Socket, data: {
        conversationId: string;
        messageIds: string[];
    }): Promise<{
        success: boolean;
        error?: undefined;
    } | {
        success: boolean;
        error: any;
    }>;
    handleTypingStart(client: Socket, data: {
        conversationId: string;
    }): void;
    handleTypingStop(client: Socket, data: {
        conversationId: string;
    }): void;
    handleCallInitiate(client: Socket, dto: InitiateCallDto & {
        forceNew?: boolean;
    }): Promise<{
        success: boolean;
        call: import("./schemas/call.schema").Call;
        error?: undefined;
    } | {
        success: boolean;
        error: any;
        call?: undefined;
    }>;
    handleCallAnswer(client: Socket, dto: AnswerCallDto): Promise<{
        success: boolean;
        call: import("./schemas/call.schema").Call;
        error?: undefined;
    } | {
        success: boolean;
        error: any;
        call?: undefined;
    }>;
    handleCallDecline(client: Socket, dto: DeclineCallDto): Promise<{
        success: boolean;
        call: import("./schemas/call.schema").Call;
        error?: undefined;
    } | {
        success: boolean;
        error: any;
        call?: undefined;
    }>;
    handleCallEnd(client: Socket, dto: EndCallDto): Promise<{
        success: boolean;
        call: import("./schemas/call.schema").Call;
        error?: undefined;
    } | {
        success: boolean;
        error: any;
        call?: undefined;
    }>;
    handleCallConnected(client: Socket, data: {
        callId: string;
    }): Promise<{
        success: boolean;
        call: import("./schemas/call.schema").Call;
        error?: undefined;
    } | {
        success: boolean;
        error: any;
        call?: undefined;
    }>;
    handleIceCandidate(client: Socket, dto: IceCandidateDto): Promise<{
        success: boolean;
        error?: undefined;
    } | {
        success: boolean;
        error: any;
    }>;
    handleCallMissed(client: Socket, data: {
        callId: string;
    }): Promise<{
        success: boolean;
        call: import("./schemas/call.schema").Call;
        error?: undefined;
    } | {
        success: boolean;
        error: any;
        call?: undefined;
    }>;
    private emitToUser;
    broadcastNewMessage(conversationId: string, message: any): void;
}
