import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ComparisonDocument = Comparison & Document;

@Schema({ timestamps: true })
export class Comparison {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Property' }], required: true })
  propertyIds: Types.ObjectId[];

  @Prop({ default: false })
  isPublic: boolean;

  @Prop()
  shareToken?: string; // For sharing comparisons

  @Prop({ default: 0 })
  viewsCount: number;

  // Timestamps are automatically added
  createdAt: Date;
  updatedAt: Date;
}

export const ComparisonSchema = SchemaFactory.createForClass(Comparison);

// Indexes for efficient queries
ComparisonSchema.index({ userId: 1, createdAt: -1 });
ComparisonSchema.index({ shareToken: 1 });
ComparisonSchema.index({ isPublic: 1, createdAt: -1 });
