import { PostCategory } from '../schemas/community-post.schema';
export declare class UpdatePostDto {
    category?: PostCategory;
    title?: string;
    excerpt?: string;
    body?: string;
    tags?: string[];
}
