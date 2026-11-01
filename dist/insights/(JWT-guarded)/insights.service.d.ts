import { Model, Types } from 'mongoose';
import { Post, PostDocument } from '../schemas/post.schema';
import { CategoryDocument } from '../schemas/category.schema';
import { TagDocument } from '../schemas/tag.schema';
import { AuthorProfileDocument } from '../schemas/author-profile.schema';
import { CreatePostDto, QueryPostsDto } from '../dto/insights.dto';
import { InsightsSeoService } from './insights-seo.service';
import { InsightsRecommendationService } from './insights-recommendation.service';
export declare class InsightsService {
    private postModel;
    private categoryModel;
    private tagModel;
    private authorModel;
    private seoService;
    private recommendationService;
    constructor(postModel: Model<PostDocument>, categoryModel: Model<CategoryDocument>, tagModel: Model<TagDocument>, authorModel: Model<AuthorProfileDocument>, seoService: InsightsSeoService, recommendationService: InsightsRecommendationService);
    findPublished(query: QueryPostsDto): Promise<{
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
    findFeatured(limit?: number): Promise<(import("mongoose").FlattenMaps<PostDocument> & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    })[]>;
    findTrending(limit?: number): Promise<(import("mongoose").FlattenMaps<PostDocument> & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    })[]>;
    findBySlug(slug: string): Promise<import("mongoose").FlattenMaps<PostDocument> & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }>;
    getRelated(slug: string, limit?: number): Promise<any[]>;
    findByCategory(categorySlug: string, query: QueryPostsDto): Promise<{
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
    findByTag(tagSlug: string, query: QueryPostsDto): Promise<{
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
    getAuthorWithPosts(authorSlug: string, query: QueryPostsDto): Promise<{
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
        author: import("mongoose").FlattenMaps<AuthorProfileDocument> & Required<{
            _id: Types.ObjectId;
        }> & {
            __v: number;
        };
    }>;
    getNeighborhoodGuide(neighborhoodSlug: string): Promise<{
        city: string;
        posts: (import("mongoose").FlattenMaps<PostDocument> & Required<{
            _id: Types.ObjectId;
        }> & {
            __v: number;
        })[];
    }>;
    getMarketInsights(query: QueryPostsDto): Promise<{
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
    searchInsights(q: string, params: QueryPostsDto): Promise<{
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
    getCategories(): Promise<(import("mongoose").FlattenMaps<CategoryDocument> & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    })[]>;
    getPopularTags(limit?: number): Promise<(import("mongoose").FlattenMaps<TagDocument> & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    })[]>;
    submitDraft(userId: string, createPostDto: CreatePostDto): Promise<import("mongoose").Document<unknown, {}, PostDocument, {}, {}> & Post & import("mongoose").Document<Types.ObjectId, any, any, Record<string, any>, {}> & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }>;
    getMySubmissions(userId: string, query: QueryPostsDto): Promise<{
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
    publishScheduledPosts(): Promise<void>;
}
