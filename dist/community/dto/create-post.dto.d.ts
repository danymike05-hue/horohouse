import { PostCategory } from '../schemas/community-post.schema';
export declare class CreatePostDto {
    category: PostCategory;
    title: string;
    excerpt?: string;
    body?: string;
    tags?: string[];
    replyToId?: string;
    rootPostId?: string;
}
