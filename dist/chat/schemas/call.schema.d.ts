import { Document, Types } from 'mongoose';
export type CallDocument = Call & Document;
export declare enum CallType {
    AUDIO = "audio",
    VIDEO = "video"
}
export declare enum CallStatus {
    INITIATING = "initiating",
    RINGING = "ringing",
    CONNECTING = "connecting",
    CONNECTED = "connected",
    ENDED = "ended",
    DECLINED = "declined",
    MISSED = "missed",
    FAILED = "failed",
    CANCELLED = "cancelled"
}
export declare enum CallEndReason {
    COMPLETED = "completed",
    DECLINED = "declined",
    MISSED = "missed",
    CANCELLED = "cancelled",
    FAILED = "failed",
    BUSY = "busy",
    NO_ANSWER = "no_answer"
}
export interface CallParticipant {
    userId: Types.ObjectId;
    joinedAt?: Date;
    leftAt?: Date;
    status: 'joining' | 'connected' | 'disconnected';
}
export declare class Call {
    _id: Types.ObjectId;
    conversationId: Types.ObjectId;
    initiatorId: Types.ObjectId;
    recipientId: Types.ObjectId;
    type: CallType;
    status: CallStatus;
    participants: CallParticipant[];
    startedAt?: Date;
    endedAt?: Date;
    duration: number;
    endReason?: CallEndReason;
    quality?: {
        audioQuality: number;
        videoQuality: number;
        networkIssues: number;
    };
    metadata?: {
        iceServers?: any[];
        sdp?: any;
        candidates?: any[];
    };
    createdAt: Date;
    updatedAt: Date;
}
export declare const CallSchema: import("mongoose").Schema<Call, import("mongoose").Model<Call, any, any, any, Document<unknown, any, Call, any, {}> & Call & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, Call, Document<unknown, {}, import("mongoose").FlatRecord<Call>, {}, import("mongoose").DefaultSchemaOptions> & import("mongoose").FlatRecord<Call> & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}>;
