import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type TagDocument = Tag & Document;

@Schema({ timestamps: true })
export class Tag {
  @Prop({ required: true, unique: true, trim: true })
  name: string;

  @Prop({ required: true, unique: true, lowercase: true, index: true })
  slug: string;

  @Prop({ maxlength: 160 })
  description: string;

  @Prop({ default: 0, index: true })
  usageCount: number; // incremented on publish, decremented on unpublish

  @Prop({ default: true })
  isActive: boolean;
}

export const TagSchema = SchemaFactory.createForClass(Tag);
TagSchema.index({ usageCount: -1 }); // for popular tags query
