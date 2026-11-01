import { PostType } from "../schemas/post.schema";
export declare class QueryPostsDto {
    category?: string;
    tag?: string;
    postType?: PostType;
    city?: string;
    author?: string;
    q?: string;
    status?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}
