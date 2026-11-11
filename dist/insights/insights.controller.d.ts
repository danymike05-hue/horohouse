import { InsightsService } from './(JWT-guarded)/insights.service';
import { QueryPostsDto } from './dto/insights.dto';
export declare class InsightsController {
    private readonly insightsService;
    constructor(insightsService: InsightsService);
    findAll(query: QueryPostsDto): Promise<{
        data: (import("mongoose").FlattenMaps<import("./schemas/post.schema").PostDocument> & Required<{
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
    featured(limit?: number): Promise<(import("mongoose").FlattenMaps<import("./schemas/post.schema").PostDocument> & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    })[]>;
    trending(limit?: number): Promise<(import("mongoose").FlattenMaps<import("./schemas/post.schema").PostDocument> & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    })[]>;
    search(q: string, query: QueryPostsDto): Promise<{
        data: (import("mongoose").FlattenMaps<import("./schemas/post.schema").PostDocument> & Required<{
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
    getCategories(): Promise<(import("mongoose").FlattenMaps<import("./schemas/category.schema").CategoryDocument> & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    })[]>;
    popularTags(limit?: number): Promise<(import("mongoose").FlattenMaps<import("./schemas/tag.schema").TagDocument> & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    })[]>;
    marketInsights(query: QueryPostsDto): Promise<{
        data: (import("mongoose").FlattenMaps<import("./schemas/post.schema").PostDocument> & Required<{
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
    byCategory(slug: string, query: QueryPostsDto): Promise<{
        data: (import("mongoose").FlattenMaps<import("./schemas/post.schema").PostDocument> & Required<{
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
    byTag(slug: string, query: QueryPostsDto): Promise<{
        data: (import("mongoose").FlattenMaps<import("./schemas/post.schema").PostDocument> & Required<{
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
    authorPage(slug: string, query: QueryPostsDto): Promise<{
        data: (import("mongoose").FlattenMaps<import("./schemas/post.schema").PostDocument> & Required<{
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
        author: import("mongoose").FlattenMaps<import("./schemas/author-profile.schema").AuthorProfileDocument> & Required<{
            _id: import("mongoose").Types.ObjectId;
        }> & {
            __v: number;
        };
    }>;
    neighborhoodGuide(slug: string): Promise<{
        city: string;
        posts: (import("mongoose").FlattenMaps<import("./schemas/post.schema").PostDocument> & Required<{
            _id: import("mongoose").Types.ObjectId;
        }> & {
            __v: number;
        })[];
    }>;
    findOne(slug: string): Promise<import("mongoose").FlattenMaps<import("./schemas/post.schema").PostDocument> & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    }>;
    related(slug: string, limit?: number): Promise<any[]>;
    submitDraft(dto: any, req: any): Promise<import("mongoose").Document<unknown, {}, import("./schemas/post.schema").PostDocument, {}, {}> & import("./schemas/post.schema").Post & import("mongoose").Document<import("mongoose").Types.ObjectId, any, any, Record<string, any>, {}> & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    }>;
    mySubmissions(query: QueryPostsDto, req: any): Promise<{
        data: (import("mongoose").FlattenMaps<import("./schemas/post.schema").PostDocument> & Required<{
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
