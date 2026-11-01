import { CommunityService } from './community.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
export declare class CommunityController {
    private readonly communityService;
    constructor(communityService: CommunityService);
    findAll(query: any): Promise<{
        data: (import("mongoose").FlattenMaps<import("./schemas/community-post.schema").CommunityPostDocument> & Required<{
            _id: import("mongoose").Types.ObjectId;
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
    createPost(dto: CreatePostDto, req: any): Promise<import("./schemas/community-post.schema").CommunityPostDocument>;
    findBySlug(slug: string): Promise<import("./schemas/community-post.schema").CommunityPostDocument>;
    findById(id: string): Promise<import("./schemas/community-post.schema").CommunityPostDocument>;
    update(id: string, dto: UpdatePostDto, req: any): Promise<import("./schemas/community-post.schema").CommunityPostDocument>;
    remove(id: string, req: any): Promise<void>;
    toggleLike(id: string, req: any): Promise<{
        liked: boolean;
        likes: number;
    }>;
    incrementView(id: string): Promise<void>;
    getReplies(id: string, query: any): Promise<{
        data: (import("mongoose").FlattenMaps<import("./schemas/community-post.schema").CommunityPostDocument> & Required<{
            _id: import("mongoose").Types.ObjectId;
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
    pinPost(id: string, pinned: string): Promise<import("./schemas/community-post.schema").CommunityPostDocument>;
    hardDelete(id: string): Promise<void>;
    getStats(): Promise<{
        totalUsers: number;
        totalPosts: number;
        topContributors: any;
    }>;
    getFlaggedPosts(query: any): Promise<{
        data: (import("mongoose").Document<unknown, {}, import("./schemas/community-post.schema").CommunityPostDocument, {}, {}> & import("./schemas/community-post.schema").CommunityPost & import("mongoose").Document<import("mongoose").Types.ObjectId, any, any, Record<string, any>, {}> & Required<{
            _id: import("mongoose").Types.ObjectId;
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
    flagPost(id: string, req: any): Promise<{
        flagged: boolean;
    }>;
    unflagPost(id: string): Promise<import("./schemas/community-post.schema").CommunityPostDocument>;
    getAuthorProfile(userId: string): Promise<{
        user: import("mongoose").FlattenMaps<import("../users/schemas/user.schema").UserDocument> & Required<{
            _id: import("mongoose").Types.ObjectId;
        }> & {
            __v: number;
        };
        communityStats: {
            totalPosts: number;
            totalLikes: any;
        };
    }>;
    getAuthorPosts(userId: string, query: any): Promise<{
        data: (import("mongoose").FlattenMaps<import("./schemas/community-post.schema").CommunityPostDocument> & Required<{
            _id: import("mongoose").Types.ObjectId;
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
}
