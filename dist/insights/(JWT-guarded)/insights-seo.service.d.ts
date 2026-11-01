import { Model } from 'mongoose';
import { PostDocument } from '../schemas/post.schema';
export declare class InsightsSeoService {
    private postModel;
    constructor(postModel: Model<PostDocument>);
    generateSlug(title: string, existingId?: string): Promise<string>;
    calculateReadingTime(text: string): number;
    extractTextFromTiptap(tiptapJson: Record<string, any>): string;
    buildStructuredData(post: any, baseUrl: string): Record<string, any>;
    buildSitemapEntry(post: any, baseUrl: string): {
        url: string;
        lastModified: any;
        changeFrequency: string;
        priority: number;
    };
}
