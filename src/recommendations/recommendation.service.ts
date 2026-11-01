import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Property, PropertyDocument } from '../properties/schemas/property.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
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

@Injectable()
export class RecommendationService {
  private readonly logger = new Logger(RecommendationService.name);

  constructor(
    @InjectModel(Property.name) private propertyModel: Model<PropertyDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private userInteractionsService: UserInteractionsService,
    private flaskMLService: FlaskMLService,
  ) {}

  /**
   * Get personalized recommendations for a user
   */
  async getRecommendations(request: RecommendationRequest): Promise<RecommendationResponse> {
    const startTime = Date.now();

    try {
      const userId = new Types.ObjectId(request.userId);
      const requestedAlgorithm = request.algorithm || 'hybrid';
      const algorithm: RecommendationRequest['algorithm'] = 'flask-ml';
      if (requestedAlgorithm !== algorithm) {
        this.logger.warn(
          `Requested algorithm "${requestedAlgorithm}" overridden to "${algorithm}" (Flask-only mode)`,
        );
      }
      const limit = request.limit || 20;

      // Validate user exists
      const user = await this.userModel.findById(userId).exec();
      if (!user) {
        throw new Error('User not found');
      }

      let recommendations: any[] = [];
      let metadata: any = {
        algorithm,
        totalCandidates: 0,
        userProfileStrength: 0,
        processingTime: 0,
      };

      recommendations = await this.getFlaskMLRecommendations(
        request.userId,
        limit,
        request.excludePropertyIds,
        request.options?.preferredPropertyType,
      );
      metadata.source = 'Flask ML Service';
      metadata.userProfileStrength = await this.calculateProfileStrength(userId);

      metadata.processingTime = Date.now() - startTime;
      metadata.totalCandidates = recommendations.length;
      const servedFromFlask = metadata.source?.toLowerCase().includes('flask') ?? false;
      this.logger.log(
        `Recommendations for user ${request.userId} (algorithm=${algorithm}) servedFromFlask=${servedFromFlask} source=${metadata.source || 'unknown'}`,
      );

      return {
        success: true,
        data: {
          recommendations,
          metadata,
        },
      };
    } catch (error) {
      this.logger.error('Error getting recommendations:', error);
      throw error;
    }
  }

  /**
   * Get recommendations from Flask ML service
   */
  private async getFlaskMLRecommendations(
    userId: string,
    limit: number,
    excludeIds: string[] = [],
    preferredPropertyType?: string,
  ): Promise<any[]> {
    try {
      this.logger.log(`Getting Flask ML recommendations for user ${userId}`);

      // Try to get personalized recommendations from Flask
      let flaskRecommendations = await this.flaskMLService.getPersonalizedRecommendations(
        userId,
        limit,
        excludeIds,
        preferredPropertyType,
      );

      // Enrich Flask recommendations with full property data from database
      const enrichedRecommendations = await this.enrichFlaskRecommendations(
        flaskRecommendations,
      );

      return enrichedRecommendations;
    } catch (error) {
      this.logger.error('Error getting Flask ML recommendations:', error);
      throw error;
    }
  }

  /**
   * Enrich Flask recommendations with full property data
   */
  private async enrichFlaskRecommendations(flaskRecommendations: any[]): Promise<any[]> {
    try {
      if (flaskRecommendations.length === 0) {
        return [];
      }

      // Extract property IDs from Flask response
      const propertyIds = flaskRecommendations
        .map(rec => rec._id || rec.propertyId)
        .filter(Boolean)
        .map(id => new Types.ObjectId(id));

      // Fetch full property details from database
      const properties = await this.propertyModel
        .find({ _id: { $in: propertyIds } })
        .populate('ownerId', 'name profilePicture email')
        .populate('agentId', 'name profilePicture agency email')
        .exec();

      // Create a map for quick lookup
      const propertyMap = new Map(
        properties.map(p => [p._id.toString(), p]),
      );

      // Merge Flask recommendations with full property data
      return flaskRecommendations
        .map(rec => {
          const propertyId = (rec._id || rec.propertyId)?.toString();
          const property = propertyMap.get(propertyId);

          if (!property) {
            this.logger.warn(`Property ${propertyId} not found in database`);
            return null;
          }

          return {
            property,
            propertyId: property._id,
            finalScore: rec.similarity_score || rec.score || 0.5,
            reasons: ['Recommended by ML model based on your preferences'],
            methodology: {
              algorithm: 'flask-ml',
              source: 'Flask ML Service',
            },
          };
        })
        .filter(Boolean); // Remove null entries
    } catch (error) {
      this.logger.error('Error enriching Flask recommendations:', error);
      return [];
    }
  }


