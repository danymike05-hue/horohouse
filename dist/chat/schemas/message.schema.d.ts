import { Document, Types } from 'mongoose';
export type MessageDocument = Message & Document;
export declare enum MessageType {
    TEXT = "text",
    IMAGE = "image",
    VIDEO = "video",
    AUDIO = "audio",
    DOCUMENT = "document",
    PROPERTY_CARD = "property_card",
    SYSTEM = "system"
}
export declare enum MessageStatus {
    SENT = "sent",
    DELIVERED = "delivered",
    READ = "read",
    FAILED = "failed"
}
export interface MessageAttachment {
    url: string;
    publicId?: string;
    filename: string;
    size: number;
    mimeType: string;
    thumbnail?: string;
}
export interface PropertyReference {
    propertyId: Types.ObjectId;
    title: string;
    price: number;
    image: string;
    address: string;
    city: string;
}
export declare class Message {
    _id: Types.ObjectId;
    conversationId: Types.ObjectId;
    senderId: Types.ObjectId;
    recipientId: Types.ObjectId;
    type: MessageType;
    content?: string;
    attachments: MessageAttachment[];
    propertyReference?: PropertyReference;
    status: MessageStatus;
    deliveredAt?: Date;
    readAt?: Date;
    isEdited: boolean;
    editedAt?: Date;
    isDeleted: boolean;
    deletedAt?: Date;
    replyTo?: Types.ObjectId;
    metadata?: Record<string, any>;
    createdAt: Date;
    updatedAt: Date;
}
export declare const MessageSchema: import("mongoose").Schema<Message, import("mongoose").Model<Message, any, any, any, Document<unknown, any, Message, any, {}> & Message & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, Message, Document<unknown, {}, import("mongoose").FlatRecord<Message>, {}, import("mongoose").DefaultSchemaOptions> & import("mongoose").FlatRecord<Message> & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}>;
