import { Document, Types } from 'mongoose';
export type PostDocument = Post & Document;
export declare enum PostStatus {
    DRAFT = "draft",
    REVIEW = "review",
    SCHEDULED = "scheduled",
    PUBLISHED = "published",
    ARCHIVED = "archived"
}
export declare enum PostType {
    ARTICLE = "article",
    NEIGHBORHOOD_GUIDE = "neighborhood_guide",
    MARKET_REPORT = "market_report",
    FRAUD_ALERT = "fraud_alert",
    AI_INSIGHT = "ai_insight"
}
export declare class Post {
    title: string;
    slug: string;
    excerpt: string;
    content: Record<string, any>;
    contentText: string;
    author: Types.ObjectId;
    coAuthors: Types.ObjectId[];
    category: Types.ObjectId;
    tags: Types.ObjectId[];
    status: PostStatus;
    postType: PostType;
    coverImage: {
        url: string;
        publicId: string;
        alt: string;
        caption: string;
        width: number;
        height: number;
    };
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
    relatedListings: Types.ObjectId[];
    neighborhood: {
        name: string;
        city: string;
        country: string;
        coordinates: {
            lat: number;
            lng: number;
        };
    };
    marketData: {
        averagePrice: number;
        priceChange: number;
        demandIndex: number;
        currency: string;
        dataDate: Date;
        source: string;
    };
    publishedAt: Date;
    scheduledAt: Date;
    isFeatured: boolean;
    isTrending: boolean;
    isPinned: boolean;
    isAiGenerated: boolean;
    viewCount: number;
    shareCount: number;
    likeCount: number;
    commentCount: number;
    readingTimeMinutes: number;
    cta: {
        type: 'search_listings' | 'contact_agent' | 'book_tour' | 'newsletter' | 'download_report';
        label: string;
        url: string;
        propertyId: string;
    };
    editorialLog: Array<{
        action: string;
        performedBy: Types.ObjectId | null;
        note: string;
        at: Date;
    }>;
    submittedBy: Types.ObjectId;
    reviewedBy: Types.ObjectId;
    publishedBy: Types.ObjectId;
}
export declare const PostSchema: import("mongoose").Schema<Post, import("mongoose").Model<Post, any, any, any, Document<unknown, any, Post, any, {}> & Post & {
    _id: Types.ObjectId;
} & {
    __v: number;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, Post, Document<unknown, {}, import("mongoose").FlatRecord<Post>, {}, import("mongoose").DefaultSchemaOptions> & import("mongoose").FlatRecord<Post> & {
    _id: Types.ObjectId;
} & {
    __v: number;
}>;
