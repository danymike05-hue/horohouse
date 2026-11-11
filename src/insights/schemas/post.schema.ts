import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type PostDocument = Post & Document;

export enum PostStatus {
  DRAFT = 'draft',
  REVIEW = 'review',
  SCHEDULED = 'scheduled',
  PUBLISHED = 'published',
  ARCHIVED = 'archived',
}

export enum PostType {
  ARTICLE = 'article',
  NEIGHBORHOOD_GUIDE = 'neighborhood_guide',
  MARKET_REPORT = 'market_report',
  FRAUD_ALERT = 'fraud_alert',
  AI_INSIGHT = 'ai_insight',
}

@Schema({ timestamps: true })
export class Post {
  @Prop({ required: true, trim: true, maxlength: 160 })
  title: string;

  @Prop({ required: true, unique: true, lowercase: true, index: true })
  slug: string;

  @Prop({ required: true, maxlength: 300 })
  excerpt: string;

  @Prop({ type: Object, required: true })
  content: Record<string, any>; // Tiptap JSON

  @Prop({ index: 'text' })
  contentText: string; // plain text for full-text search

  @Prop({ type: Types.ObjectId, ref: 'AuthorProfile', required: true, index: true })
  author: Types.ObjectId;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'AuthorProfile' }], default: [] })
  coAuthors: Types.ObjectId[];

  @Prop({ type: Types.ObjectId, ref: 'Category', required: true, index: true })
  category: Types.ObjectId;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Tag' }], default: [], index: true })
  tags: Types.ObjectId[];

  @Prop({ enum: PostStatus, default: PostStatus.DRAFT, index: true })
  status: PostStatus;

  @Prop({ enum: PostType, default: PostType.ARTICLE, index: true })
  postType: PostType;

  @Prop({
    type: {
      url: String,
      publicId: String,
      alt: String,
      caption: String,
      width: Number,
      height: Number,
    },
  })
  coverImage: {
    url: string;
    publicId: string;
    alt: string;
    caption: string;
    width: number;
    height: number;
  };

  @Prop({
    type: {
      metaTitle: String,
      metaDescription: String,
      ogImage: String,
      ogTitle: String,
      ogDescription: String,
      canonicalUrl: String,
      noIndex: { type: Boolean, default: false },
      structuredData: Object,
    },
  })
  seo: {
    metaTitle: string;
    metaDescription: string;
    ogImage: string;
    ogTitle: string;
    ogDescription: string;
    canonicalUrl: string;
    noIndex: boolean;
    structuredData: Record<string, any>;
  };

  // PropTech: Related property listings
  @Prop({ type: [{ type: Types.ObjectId, ref: 'Property' }], default: [] })
  relatedListings: Types.ObjectId[];

  // PropTech: Neighborhood context
  @Prop({
    type: {
      name: String,
      city: String,
      country: String,
      coordinates: { lat: Number, lng: Number },
    },
  })
  neighborhood: {
    name: string;
    city: string;
    country: string;
    coordinates: { lat: number; lng: number };
  };

  // PropTech: Market data embed
  @Prop({
    type: {
      averagePrice: Number,
      priceChange: Number,
      demandIndex: Number,
      currency: { type: String, default: 'XAF' },
      dataDate: Date,
      source: String,
    },
  })
  marketData: {
    averagePrice: number;
    priceChange: number;
    demandIndex: number;
    currency: string;
    dataDate: Date;
    source: string;
  };

  @Prop({ type: Date, index: true })
  publishedAt: Date;

  @Prop({ type: Date })
  scheduledAt: Date;

  @Prop({ default: false, index: true })
  isFeatured: boolean;

  @Prop({ default: false, index: true })
  isTrending: boolean;

  @Prop({ default: false })
  isPinned: boolean;

  @Prop({ default: false })
  isAiGenerated: boolean;

  @Prop({ default: 0, index: true })
  viewCount: number;

  @Prop({ default: 0 })
  shareCount: number;

  @Prop({ default: 0 })
  likeCount: number;

  @Prop({ default: 0 })
  commentCount: number;

  @Prop({ default: 1 })
  readingTimeMinutes: number;

  @Prop({
    type: {
      type: String,
      label: String,
      url: String,
      propertyId: String,
    },
  })
  cta: {
    type: 'search_listings' | 'contact_agent' | 'book_tour' | 'newsletter' | 'download_report';
    label: string;
    url: string;
    propertyId: string;
  };

@Prop({
  type: [
    {
      action: String,
      performedBy: { type: Types.ObjectId, ref: 'User', default: null },
      note: String,
      at: Date,
    },
  ],
  default: [],
})
editorialLog: Array<{
  action: string;
  performedBy: Types.ObjectId | null;
  note: string;
  at: Date;
}>;

  @Prop({ type: Types.ObjectId, ref: 'User', index: true })
  submittedBy: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  reviewedBy: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  publishedBy: Types.ObjectId;
}

export const PostSchema = SchemaFactory.createForClass(Post);

// ── Compound Indexes ──────────────────────────────────────────────────────────
PostSchema.index({ status: 1, publishedAt: -1 });
PostSchema.index({ category: 1, status: 1, publishedAt: -1 });
PostSchema.index({ tags: 1, status: 1 });
PostSchema.index({ isFeatured: 1, status: 1 });
PostSchema.index({ isTrending: 1, status: 1 });
PostSchema.index({ postType: 1, status: 1, publishedAt: -1 });
PostSchema.index({ 'neighborhood.city': 1, status: 1 });
PostSchema.index({ relatedListings: 1 });
PostSchema.index({ viewCount: -1 });
PostSchema.index({ scheduledAt: 1, status: 1 });
PostSchema.index({ author: 1, status: 1, publishedAt: -1 });
PostSchema.index(
  { title: 'text', contentText: 'text', excerpt: 'text' },
  { weights: { title: 10, excerpt: 5, contentText: 1 }, name: 'insights_full_text' },
);