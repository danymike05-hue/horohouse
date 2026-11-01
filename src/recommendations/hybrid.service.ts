import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Property, PropertyDocument } from '../properties/schemas/property.schema';
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

@Injectable()
export class HybridRecommendationService {
  private readonly logger = new Logger(HybridRecommendationService.name);

  constructor(
    @InjectModel(Property.name) private propertyModel: Model<PropertyDocument>,
    private contentBasedService: ContentBasedRecommendationService,
    private userInteractionsService: UserInteractionsService,
  ) {}

  /**
   * Get hybrid recommendations combining multiple approaches
   */
  async getHybridRecommendations(
    userId: string | Types.ObjectId,
    options: RecommendationOptions & {
      contentWeight?: number;
      collaborativeWeight?: number;
      popularityWeight?: number;
      includeColdStart?: boolean;
    } = {},
  ): Promise<RecommendationResult> {
    const startTime = Date.now();
    const userObjectId = new Types.ObjectId(userId);

    try {
      // Default weights
      const weights = {
        contentWeight: options.contentWeight || 0.5,
        collaborativeWeight: options.collaborativeWeight || 0.3,
        popularityWeight: options.popularityWeight || 0.2,
      };

      // Get different types of recommendations
      const [contentBased, collaborative, popularity] = await Promise.all([
        this.getContentBasedScores(userObjectId, options),
        this.getCollaborativeScores(userObjectId, options),
        this.getPopularityScores(userObjectId, options),
      ]);

      // Combine scores
      const hybridRecommendations = this.combineRecommendations(
        contentBased,
        collaborative,
        popularity,
        weights,
      );

      // Sort and limit
      const finalRecommendations = hybridRecommendations
        .sort((a, b) => b.finalScore - a.finalScore)
        .slice(0, options.limit || 20);

      const processingTime = Date.now() - startTime;

      const result: RecommendationResult = {
        recommendations: finalRecommendations,
        metadata: {
          totalCandidates: Math.max(contentBased.size, collaborative.size, popularity.size),
          contentBasedCount: contentBased.size,
          collaborativeCount: collaborative.size,
          popularityCount: popularity.size,
          processingTime,
          userProfileStrength: await this.calculateProfileStrength(userObjectId),
        },
      };

      this.logger.log(`Generated ${finalRecommendations.length} hybrid recommendations for user ${userId} in ${processingTime}ms`);

      return result;
    } catch (error) {
      this.logger.error('Error generating hybrid recommendations:', error);
      throw error;
    }
  }

  /**
   * Get content-based scores
   */
  private async getContentBasedScores(
    userId: Types.ObjectId,
    options: RecommendationOptions,
  ): Promise<Map<string, { score: number; reasons: string[] }>> {
    try {
      const recommendations = await this.contentBasedService.getContentBasedRecommendations(userId, options);
      const scores = new Map();

      recommendations.forEach(rec => {
        scores.set(rec.propertyId.toString(), {
          score: rec.score,
          reasons: rec.reasons,
        });
      });

      return scores;
    } catch (error) {
      this.logger.error('Error getting content-based scores:', error);
      return new Map();
    }
  }

  /**
   * Get collaborative filtering scores
   */
  private async getCollaborativeScores(
    userId: Types.ObjectId,
    options: RecommendationOptions,
  ): Promise<Map<string, { score: number; reasons: string[] }>> {
    try {
      // Get similar users
      const similarUsers = await this.userInteractionsService.getSimilarUsers(userId.toString(), 10);
      
      if (similarUsers.length === 0) {
        return new Map();
      }

      // Get properties liked by similar users
      const recommendedProperties = await this.userInteractionsService.getRecommendedProperties(
        userId.toString(),
        50,
        options.excludePropertyIds,
      );

      const scores = new Map();
      
      // Calculate collaborative scores based on similar user interactions
      for (const propertyId of recommendedProperties) {
        const score = await this.calculateCollaborativeScore(propertyId, similarUsers);
        scores.set(propertyId.toString(), {
          score,
          reasons: ['Users with similar taste liked this property'],
        });
      }

      return scores;
    } catch (error) {
      this.logger.error('Error getting collaborative scores:', error);
      return new Map();
    }
  }

