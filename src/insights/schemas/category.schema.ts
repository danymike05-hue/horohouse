import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type CategoryDocument = Category & Document;

@Schema({ timestamps: true })
export class Category {
  @Prop({ required: true, unique: true, trim: true })
  name: string;

  @Prop({ required: true, unique: true, lowercase: true, index: true })
  slug: string;

  @Prop({ maxlength: 200 })
  description: string;

  @Prop()
  icon: string; // emoji or icon name e.g. '🏘️' or 'home'

  @Prop()
  coverImage: string; // Cloudinary URL

  @Prop({ default: '#1B4332' })
  accentColor: string;

  @Prop()
  metaTitle: string;

  @Prop()
  metaDescription: string;

  @Prop({ default: 0 })
  postCount: number; // denormalized — updated on publish/unpublish

  @Prop({ default: true, index: true })
  isActive: boolean;

  @Prop({ default: 0 })
  sortOrder: number;
}

export const CategorySchema = SchemaFactory.createForClass(Category);
CategorySchema.index({ isActive: 1, sortOrder: 1 });