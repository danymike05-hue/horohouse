import { RecommendationService } from './recommendation.service';
import { MLSyncService } from './ml-sync.service';
import { FlaskMLService } from './flask-ml.service';
import { User } from '../users/schemas/user.schema';
export declare class RecommendationController {
    private readonly recommendationService;
    private readonly mlSyncService;
    private readonly flaskMLService;
    private readonly logger;
    constructor(recommendationService: RecommendationService, mlSyncService: MLSyncService, flaskMLService: FlaskMLService);
    getRecommendations(req: {
        user: User;
    }, algorithm?: string, limit?: string, excludePropertyIds?: string, contentWeight?: string, collaborativeWeight?: string, popularityWeight?: string, minScore?: string, locationWeight?: string, priceWeight?: string, amenitiesWeight?: string, boostRecentViews?: string, boostSimilarProperties?: string, preferredPropertyType?: string): Promise<{
        success: boolean;
        data: {
            recommendations: any[];
            metadata: {
                algorithm: string;
                totalCandidates: number;
                userProfileStrength: number;
                processingTime: number;
                weights?: any;
                source?: string;
            };
        };
    }>;
    getFlaskMLRecommendations(req: {
        user: User;
    }, limit?: string, excludePropertyIds?: string, preferredPropertyType?: string): Promise<{
        success: boolean;
        data: {
            recommendations: any[];
            metadata: {
                algorithm: string;
                totalCandidates: number;
                userProfileStrength: number;
                processingTime: number;
                weights?: any;
                source?: string;
            };
        };
    }>;
    getRecommendationStats(req: {
        user: User;
    }): Promise<{
        success: boolean;
        data: any;
    }>;
    submitFeedback(body: {
        propertyId: string;
        rating: number;
        clicked?: boolean;
        favorited?: boolean;
        inquired?: boolean;
    }, req: {
        user: User;
    }): Promise<{
        success: boolean;
        message: string;
    }>;
    trainMLModel(force?: string): Promise<{
        success: boolean;
        message: string;
        data: any;
    }>;
    getMLStatus(): Promise<{
        success: boolean;
        data: {
            flaskService: {
                healthy: boolean;
                status: string;
            };
            sync: {
                isTraining: boolean;
                lastTrainingTime: Date | null;
                autoSyncEnabled: boolean;
            };
        };
    }>;
    getContentBasedRecommendations(req: {
        user: User;
    }, limit?: string, excludePropertyIds?: string, minScore?: string, locationWeight?: string, priceWeight?: string, amenitiesWeight?: string): Promise<{
        success: boolean;
        data: {
            recommendations: any[];
            metadata: {
                algorithm: string;
                totalCandidates: number;
                userProfileStrength: number;
                processingTime: number;
                weights?: any;
                source?: string;
            };
        };
    }>;
    getCollaborativeRecommendations(req: {
        user: User;
    }, limit?: string, excludePropertyIds?: string): Promise<{
        success: boolean;
        data: {
            recommendations: any[];
            metadata: {
                algorithm: string;
                totalCandidates: number;
                userProfileStrength: number;
                processingTime: number;
                weights?: any;
                source?: string;
            };
        };
    }>;
    getPopularityRecommendations(req: {
        user: User;
    }, limit?: string, excludePropertyIds?: string): Promise<{
        success: boolean;
        data: {
            recommendations: any[];
            metadata: {
                algorithm: string;
                totalCandidates: number;
                userProfileStrength: number;
                processingTime: number;
                weights?: any;
                source?: string;
            };
        };
    }>;
    getHybridRecommendations(req: {
        user: User;
    }, limit?: string, excludePropertyIds?: string, contentWeight?: string, collaborativeWeight?: string, popularityWeight?: string, minScore?: string): Promise<{
        success: boolean;
        data: {
            recommendations: any[];
            metadata: {
                algorithm: string;
                totalCandidates: number;
                userProfileStrength: number;
                processingTime: number;
                weights?: any;
                source?: string;
            };
        };
    }>;
}
