import { Model, Types } from 'mongoose';
import { CommunityPost, CommunityPostDocument, PostCategory } from './schemas/community-post.schema';
import { UserDocument } from '../users/schemas/user.schema';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
export declare class CommunityService {
    private readonly postModel;
    private readonly userModel;
    constructor(postModel: Model<CommunityPostDocument>, userModel: Model<UserDocument>);
    createPost(dto: CreatePostDto, reqUser: any): Promise<CommunityPostDocument>;
    private ensureUniqueSlug;
    findAllPosts(filters: {
        category?: PostCategory;
        tag?: string;
        pinned?: boolean;
        authorId?: string;
        search?: string;
    }, options: {
        page: number;
        limit: number;
        sortBy: string;
        sortOrder: 'asc' | 'desc';
    }): Promise<{
        data: (import("mongoose").FlattenMaps<CommunityPostDocument> & Required<{
            _id: Types.ObjectId;
        }> & {
            __v: number;
        })[];
        meta: {
            total: number;
            page: number;
            limit: number;
            totalPages: number;
        };
    }>;
    findPostBySlug(slug: string): Promise<CommunityPostDocument>;
    findPostById(id: string): Promise<CommunityPostDocument>;
    getPostReplies(postId: string, options: {
        page: number;
        limit: number;
    }): Promise<{
        data: (import("mongoose").FlattenMaps<CommunityPostDocument> & Required<{
            _id: Types.ObjectId;
        }> & {
            __v: number;
        })[];
        meta: {
            total: number;
            page: number;
            limit: number;
            totalPages: number;
        };
    }>;
    getPostsByAuthor(userId: string, options: {
        page: number;
        limit: number;
        sortOrder: 'asc' | 'desc';
    }): Promise<{
        data: (import("mongoose").FlattenMaps<CommunityPostDocument> & Required<{
            _id: Types.ObjectId;
        }> & {
            __v: number;
        })[];
        meta: {
            total: number;
            page: number;
            limit: number;
            totalPages: number;
        };
    }>;
    getAuthorProfile(userId: string): Promise<{
        user: import("mongoose").FlattenMaps<UserDocument> & Required<{
            _id: Types.ObjectId;
        }> & {
            __v: number;
        };
        communityStats: {
            totalPosts: number;
            totalLikes: any;
        };
    }>;
    updatePost(id: string, dto: UpdatePostDto, reqUser: any): Promise<CommunityPostDocument>;
    pinPost(id: string, pinned: boolean): Promise<CommunityPostDocument>;
    toggleLike(postId: string, reqUser: any): Promise<{
        liked: boolean;
        likes: number;
    }>;
    incrementViews(postId: string): Promise<void>;
    deletePost(id: string, reqUser: any): Promise<void>;
    hardDelete(id: string): Promise<void>;
    getStats(): Promise<{
        totalUsers: number;
        totalPosts: number;
        topContributors: any;
    }>;
    flagPost(postId: string, reqUser: any): Promise<{
        flagged: boolean;
    }>;
    getFlaggedPosts(query: {
        page?: number;
        limit?: number;
    }): Promise<{
        data: (import("mongoose").Document<unknown, {}, CommunityPostDocument, {}, {}> & CommunityPost & import("mongoose").Document<Types.ObjectId, any, any, Record<string, any>, {}> & Required<{
            _id: Types.ObjectId;
        }> & {
            __v: number;
        })[];
        meta: {
            total: number;
            page: number;
            limit: number;
            totalPages: number;
        };
    }>;
    unflagPost(postId: string): Promise<CommunityPostDocument>;
    private assertOwnerOrAdmin;
}
