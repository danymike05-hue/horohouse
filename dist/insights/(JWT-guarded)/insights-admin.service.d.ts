import { Model, Types } from 'mongoose';
import { Post, PostDocument } from '../schemas/post.schema';
import { Category, CategoryDocument } from '../schemas/category.schema';
import { Tag, TagDocument } from '../schemas/tag.schema';
import { AuthorProfile, AuthorProfileDocument } from '../schemas/author-profile.schema';
import { CreatePostDto, UpdatePostDto, SchedulePostDto, ReviewPostDto, QueryPostsDto, CreateCategoryDto, CreateAuthorProfileDto } from '../dto/insights.dto';
import { InsightsSeoService } from './insights-seo.service';
export declare class InsightsAdminService {
    private postModel;
    private categoryModel;
    private tagModel;
    private authorModel;
    private seoService;
    constructor(postModel: Model<PostDocument>, categoryModel: Model<CategoryDocument>, tagModel: Model<TagDocument>, authorModel: Model<AuthorProfileDocument>, seoService: InsightsSeoService);
    findAll(query: QueryPostsDto): Promise<{
        data: (import("mongoose").FlattenMaps<PostDocument> & Required<{
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
    getStats(): Promise<{
        total: number;
        published: number;
        draft: number;
        review: number;
        scheduled: number;
        featured: number;
        trending: number;
        topPosts: (import("mongoose").FlattenMaps<PostDocument> & Required<{
            _id: Types.ObjectId;
        }> & {
            __v: number;
        })[];
        recentActivity: (import("mongoose").FlattenMaps<PostDocument> & Required<{
            _id: Types.ObjectId;
        }> & {
            __v: number;
        })[];
    }>;
    findById(id: string): Promise<import("mongoose").FlattenMaps<PostDocument> & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }>;
    create(dto: CreatePostDto, editorUserId: string): Promise<import("mongoose").Document<unknown, {}, PostDocument, {}, {}> & Post & import("mongoose").Document<Types.ObjectId, any, any, Record<string, any>, {}> & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }>;
    update(id: string, dto: UpdatePostDto, editorUserId: string): Promise<import("mongoose").Document<unknown, {}, PostDocument, {}, {}> & Post & import("mongoose").Document<Types.ObjectId, any, any, Record<string, any>, {}> & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }>;
    publish(id: string, editorUserId: string): Promise<import("mongoose").Document<unknown, {}, PostDocument, {}, {}> & Post & import("mongoose").Document<Types.ObjectId, any, any, Record<string, any>, {}> & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }>;
    schedule(id: string, dto: SchedulePostDto, editorUserId: string): Promise<import("mongoose").Document<unknown, {}, PostDocument, {}, {}> & Post & import("mongoose").Document<Types.ObjectId, any, any, Record<string, any>, {}> & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }>;
    toggleFeatured(id: string, isFeatured: boolean, editorUserId: string): Promise<import("mongoose").Document<unknown, {}, PostDocument, {}, {}> & Post & import("mongoose").Document<Types.ObjectId, any, any, Record<string, any>, {}> & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }>;
    reviewSubmission(id: string, dto: ReviewPostDto, editorUserId: string): Promise<import("mongoose").Document<unknown, {}, PostDocument, {}, {}> & Post & import("mongoose").Document<Types.ObjectId, any, any, Record<string, any>, {}> & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }>;
    delete(id: string, editorUserId: string): Promise<{
        message: string;
    }>;
    backfillSlugs(): Promise<{
        fixed: number;
        skipped: number;
    }>;
    uploadCover(file: Express.Multer.File): Promise<{
        url: any;
        publicId: any;
        width: any;
        height: any;
    }>;
    getAnalytics(params: any): Promise<{
        topByViews: (import("mongoose").FlattenMaps<PostDocument> & Required<{
            _id: Types.ObjectId;
        }> & {
            __v: number;
        })[];
        recentPublished: (import("mongoose").FlattenMaps<PostDocument> & Required<{
            _id: Types.ObjectId;
        }> & {
            __v: number;
        })[];
        viewsByCategory: any[];
    }>;
    createCategory(dto: CreateCategoryDto): Promise<import("mongoose").Document<unknown, {}, CategoryDocument, {}, {}> & Category & import("mongoose").Document<Types.ObjectId, any, any, Record<string, any>, {}> & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }>;
    updateCategory(id: string, dto: Partial<CreateCategoryDto>): Promise<import("mongoose").Document<unknown, {}, CategoryDocument, {}, {}> & Category & import("mongoose").Document<Types.ObjectId, any, any, Record<string, any>, {}> & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }>;
    deleteCategory(id: string): Promise<{
        message: string;
    }>;
    getAllCategories(): Promise<(import("mongoose").FlattenMaps<CategoryDocument> & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    })[]>;
    getAllTags(params: any): Promise<{
        data: (import("mongoose").FlattenMaps<TagDocument> & Required<{
            _id: Types.ObjectId;
        }> & {
            __v: number;
        })[];
        meta: {
            total: number;
            page: any;
            limit: any;
        };
    }>;
    createTag(name: string): Promise<import("mongoose").Document<unknown, {}, TagDocument, {}, {}> & Tag & import("mongoose").Document<Types.ObjectId, any, any, Record<string, any>, {}> & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }>;
    deleteTag(id: string): Promise<{
        message: string;
    }>;
    getAuthors(params: any): Promise<{
        data: (import("mongoose").FlattenMaps<AuthorProfileDocument> & Required<{
            _id: Types.ObjectId;
        }> & {
            __v: number;
        })[];
        meta: {
            total: number;
            page: any;
            limit: any;
        };
    }>;
    createAuthorProfile(dto: CreateAuthorProfileDto): Promise<import("mongoose").Document<unknown, {}, AuthorProfileDocument, {}, {}> & AuthorProfile & import("mongoose").Document<Types.ObjectId, any, any, Record<string, any>, {}> & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }>;
    updateAuthorProfile(id: string, dto: Partial<CreateAuthorProfileDto>): Promise<import("mongoose").Document<unknown, {}, AuthorProfileDocument, {}, {}> & AuthorProfile & import("mongoose").Document<Types.ObjectId, any, any, Record<string, any>, {}> & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }>;
}
