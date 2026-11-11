import { Document, Types } from 'mongoose';
export type InquiryDocument = Inquiry & Document;
export declare enum InquiryStatus {
    PENDING = "pending",
    RESPONDED = "responded",
    CLOSED = "closed"
}
export declare enum InquiryType {
    GENERAL = "general",
    VIEWING_REQUEST = "viewing_request",
    PRICE_INQUIRY = "price_inquiry",
    AVAILABILITY = "availability",
    MORE_INFO = "more_info"
}
export declare class Inquiry {
    propertyId: Types.ObjectId;
    userId: Types.ObjectId;
    agentId: Types.ObjectId;
    message: string;
    type: InquiryType;
    status: InquiryStatus;
    response?: string;
    respondedAt?: Date;
    respondedBy?: Types.ObjectId;
    preferredContactMethod?: string;
    preferredContactTime?: string;
    viewingDate?: Date;
    budget?: number;
    moveInDate?: Date;
    contactEmail?: string;
    contactPhone?: string;
    isRead: boolean;
    readAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}
export declare const InquirySchema: import("mongoose").Schema<Inquiry, import("mongoose").Model<Inquiry, any, any, any, Document<unknown, any, Inquiry, any, {}> & Inquiry & {
    _id: Types.ObjectId;
} & {
    __v: number;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, Inquiry, Document<unknown, {}, import("mongoose").FlatRecord<Inquiry>, {}, import("mongoose").DefaultSchemaOptions> & import("mongoose").FlatRecord<Inquiry> & {
    _id: Types.ObjectId;
} & {
    __v: number;
}>;
