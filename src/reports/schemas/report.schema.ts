import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { User } from '../../users/schemas/user.schema';
import { Property } from '../../properties/schemas/property.schema';

export type ReportDocument = Report & Document;

@Schema({ timestamps: true })
export class Report {
    @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
    reporter: User;

    @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Property', required: true })
    property: Property;

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
ReportSchema.index({ createdAt: -1 });
