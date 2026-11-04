import { Document, Types } from 'mongoose';
export declare enum TemplateKind {
    QUICK_REPLY = "quick_reply",
    SCHEDULED = "scheduled"
}
export declare enum MessageTrigger {
    BOOKING_CONFIRMED = "booking_confirmed",
    BEFORE_CHECKIN = "before_checkin",
    CHECKIN_DAY = "checkin_day",
    BEFORE_CHECKOUT = "before_checkout",
    AFTER_CHECKOUT = "after_checkout"
}
export type HostMessageTemplateDocument = HostMessageTemplate & Document;
export declare class HostMessageTemplate {
    _id: Types.ObjectId;
    hostId: Types.ObjectId;
    kind: TemplateKind;
    title: string;
    body: string;
    trigger?: MessageTrigger;
    daysOffset: number;
    sendTime: string;
    propertyIds: Types.ObjectId[];
    isActive: boolean;
    createdAt?: Date;
    updatedAt?: Date;
}
export declare const HostMessageTemplateSchema: import("mongoose").Schema<HostMessageTemplate, import("mongoose").Model<HostMessageTemplate, any, any, any, Document<unknown, any, HostMessageTemplate, any, {}> & HostMessageTemplate & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, HostMessageTemplate, Document<unknown, {}, import("mongoose").FlatRecord<HostMessageTemplate>, {}, import("mongoose").DefaultSchemaOptions> & import("mongoose").FlatRecord<HostMessageTemplate> & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}>;
export type HostMessageDeliveryDocument = HostMessageDelivery & Document;
export declare class HostMessageDelivery {
    _id: Types.ObjectId;
    templateId: Types.ObjectId;
    bookingId: Types.ObjectId;
    hostId: Types.ObjectId;
    guestId: Types.ObjectId;
    title: string;
    body: string;
    sentAt: Date;
    createdAt?: Date;
}
export declare const HostMessageDeliverySchema: import("mongoose").Schema<HostMessageDelivery, import("mongoose").Model<HostMessageDelivery, any, any, any, Document<unknown, any, HostMessageDelivery, any, {}> & HostMessageDelivery & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, HostMessageDelivery, Document<unknown, {}, import("mongoose").FlatRecord<HostMessageDelivery>, {}, import("mongoose").DefaultSchemaOptions> & import("mongoose").FlatRecord<HostMessageDelivery> & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}>;
