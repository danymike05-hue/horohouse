import { Document, Types } from 'mongoose';
export type LeadDocument = Lead & Document;
export declare enum LeadStatus {
    NEW = "new",
    CONTACTED = "contacted",
    QUALIFIED = "qualified",
    LOST = "lost"
}
export declare enum LeadSource {
    WEBSITE = "website",
    REFERRAL = "referral",
    MESSAGE = "message",
    CAMPAIGN = "campaign"
}
export declare enum LeadPriority {
    LOW = "low",
    MEDIUM = "medium",
    HIGH = "high"
}
export declare class LeadNote {
    _id: Types.ObjectId;
    content: string;
    createdAt: Date;
}
export declare const LeadNoteSchema: import("mongoose").Schema<LeadNote, import("mongoose").Model<LeadNote, any, any, any, Document<unknown, any, LeadNote, any, {}> & LeadNote & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, LeadNote, Document<unknown, {}, import("mongoose").FlatRecord<LeadNote>, {}, import("mongoose").DefaultSchemaOptions> & import("mongoose").FlatRecord<LeadNote> & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}>;
export declare class Lead {
    name: string;
    email?: string;
    phone?: string;
    interest?: string;
    source: LeadSource;
    status: LeadStatus;
    location?: string;
    lastContactedAt?: Date;
    budget?: number;
    propertyType?: string;
    priority?: LeadPriority;
    assignedAgent?: string;
    tags: string[];
    notes: LeadNote[];
}
export declare const LeadSchema: import("mongoose").Schema<Lead, import("mongoose").Model<Lead, any, any, any, Document<unknown, any, Lead, any, {}> & Lead & {
    _id: Types.ObjectId;
} & {
    __v: number;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, Lead, Document<unknown, {}, import("mongoose").FlatRecord<Lead>, {}, import("mongoose").DefaultSchemaOptions> & import("mongoose").FlatRecord<Lead> & {
    _id: Types.ObjectId;
} & {
    __v: number;
}>;
