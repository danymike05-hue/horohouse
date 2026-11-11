import { Document, Types } from 'mongoose';
export declare enum PostCategory {
    HOMES = "homes",
    CAFE = "cafe",
    EXPLORE = "explore",
    RESOURCES = "resources",
    UPDATES = "updates"
}
export interface AuthorSnapshot {
    name: string;
    initials: string;
    role: string;
    avatar: string;
}
export declare class CommunityPost {
    authorId: Types.ObjectId;
    authorSnapshot: AuthorSnapshot;
    slug: string;
    category: PostCategory;
    title: string;
    excerpt?: string;
    body?: string;
    tags: string[];
    pinned: boolean;
    likes: number;
    likedBy: Types.ObjectId[];
    flaggedBy: Types.ObjectId[];
    views: number;
    replyCount: number;
    replyToId?: Types.ObjectId;
    rootPostId?: Types.ObjectId;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}
export type CommunityPostDocument = CommunityPost & Document;
export declare const CommunityPostSchema: import("mongoose").Schema<CommunityPost, import("mongoose").Model<CommunityPost, any, any, any, Document<unknown, any, CommunityPost, any, {}> & CommunityPost & {
    _id: Types.ObjectId;
} & {
    __v: number;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, CommunityPost, Document<unknown, {}, import("mongoose").FlatRecord<CommunityPost>, {}, import("mongoose").DefaultSchemaOptions> & import("mongoose").FlatRecord<CommunityPost> & {
    _id: Types.ObjectId;
} & {
    __v: number;
}>;
