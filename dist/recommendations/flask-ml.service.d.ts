import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
export interface FlaskRecommendationRequest {
    property_id?: string;
    user_id?: string;
    limit?: number;
    exclude?: string[];
    property_type?: string;
}
export interface FlaskRecommendationResponse {
    success: boolean;
    data: {
        recommendations: any[];
        count: number;
    };
    error?: string;
}
export interface FlaskTrainRequest {
    properties: any[];
    user_interactions?: any[];
}
export declare class FlaskMLService {
    private readonly httpService;
    private readonly configService;
    private readonly logger;
    private readonly flaskBaseUrl;
    private readonly timeout;
    constructor(httpService: HttpService, configService: ConfigService);
    getSimilarProperties(propertyId: string, limit?: number, excludeIds?: string[]): Promise<any[]>;
    getPersonalizedRecommendations(userId: string, limit?: number, excludeIds?: string[], propertyType?: string): Promise<any[]>;
    trainModel(properties: any[], userInteractions?: any[]): Promise<{
        success: boolean;
        message: string;
    }>;
    healthCheck(): Promise<boolean>;
    private transformPropertiesToFlaskFormat;
    private extractAmenitiesArray;
    private transformInteractionsToFlaskFormat;
    private handleFlaskError;
}
