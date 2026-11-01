import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type LeadDocument = Lead & Document;

export enum LeadStatus {
    NEW = 'new',
    CONTACTED = 'contacted',
    QUALIFIED = 'qualified',
    LOST = 'lost',
}

export enum LeadSource {
    WEBSITE = 'website',
    REFERRAL = 'referral',
    MESSAGE = 'message',
    CAMPAIGN = 'campaign',
}

export enum LeadPriority {
    LOW = 'low',
    MEDIUM = 'medium',
    HIGH = 'high',
}

@Schema({ _id: false })
export class LeadNote {
    @Prop({ type: Types.ObjectId, default: () => new Types.ObjectId() })
    _id: Types.ObjectId;

    @Prop({ required: true, trim: true })
    content: string;

    @Prop({ type: Date, default: Date.now })
    createdAt: Date;
}

export const LeadNoteSchema = SchemaFactory.createForClass(LeadNote);

@Schema({ timestamps: true })
export class Lead {
    @Prop({ required: true, trim: true })
    name: string;

    @Prop({ trim: true })
    email?: string;

    @Prop({ trim: true })
    phone?: string;

    @Prop({ trim: true })
    interest?: string;

    @Prop({ type: String, enum: LeadSource, default: LeadSource.WEBSITE })
    source: LeadSource;

    @Prop({ type: String, enum: LeadStatus, default: LeadStatus.NEW })
    status: LeadStatus;

    @Prop({ trim: true })
    location?: string;

    @Prop({ type: Date })
    lastContactedAt?: Date;

    @Prop({ type: Number })
    budget?: number;

    @Prop({ trim: true })
    propertyType?: string;

    @Prop({ type: String, enum: LeadPriority })
    priority?: LeadPriority;

    @Prop({ trim: true })
    assignedAgent?: string;

    @Prop({ type: [String], default: [] })
    tags: string[];

    @Prop({ type: [LeadNoteSchema], default: [] })
    notes: LeadNote[];
}

export const LeadSchema = SchemaFactory.createForClass(Lead);

// Indexing for faster queries and sorting
LeadSchema.index({ status: 1 });
LeadSchema.index({ createdAt: -1 });
LeadSchema.index({ priority: 1 });
LeadSchema.index({ source: 1 });