  /**
   * Calculate user profile strength
   */
  private async calculateProfileStrength(userId: Types.ObjectId): Promise<number> {
    try {
      const interactions = await this.userInteractionsService.getUserInteractions({
        userId,
        limit: 1000,
      });

      if (interactions.length === 0) {
        return 0;
      }

      const uniqueProperties = new Set(interactions.map(i => i.propertyId).filter(Boolean)).size;
      const interactionTypes = new Set(interactions.map(i => i.interactionType)).size;
      const recencyScore = this.calculateRecencyScore(interactions);

      const strengthScore = 
        (uniqueProperties / Math.min(interactions.length, 100)) * 0.4 +
        (interactionTypes / 10) * 0.3 +
        recencyScore * 0.3;

      return Math.min(strengthScore, 1.0);
    } catch (error) {
      this.logger.error('Error calculating profile strength:', error);
      return 0;
    }
  }

  /**
   * Calculate recency score based on interaction timestamps
   */
  private calculateRecencyScore(interactions: any[]): number {
    if (interactions.length === 0) return 0;

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    const recentInteractions = interactions.filter(i => 
      new Date(i.createdAt) > thirtyDaysAgo
    ).length;

    return recentInteractions / interactions.length;
  }

  /**
   * Get recommendation statistics for analytics
   */
  async getRecommendationStats(userId: string): Promise<any> {
    try {
      const userObjectId = new Types.ObjectId(userId);
      
      const profile = await this.userInteractionsService.getUserRecommendationProfile(userObjectId);
      const similarUsers = await this.userInteractionsService.getSimilarUsers(userId, 10);
      const flaskRecommendations = await this.flaskMLService.getPersonalizedRecommendations(
        userId,
        100,
      );
      const profileStrength = await this.calculateProfileStrength(userObjectId);
      const flaskHealthy = await this.flaskMLService.healthCheck();

      return {
        userProfile: {
          preferredCities: profile.preferredCities.slice(0, 5),
          preferredPropertyTypes: profile.preferredPropertyTypes.slice(0, 5),
          priceRange: profile.priceRange,
          interactionPatterns: profile.interactionPatterns,
        },
        similarUsersCount: similarUsers.length,
        recommendationCandidates: flaskRecommendations.length,
        profileStrength,
        mlServiceStatus: flaskHealthy ? 'available' : 'unavailable',
        lastUpdated: new Date(),
      };
    } catch (error) {
      this.logger.error('Error getting recommendation stats:', error);
      throw error;
    }
  }

  /**
   * Update recommendation weights based on user feedback
   */
  async updateRecommendationWeights(
    userId: string,
    feedback: {
      propertyId: string;
      rating: number;
      clicked?: boolean;
      favorited?: boolean;
      inquired?: boolean;
    },
  ): Promise<void> {
    try {
      const userObjectId = new Types.ObjectId(userId);
      const propertyObjectId = new Types.ObjectId(feedback.propertyId);

      if (feedback.clicked) {
        await this.userInteractionsService.trackInteraction({
          userId: userObjectId,
          interactionType: 'recommendation_click' as any,
          propertyId: propertyObjectId,
          source: 'recommendations' as any,
          metadata: { rating: feedback.rating },
        });
      }

      if (feedback.favorited) {
        await this.userInteractionsService.trackInteraction({
          userId: userObjectId,
          interactionType: 'property_favorite' as any,
          propertyId: propertyObjectId,
          source: 'recommendations' as any,
          metadata: { rating: feedback.rating },
        });
      }

      if (feedback.inquired) {
        await this.userInteractionsService.trackInteraction({
          userId: userObjectId,
          interactionType: 'property_inquiry' as any,
          propertyId: propertyObjectId,
          source: 'recommendations' as any,
          metadata: { rating: feedback.rating },
        });
      }

      this.logger.log(`Updated recommendation weights for user ${userId}`);
    } catch (error) {
      this.logger.error('Error updating recommendation weights:', error);
      throw error;
    }
  }
}