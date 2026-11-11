import { Document, Types } from 'mongoose';
export type AppointmentDocument = Appointment & Document;
export declare enum AppointmentStatus {
    SCHEDULED = "scheduled",
    RESCHEDULED = "rescheduled",
    COMPLETED = "completed",
    CANCELLED = "cancelled",
    NO_SHOW = "no-show"
}
export declare enum AppointmentType {
    IN_PERSON = "in-person",
    VIRTUAL = "virtual",
    PHONE_CALL = "phone-call"
}
export declare class AppointmentNote {
    _id: Types.ObjectId;
    content: string;
    createdAt: Date;
}
export declare const AppointmentNoteSchema: import("mongoose").Schema<AppointmentNote, import("mongoose").Model<AppointmentNote, any, any, any, Document<unknown, any, AppointmentNote, any, {}> & AppointmentNote & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, AppointmentNote, Document<unknown, {}, import("mongoose").FlatRecord<AppointmentNote>, {}, import("mongoose").DefaultSchemaOptions> & import("mongoose").FlatRecord<AppointmentNote> & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}>;
export declare class Appointment {
    title: string;
    property?: string;
    propertyId?: Types.ObjectId;
    agentId: Types.ObjectId;
    clientName: string;
    clientEmail?: string;
    clientPhone?: string;
    clientId?: Types.ObjectId;
    type: AppointmentType;
    location?: string;
    description?: string;
    date: Date;
    duration?: number;
    status: AppointmentStatus;
    reminderSent: boolean;
    rescheduleHistory: {
        from: Date;
        to: Date;
        reason?: string;
    }[];
    notes: AppointmentNote[];
    createdAt: Date;
    updatedAt: Date;
}
export declare const AppointmentSchema: import("mongoose").Schema<Appointment, import("mongoose").Model<Appointment, any, any, any, Document<unknown, any, Appointment, any, {}> & Appointment & {
    _id: Types.ObjectId;
} & {
    __v: number;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, Appointment, Document<unknown, {}, import("mongoose").FlatRecord<Appointment>, {}, import("mongoose").DefaultSchemaOptions> & import("mongoose").FlatRecord<Appointment> & {
    _id: Types.ObjectId;
} & {
    __v: number;
}>;
