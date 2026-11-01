import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type AppointmentDocument = Appointment & Document;

export enum AppointmentStatus {
    SCHEDULED = 'scheduled',
    RESCHEDULED = 'rescheduled',
    COMPLETED = 'completed',
    CANCELLED = 'cancelled',
    NO_SHOW = 'no-show',
}

export enum AppointmentType {
    IN_PERSON = 'in-person',
    VIRTUAL = 'virtual',
    PHONE_CALL = 'phone-call',
}

@Schema({ _id: false })
export class AppointmentNote {
    @Prop({ type: Types.ObjectId, default: () => new Types.ObjectId() })
    _id: Types.ObjectId;

    @Prop({ required: true, trim: true })
    content: string;

    @Prop({ type: Date, default: Date.now })
    createdAt: Date;
}

export const AppointmentNoteSchema = SchemaFactory.createForClass(AppointmentNote);

@Schema({ timestamps: true })
export class Appointment {
    @Prop({ required: true, trim: true })
    title: string;

    // Free-text property name (for quick entry)
    @Prop({ trim: true })
    property?: string;

    // Reference to actual Property document
    @Prop({ type: Types.ObjectId, ref: 'Property' })
    propertyId?: Types.ObjectId;

    // The agent/admin who owns this appointment
    @Prop({ type: Types.ObjectId, ref: 'User', required: true })
    agentId: Types.ObjectId;

    // Client fields — free text; clientId links to a known User if available
    @Prop({ required: true, trim: true })
    clientName: string;

    @Prop({ trim: true })
    clientEmail?: string;

    @Prop({ trim: true })
    clientPhone?: string;

    // Optional reference to a registered user/lead
    @Prop({ type: Types.ObjectId, ref: 'User' })
    clientId?: Types.ObjectId;

    @Prop({ type: String, enum: AppointmentType, required: true })
    type: AppointmentType;

    @Prop({ trim: true })
    location?: string;

    @Prop({ trim: true })
    description?: string;

    @Prop({ required: true, type: Date })
    date: Date;

    @Prop({ type: Number })
    duration?: number; // minutes

    @Prop({ type: String, enum: AppointmentStatus, default: AppointmentStatus.SCHEDULED })
    status: AppointmentStatus;

    @Prop({ type: Boolean, default: false })
    reminderSent: boolean;

    // Track reschedule history
    @Prop({ type: [{ from: Date, to: Date, reason: String }], default: [] })
    rescheduleHistory: { from: Date; to: Date; reason?: string }[];

    @Prop({ type: [AppointmentNoteSchema], default: [] })
    notes: AppointmentNote[];

    // Timestamps
    createdAt: Date;
    updatedAt: Date;
}

export const AppointmentSchema = SchemaFactory.createForClass(Appointment);

AppointmentSchema.index({ agentId: 1, date: 1 });
AppointmentSchema.index({ status: 1 });
AppointmentSchema.index({ date: 1 });
AppointmentSchema.index({ createdAt: -1 });
AppointmentSchema.index({ clientName: 1 });
AppointmentSchema.index({ propertyId: 1 });
