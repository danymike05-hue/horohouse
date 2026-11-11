import { Document, Types } from 'mongoose';
export type ConversationDocument = Conversation & Document;
export interface ParticipantInfo {
    userId: Types.ObjectId;
    unreadCount: number;
    lastReadAt?: Date;
    mutedUntil?: Date;
    joinedAt: Date;
}
export interface LastMessage {
    content: string;
    senderId: Types.ObjectId;
    createdAt: Date;
    type: string;
}
export declare class Conversation {
    _id: Types.ObjectId;
    participants: ParticipantInfo[];
    propertyId?: Types.ObjectId;
    lastMessage?: LastMessage;
    messagesCount: number;
    typingUsers: Map<string, boolean>;
    onlineStatus: Map<string, string>;
    isArchived: boolean;
    archivedAt?: Date;
    archivedBy: Types.ObjectId[];
    isBlocked: boolean;
    blockedBy?: Types.ObjectId;
    blockedAt?: Date;
    metadata?: Record<string, any>;
    createdAt: Date;
    updatedAt: Date;
}
export declare const ConversationSchema: import("mongoose").Schema<Conversation, import("mongoose").Model<Conversation, any, any, any, Document<unknown, any, Conversation, any, {}> & Conversation & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, Conversation, Document<unknown, {}, import("mongoose").FlatRecord<Conversation>, {}, import("mongoose").DefaultSchemaOptions> & import("mongoose").FlatRecord<Conversation> & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}>;
