import { Model } from 'mongoose';
import { PostDocument } from '../schemas/post.schema';
export declare class InsightsRecommendationService {
    private postModel;
    constructor(postModel: Model<PostDocument>);
    getRelatedPosts(post: PostDocument, limit?: number): Promise<any[]>;
    getTrendingScore(viewCount: number, publishedAt: Date): Promise<number>;
}
