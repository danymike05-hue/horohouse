import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { User } from '../../users/schemas/user.schema';
import { Property } from '../../properties/schemas/property.schema';

export type ReportDocument = Report & Document;

@Schema({ timestamps: true })
export class Report {
    @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
    reporter: User;

    /** What is reported: a listing… */
    @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Property', required: false })
    property?: Property;

    /** …or a person (from a chat or their profile) */
    @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: false })
    reportedUser?: User;

    @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Conversation', required: false })
    conversation?: any;

    /** What the team needs to judge it: the last messages, copied when the report was made */
    @Prop({ type: [Object], default: undefined })
    evidence?: { byReported: boolean; text: string; at: Date; reported?: boolean }[];

    @Prop({ required: true })
    reason: string;

    @Prop({ required: false })
    details?: string;

    @Prop({
        type: String,
        enum: ['pending', 'reviewed', 'resolved', 'dismissed'],
        default: 'pending',
    })
    status: string;

    @Prop({ required: false })
    adminNotes?: string;
}

export const ReportSchema = SchemaFactory.createForClass(Report);

// Add indexes for quicker queries
ReportSchema.index({ status: 1 });
ReportSchema.index({ property: 1 });
ReportSchema.index({ reporter: 1 });
ReportSchema.index({ reportedUser: 1 });
ReportSchema.index({ createdAt: -1 });
