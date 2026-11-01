import { Model, Types } from 'mongoose';
import { PropertyDocument } from '../properties/schemas/property.schema';
import { UserInteractionsService } from '../user-interactions/user-interactions.service';
import { ContentBasedRecommendationService, RecommendationOptions } from './content-based.service';
export interface HybridRecommendation {
    propertyId: Types.ObjectId;
    finalScore: number;
    contentBasedScore: number;
    collaborativeScore: number;
    popularityScore: number;
    reasons: string[];
    methodology: {
        contentWeight: number;
        collaborativeWeight: number;
        popularityWeight: number;
    };
}
export interface RecommendationResult {
    recommendations: HybridRecommendation[];
    metadata: {
        totalCandidates: number;
        contentBasedCount: number;
        collaborativeCount: number;
        popularityCount: number;
        processingTime: number;
        userProfileStrength: number;
    };
}
export declare class HybridRecommendationService {
    private propertyModel;
    private contentBasedService;
    private userInteractionsService;
    private readonly logger;
    constructor(propertyModel: Model<PropertyDocument>, contentBasedService: ContentBasedRecommendationService, userInteractionsService: UserInteractionsService);
    getHybridRecommendations(userId: string | Types.ObjectId, options?: RecommendationOptions & {
        contentWeight?: number;
        collaborativeWeight?: number;
        popularityWeight?: number;
        includeColdStart?: boolean;
    }): Promise<RecommendationResult>;
    private getContentBasedScores;
    private getCollaborativeScores;
    private getPopularityScores;
    private combineRecommendations;
    private calculateCollaborativeScore;
    private calculateProfileStrength;
    private calculateRecencyScore;
    private getInteractionWeight;
    getRecommendationsWithDetails(userId: string | Types.ObjectId, options?: RecommendationOptions & {
        contentWeight?: number;
        collaborativeWeight?: number;
        popularityWeight?: number;
    }): Promise<any[]>;
}
