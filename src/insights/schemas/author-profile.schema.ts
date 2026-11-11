import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type AuthorProfileDocument = AuthorProfile & Document;

export enum AuthorRole {
  ADMIN_EDITOR = 'admin_editor', // full CMS access — publish, delete, manage categories
  EDITOR = 'editor',             // can approve/publish any post
  AGENT_AUTHOR = 'agent_author', // linked to agent user, can publish market content
  CONTRIBUTOR = 'contributor',   // submit-only, all posts go to review queue
}

@Schema({ timestamps: true })
export class AuthorProfile {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, unique: true, index: true })
  user: Types.ObjectId;

  @Prop({ required: true, trim: true })
  displayName: string;

  @Prop({ required: true, unique: true, lowercase: true, index: true })
  slug: string;

  @Prop({ maxlength: 500 })
  bio: string;

  @Prop()
  avatar: string; // Cloudinary URL

  @Prop()
  title: string; // e.g. "Senior PropTech Analyst" | "Yaoundé Market Expert"

  @Prop({ type: [String], default: [] })
  specialties: string[]; // ['Residential', 'Yaoundé Market', 'Fraud Prevention']

  @Prop({
    type: {
      twitter: String,
      linkedin: String,
      website: String,
    },
    default: {},
  })
  social: {
    twitter: string;
    linkedin: string;
    website: string;
  };

  @Prop({ enum: AuthorRole, default: AuthorRole.CONTRIBUTOR, index: true })
  role: AuthorRole;

  @Prop({ default: true, index: true })
  isActive: boolean;

  // Denormalized stats — updated via post publish hooks
  @Prop({ default: 0 })
  publishedPostCount: number;

  @Prop({ default: 0 })
  totalViewCount: number;
}

export const AuthorProfileSchema = SchemaFactory.createForClass(AuthorProfile);
AuthorProfileSchema.index({ role: 1, isActive: 1 });
AuthorProfileSchema.index({ publishedPostCount: -1 });