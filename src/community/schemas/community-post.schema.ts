import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

// ─── Enums ────────────────────────────────────────────────────────────────────

export enum PostCategory {
  HOMES     = 'homes',
  CAFE      = 'cafe',
  EXPLORE   = 'explore',
  RESOURCES = 'resources',
  UPDATES   = 'updates',
}

// ─── Embedded author snapshot ─────────────────────────────────────────────────
// Denormalised so list/detail pages never need a User join.

export interface AuthorSnapshot {
  name:     string;
  initials: string;
  role:     string;   // e.g. "Top Contributor", "Superhost", "Host"
  avatar:   string;   // Cloudinary URL – empty string if not set
}

// ─── Schema ───────────────────────────────────────────────────────────────────

@Schema({ timestamps: true })
export class CommunityPost {
  // ── Authorship ──────────────────────────────────────────────────────────────

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  authorId: Types.ObjectId;

  /**
   * Embedded author snapshot — mirrors the `author` field in data.ts.
   * Updated lazily when the user updates their profile.
   */
  @Prop({
    type: {
      name:     { type: String, required: true },
      initials: { type: String, required: true },
      role:     { type: String, required: true },
      avatar:   { type: String, default: '' },
    },
    required: true,
  })
  authorSnapshot: AuthorSnapshot;

  // ── Content ─────────────────────────────────────────────────────────────────

  @Prop({ type: String, required: true, unique: true, index: true })
  slug: string;

  @Prop({
    type: String,
    enum: Object.values(PostCategory),
    required: true,
    index: true,
  })
  category: PostCategory;

  @Prop({ type: String, required: true, trim: true })
  title: string;

  @Prop({ type: String, trim: true })
  excerpt?: string;

  @Prop({ type: String })
  body?: string;

  @Prop({ type: [String], default: [] })
  tags: string[];

  // ── Engagement ───────────────────────────────────────────────────────────────

  @Prop({ type: Boolean, default: false, index: true })
  pinned: boolean;

  @Prop({ type: Number, default: 0 })
  likes: number;

  /** Tracks who has liked the post to prevent duplicate likes. */
  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], default: [] })
  likedBy: Types.ObjectId[];

  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], default: [] })
  flaggedBy: Types.ObjectId[];

  @Prop({ type: Number, default: 0 })
  views: number;

  /**
   * Incremented/decremented when reply posts are created/deleted.
   * A "reply" is a CommunityPost with a non-null `replyToId`.
   */
  @Prop({ type: Number, default: 0 })
  replyCount: number;

  /** ObjectId of the parent post, set when this is a reply. */
  @Prop({ type: Types.ObjectId, ref: 'CommunityPost', index: true, default: null })
  replyToId?: Types.ObjectId;

  /** The ultimate top-level post this reply belongs to. Enables flat querying of all threads for a post. */
  @Prop({ type: Types.ObjectId, ref: 'CommunityPost', index: true, default: null })
  rootPostId?: Types.ObjectId;

  // ── Moderation ───────────────────────────────────────────────────────────────

  @Prop({ type: Boolean, default: true })
  isActive: boolean;

  // timestamps injected by Mongoose
  createdAt: Date;
  updatedAt: Date;
}

export type CommunityPostDocument = CommunityPost & Document;
export const CommunityPostSchema = SchemaFactory.createForClass(CommunityPost);

// ─── Compound indexes ─────────────────────────────────────────────────────────

/** List page default sort: pinned first, then newest */
CommunityPostSchema.index({ pinned: -1, createdAt: -1 });

/** Category feed */
CommunityPostSchema.index({ category: 1, isActive: 1, createdAt: -1 });

/** Author portfolio page */
CommunityPostSchema.index({ authorId: 1, isActive: 1, createdAt: -1 });

/** Replies thread */
CommunityPostSchema.index({ replyToId: 1, createdAt: 1 });
CommunityPostSchema.index({ rootPostId: 1, createdAt: 1 });

// ─── Virtuals ────────────────────────────────────────────────────────────────

CommunityPostSchema.virtual('id').get(function (this: CommunityPostDocument) {
  return this._id.toString();
});

CommunityPostSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret: any) => {
    delete ret._id;
    return ret;
  },
});
