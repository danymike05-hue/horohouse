import { Model } from 'mongoose';
import { PropertyDocument } from '../properties/schemas/property.schema';
import { UserDocument } from '../users/schemas/user.schema';
import { UserInteractionsService } from '../user-interactions/user-interactions.service';
import { FlaskMLService } from './flask-ml.service';
export interface RecommendationRequest {
    userId: string;
    limit?: number;
    excludePropertyIds?: string[];
    algorithm?: 'content-based' | 'collaborative' | 'hybrid' | 'popularity' | 'flask-ml';
    options?: {
        contentWeight?: number;
        collaborativeWeight?: number;
        popularityWeight?: number;
        minScore?: number;
        locationWeight?: number;
        priceWeight?: number;
        amenitiesWeight?: number;
        boostRecentViews?: boolean;
        boostSimilarProperties?: boolean;
        preferredPropertyType?: string;
    };
}
export interface RecommendationResponse {
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
}
export declare class RecommendationService {
    private propertyModel;
    private userModel;
    private userInteractionsService;
    private flaskMLService;
    private readonly logger;
    constructor(propertyModel: Model<PropertyDocument>, userModel: Model<UserDocument>, userInteractionsService: UserInteractionsService, flaskMLService: FlaskMLService);
    getRecommendations(request: RecommendationRequest): Promise<RecommendationResponse>;
    private getFlaskMLRecommendations;
    private enrichFlaskRecommendations;
    private calculateProfileStrength;
    private calculateRecencyScore;
    getRecommendationStats(userId: string): Promise<any>;
    updateRecommendationWeights(userId: string, feedback: {
        propertyId: string;
        rating: number;
        clicked?: boolean;
        favorited?: boolean;
        inquired?: boolean;
    }): Promise<void>;
}