  /**
   * Get popularity-based scores
   */
  private async getPopularityScores(
    userId: Types.ObjectId,
    options: RecommendationOptions,
  ): Promise<Map<string, { score: number; reasons: string[] }>> {
    try {
      // Get popular properties based on views, favorites, inquiries
      const popularProperties = await this.propertyModel
        .find({
          isActive: true,
          availability: 'active',
          _id: { $nin: options.excludePropertyIds || [] },
        } as any)
        .sort({ 
          viewsCount: -1, 
          favoritesCount: -1, 
          inquiriesCount: -1,
          averageRating: -1,
        })
        .limit(50)
        .exec();

      const scores = new Map();

      popularProperties.forEach(property => {
        // Normalize popularity score
        const maxViews = Math.max(...popularProperties.map(p => p.viewsCount || 0));
        const maxFavorites = Math.max(...popularProperties.map(p => p.favoritesCount || 0));
        const maxInquiries = Math.max(...popularProperties.map(p => p.inquiriesCount || 0));

        const viewScore = (property.viewsCount || 0) / maxViews;
        const favoriteScore = (property.favoritesCount || 0) / maxFavorites;
        const inquiryScore = (property.inquiriesCount || 0) / maxInquiries;
        const ratingScore = (property.averageRating || 0) / 5;

        const popularityScore = (viewScore * 0.3 + favoriteScore * 0.3 + inquiryScore * 0.2 + ratingScore * 0.2);

        const reasons: string[] = [];
        if (viewScore > 0.7) (reasons as string[]).push('Highly viewed property');
        if (favoriteScore > 0.7) (reasons as string[]).push('Popular among users');
        if (ratingScore > 0.8) (reasons as string[]).push('Excellent ratings');

        scores.set(property._id.toString(), {
          score: popularityScore,
          reasons,
        });
      });

      return scores;
    } catch (error) {
      this.logger.error('Error getting popularity scores:', error);
      return new Map();
    }
  }

  /**
   * Combine recommendations from different approaches
   */
  private combineRecommendations(
    contentBased: Map<string, { score: number; reasons: string[] }>,
    collaborative: Map<string, { score: number; reasons: string[] }>,
    popularity: Map<string, { score: number; reasons: string[] }>,
    weights: { contentWeight: number; collaborativeWeight: number; popularityWeight: number },
  ): HybridRecommendation[] {
    const combinedRecommendations: HybridRecommendation[] = [];
    const allPropertyIds = new Set([
      ...contentBased.keys(),
      ...collaborative.keys(),
      ...popularity.keys(),
    ]);

    allPropertyIds.forEach(propertyId => {
      const contentScore = contentBased.get(propertyId)?.score || 0;
      const collaborativeScore = collaborative.get(propertyId)?.score || 0;
      const popularityScore = popularity.get(propertyId)?.score || 0;

      const finalScore = 
        contentScore * weights.contentWeight +
        collaborativeScore * weights.collaborativeWeight +
        popularityScore * weights.popularityWeight;

      const reasons = [
        ...(contentBased.get(propertyId)?.reasons || []),
        ...(collaborative.get(propertyId)?.reasons || []),
        ...(popularity.get(propertyId)?.reasons || []),
      ];

      combinedRecommendations.push({
        propertyId: new Types.ObjectId(propertyId),
        finalScore,
        contentBasedScore: contentScore,
        collaborativeScore,
        popularityScore,
        reasons: [...new Set(reasons)], // Remove duplicates
        methodology: weights,
      });
    });

    return combinedRecommendations;
  }

  /**
   * Calculate collaborative score for a property based on similar users
   */
  private async calculateCollaborativeScore(
    propertyId: Types.ObjectId,
    similarUsers: Types.ObjectId[],
  ): Promise<number> {
    try {
      // Get interactions of similar users with this property
      const interactions = await this.userInteractionsService.getUserInteractions({
        userId: similarUsers[0].toString(), // This would need to be enhanced for multiple users
        propertyId: propertyId.toString(),
        limit: 100,
      });

      if (interactions.length === 0) {
        return 0;
      }

      // Calculate score based on interaction types and weights
      let totalScore = 0;
      interactions.forEach(interaction => {
        const weight = this.getInteractionWeight(interaction.interactionType);
        totalScore += weight;
      });

      // Normalize score
      const maxPossibleScore = interactions.length * 5; // Max weight per interaction
      return Math.min(totalScore / maxPossibleScore, 1.0);
    } catch (error) {
      this.logger.error('Error calculating collaborative score:', error);
      return 0;
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
        return 0; // New user
      }

      // Calculate profile strength based on interaction diversity and frequency
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
   * Get interaction weight for scoring
   */
  private getInteractionWeight(interactionType: string): number {
    const weights = {
      property_view: 1,
      property_favorite: 3,
      property_inquiry: 5,
      property_share: 2,
      schedule_viewing: 6,
      contact_agent: 5,
    };

    return weights[interactionType] || 1;
  }

  /**
   * Get recommendations with full property details
   */
  async getRecommendationsWithDetails(
    userId: string | Types.ObjectId,
    options: RecommendationOptions & {
      contentWeight?: number;
      collaborativeWeight?: number;
      popularityWeight?: number;
    } = {},
  ): Promise<any[]> {
    try {
      const result = await this.getHybridRecommendations(userId, options);
      
      if (result.recommendations.length === 0) {
        return [];
      }

      // Get full property details
      const propertyIds = result.recommendations.map(r => r.propertyId);
      const properties = await this.propertyModel
        .find({ _id: { $in: propertyIds } })
        .populate('ownerId', 'name profilePicture')
        .populate('agentId', 'name profilePicture agency')
        .exec();

      // Combine recommendations with property details
      return result.recommendations.map(rec => {
        const property = properties.find(p => p._id.toString() === rec.propertyId.toString());
        return {
          ...rec,
          property,
          metadata: result.metadata,
        };
      });
    } catch (error) {
      this.logger.error('Error getting recommendations with details:', error);
      throw error;
    }
  }
}
