import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { UserInteraction, UserInteractionDocument } from './schemas/user-interaction.schema';
import { InteractionType, InteractionSource, InteractionMetadata } from './schemas/user-interaction.schema';
import { User } from '../users/schemas/user.schema';
import { Property } from '../properties/schemas/property.schema';

export interface CreateInteractionDto {
  userId: string | Types.ObjectId;
  interactionType: InteractionType;
  propertyId?: string | Types.ObjectId;
  source?: InteractionSource;
  metadata?: Partial<InteractionMetadata>;
  agentId?: string | Types.ObjectId;
  location?: { type: 'Point'; coordinates: [number, number] };
  city?: string;
  neighborhood?: string;
  propertyType?: string;
  price?: number;
  listingType?: string;
  bedrooms?: number;
  bathrooms?: number;
  weight?: number;
}

export interface InteractionQuery {
  userId?: string | Types.ObjectId;
  interactionTypes?: InteractionType[];
  propertyId?: string | Types.ObjectId;
  source?: InteractionSource;
  city?: string;
  propertyType?: string;
  priceRange?: { min?: number; max?: number };
  bedrooms?: number;
  bathrooms?: number;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface RecommendationProfile {
  userId: Types.ObjectId;
  preferredCities: Array<{ city: string; score: number }>;
  preferredPropertyTypes: Array<{ type: string; score: number }>;
  priceRange: { min: number; max: number; confidence: number };
  preferredBedrooms: Array<{ count: number; score: number }>;
  preferredAmenities: Array<{ amenity: string; score: number }>;
  interactionPatterns: {
    viewToFavoriteRatio: number;
    viewToInquiryRatio: number;
    averageTimeOnPage: number;
    peakActivityHours: number[];
  };
  lastUpdated: Date;
}

@Injectable()
export class UserInteractionsService {
  private readonly logger = new Logger(UserInteractionsService.name);

  constructor(
    @InjectModel(UserInteraction.name)
    private userInteractionModel: Model<UserInteractionDocument>,
  ) {}

  /**
   * Track a user interaction
   */
  async trackInteraction(createInteractionDto: CreateInteractionDto): Promise<UserInteraction> {
    try {
      const interaction = new this.userInteractionModel({
        ...createInteractionDto,
        userId: new Types.ObjectId(createInteractionDto.userId),
        propertyId: createInteractionDto.propertyId 
          ? new Types.ObjectId(createInteractionDto.propertyId) 
          : undefined,
        agentId: createInteractionDto.agentId 
          ? new Types.ObjectId(createInteractionDto.agentId) 
          : undefined,
        weight: createInteractionDto.weight || this.calculateInteractionWeight(createInteractionDto.interactionType),
        metadata: createInteractionDto.metadata || {},
      });

      const savedInteraction = await interaction.save();
      this.logger.log(`Tracked interaction: ${createInteractionDto.interactionType} for user ${createInteractionDto.userId}`);
      
      return savedInteraction;
    } catch (error) {
      this.logger.error('Error tracking interaction:', error);
      throw error;
    }
  }

  /**
   * Track multiple interactions in bulk
   */
  async trackBulkInteractions(interactions: CreateInteractionDto[]): Promise<UserInteraction[]> {
    try {
      const processedInteractions = interactions.map(dto => ({
        ...dto,
        userId: new Types.ObjectId(dto.userId),
        propertyId: dto.propertyId ? new Types.ObjectId(dto.propertyId) : undefined,
        agentId: dto.agentId ? new Types.ObjectId(dto.agentId) : undefined,
        weight: dto.weight || this.calculateInteractionWeight(dto.interactionType),
        metadata: dto.metadata || {},
      }));

      const savedInteractions = await this.userInteractionModel.insertMany(processedInteractions);
      this.logger.log(`Tracked ${savedInteractions.length} bulk interactions`);
      
      return savedInteractions;
    } catch (error) {
      this.logger.error('Error tracking bulk interactions:', error);
      throw error;
    }
  }

  /**
   * Get user interactions with filtering
   */
  async getUserInteractions(query: InteractionQuery): Promise<UserInteraction[]> {
    try {
      const {
        userId,
        interactionTypes,
        propertyId,
        source,
        city,
        propertyType,
        priceRange,
        bedrooms,
        bathrooms,
        startDate,
        endDate,
        limit = 100,
        sortBy = 'createdAt',
        sortOrder = 'desc',
      } = query;

      const filterQuery: any = {};

      if (userId) {
        filterQuery.userId = new Types.ObjectId(userId);
      }

      if (interactionTypes && interactionTypes.length > 0) {
        filterQuery.interactionType = { $in: interactionTypes };
      }

      if (propertyId) {
        filterQuery.propertyId = new Types.ObjectId(propertyId);
      }

      if (source) {
        filterQuery.source = source;
      }

      if (city) {
        filterQuery.city = city;
      }

      if (propertyType) {
        filterQuery.propertyType = propertyType;
      }

      if (priceRange) {
        filterQuery.price = {};
        if (priceRange.min) filterQuery.price.$gte = priceRange.min;
        if (priceRange.max) filterQuery.price.$lte = priceRange.max;
      }

      if (bedrooms) {
        filterQuery.bedrooms = bedrooms;
      }

      if (bathrooms) {
        filterQuery.bathrooms = bathrooms;
      }

      if (startDate || endDate) {
        filterQuery.createdAt = {};
        if (startDate) filterQuery.createdAt.$gte = startDate;
        if (endDate) filterQuery.createdAt.$lte = endDate;
      }

      const sort: any = {};
      sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

      return this.userInteractionModel
        .find(filterQuery)
        .sort(sort)
        .limit(limit)
        .exec();
    } catch (error) {
      this.logger.error('Error getting user interactions:', error);
      throw error;
    }
  }

  /**
   * Get user recommendation profile based on interactions
   */
  async getUserRecommendationProfile(userId: string | Types.ObjectId): Promise<RecommendationProfile> {
    try {
      const userObjectId = new Types.ObjectId(userId);
      
      // Get all user interactions
      const interactions = await this.userInteractionModel
        .find({ userId: userObjectId })
        .sort({ createdAt: -1 })
        .exec();

      // Calculate preferences
      const cityPreferences = this.calculateCityPreferences(interactions);
      const propertyTypePreferences = this.calculatePropertyTypePreferences(interactions);
      const priceRangePreference = this.calculatePriceRangePreference(interactions);
      const bedroomPreferences = this.calculateBedroomPreferences(interactions);
      const amenityPreferences = this.calculateAmenityPreferences(interactions);
      const interactionPatterns = this.calculateInteractionPatterns(interactions);

      return {
        userId: userObjectId,
        preferredCities: cityPreferences,
        preferredPropertyTypes: propertyTypePreferences,
        priceRange: priceRangePreference,
        preferredBedrooms: bedroomPreferences,
        preferredAmenities: amenityPreferences,
        interactionPatterns,
        lastUpdated: new Date(),
      };
    } catch (error) {
      this.logger.error('Error generating recommendation profile:', error);
      throw error;
    }
  }

  /**
   * Get similar users based on interaction patterns
   */
  async getSimilarUsers(userId: string | Types.ObjectId, limit: number = 10): Promise<Types.ObjectId[]> {
    try {
      const userObjectId = new Types.ObjectId(userId);
      const userProfile = await this.getUserRecommendationProfile(userObjectId);
      // Prepare preference arrays (avoid using $in with empty arrays)
      const preferredCities = (userProfile.preferredCities || []).map(p => p.city).filter(Boolean);
      const preferredPropertyTypes = (userProfile.preferredPropertyTypes || []).map(p => p.type).filter(Boolean);
      const midPrice = ((userProfile.priceRange?.min || 0) + (userProfile.priceRange?.max || 0)) / 2;
      const minInteractions = 3; // lower threshold to be more permissive

      // If we don't have any strong preferences, fallback to top users by interaction count
      if (preferredCities.length === 0 && preferredPropertyTypes.length === 0) {
        this.logger.log(`No strong preferences for user ${userId}, falling back to top users by interactions`);

        const topUsers = await this.userInteractionModel.aggregate([
          { $match: { userId: { $ne: userObjectId } } },
          { $group: { _id: '$userId', interactionCount: { $sum: 1 } } },
          { $match: { interactionCount: { $gte: 1 } } },
          { $sort: { interactionCount: -1 } },
          { $limit: limit },
          { $project: { _id: 1 } },
        ]);

        return topUsers.map(u => u._id);
      }

      // Build dynamic $or conditions based on available preferences
      const orConditions: any[] = [];
      if (preferredCities.length > 0) {
        orConditions.push({ cities: { $in: preferredCities } });
      }
      if (preferredPropertyTypes.length > 0) {
        orConditions.push({ propertyTypes: { $in: preferredPropertyTypes } });
      }

      // Find users with similar preferences
      const similarUsers = await this.userInteractionModel.aggregate([
        { $match: { userId: { $ne: userObjectId } } },
        {
          $group: {
            _id: '$userId',
            cities: { $addToSet: '$city' },
            propertyTypes: { $addToSet: '$propertyType' },
            avgPrice: { $avg: '$price' },
            interactionCount: { $sum: 1 },
          },
        },
        // Apply preference filters if any
        ...(orConditions.length > 0
          ? [{ $match: { $or: orConditions, interactionCount: { $gte: minInteractions } } }]
          : [{ $match: { interactionCount: { $gte: minInteractions } } }]
        ),
        {
          $addFields: {
            cityScore: {
              $size: {
                $setIntersection: ['$cities', preferredCities]
              }
            },
            typeScore: {
              $size: {
                $setIntersection: ['$propertyTypes', preferredPropertyTypes]
              }
            },
            priceScore: {
              $subtract: [1000, { $abs: { $subtract: ['$avgPrice', midPrice] } }]
            },
          },
        },
        {
          $addFields: {
            similarityScore: {
              $add: ['$cityScore', '$typeScore', '$priceScore']
            }
          },
        },
        { $sort: { similarityScore: -1 } },
        { $limit: limit },
        { $project: { _id: 1 } },
      ]);

      // If still empty, fallback to top interacted users (less strict)
      if (!similarUsers || similarUsers.length === 0) {
        this.logger.log(`No similar users found using preference filters for user ${userId}, falling back to top users`);
        const topUsers = await this.userInteractionModel.aggregate([
          { $match: { userId: { $ne: userObjectId } } },
          { $group: { _id: '$userId', interactionCount: { $sum: 1 } } },
          { $sort: { interactionCount: -1 } },
          { $limit: limit },
          { $project: { _id: 1 } },
        ]);

        return topUsers.map(u => u._id);
      }

      return similarUsers.map(user => user._id);
    } catch (error) {
      this.logger.error('Error finding similar users:', error);
      throw error;
    }
  }

  /**
   * Get properties similar to what user has interacted with
   */
  async getRecommendedProperties(
    userId: string | Types.ObjectId,
    limit: number = 20,
    excludePropertyIds?: string[],
  ): Promise<Types.ObjectId[]> {
    try {
      const userObjectId = new Types.ObjectId(userId);
      const profile = await this.getUserRecommendationProfile(userObjectId);
      const similarUsers = await this.getSimilarUsers(userObjectId, 5);

      // Get properties interacted by similar users
      const recommendedProperties = await this.userInteractionModel.aggregate([
        {
          $match: {
            userId: { $in: similarUsers },
            interactionType: { $in: [InteractionType.PROPERTY_VIEW, InteractionType.PROPERTY_FAVORITE] },
            propertyId: { $exists: true },
          },
        },
        { $group: { _id: '$propertyId', score: { $sum: '$weight' }, count: { $sum: 1 } } },
        { $sort: { score: -1, count: -1 } },
        { $limit: limit * 2 }, // Get more to filter
        { $project: { _id: 1 } },
      ]);

      let propertyIds = recommendedProperties.map(p => p._id);

      // Exclude already interacted properties
      const userInteractions = await this.userInteractionModel
        .find({ 
          userId: userObjectId, 
          propertyId: { $in: propertyIds } 
        })
        .distinct('propertyId');

      propertyIds = propertyIds.filter(id => !userInteractions.includes(id));

      // Exclude specified property IDs
      if (excludePropertyIds && excludePropertyIds.length > 0) {
        propertyIds = propertyIds.filter(id => !excludePropertyIds.includes(id.toString()));
      }

      return propertyIds.slice(0, limit);
    } catch (error) {
      this.logger.error('Error getting recommended properties:', error);
      throw error;
    }
  }

  /**
   * Mark interactions as processed by recommendation engine
   */
  async markInteractionsAsProcessed(interactionIds: Types.ObjectId[], batchId?: string): Promise<void> {
    try {
      await this.userInteractionModel.updateMany(
        { _id: { $in: interactionIds } },
        { 
          isProcessed: true,
          processedAt: new Date(),
          ...(batchId && { batchId }),
        },
      );
      
      this.logger.log(`Marked ${interactionIds.length} interactions as processed`);
    } catch (error) {
      this.logger.error('Error marking interactions as processed:', error);
      throw error;
    }
  }

  /**
   * Clean up old processed interactions
   */
  async cleanupOldInteractions(daysOld: number = 365): Promise<void> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const result = await this.userInteractionModel.deleteMany({
        isProcessed: true,
        processedAt: { $lt: cutoffDate },
      });

      this.logger.log(`Cleaned up ${result.deletedCount} old interactions`);
    } catch (error) {
      this.logger.error('Error cleaning up old interactions:', error);
      throw error;
    }
  }

  // Private helper methods

  private calculateInteractionWeight(interactionType: InteractionType): number {
    const weights = {
      [InteractionType.PROPERTY_VIEW]: 1,
      [InteractionType.PROPERTY_FAVORITE]: 3,
      [InteractionType.PROPERTY_UNFAVORITE]: 2,
      [InteractionType.PROPERTY_SHARE]: 2,
      [InteractionType.PROPERTY_INQUIRY]: 5,
      [InteractionType.SEARCH]: 1,
      [InteractionType.FILTER_APPLY]: 1,
      [InteractionType.PROPERTY_COMPARE]: 2,
      [InteractionType.MAP_VIEW]: 1,
      [InteractionType.LIST_VIEW]: 1,
      [InteractionType.SIMILAR_PROPERTIES_CLICK]: 2,
      [InteractionType.RECOMMENDATION_CLICK]: 4,
      [InteractionType.RECOMMENDATION_DISMISS]: 1,
      [InteractionType.CONTACT_AGENT]: 5,
      [InteractionType.SCHEDULE_VIEWING]: 6,
    };

    return weights[interactionType] || 1;
  }

  private calculateCityPreferences(interactions: UserInteraction[]): Array<{ city: string; score: number }> {
    const cityScores = new Map<string, number>();
    
    interactions.forEach(interaction => {
      if (interaction.city) {
        const currentScore = cityScores.get(interaction.city) || 0;
        cityScores.set(interaction.city, currentScore + interaction.weight);
      }
    });

    return Array.from(cityScores.entries())
      .map(([city, score]) => ({ city, score }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
  }

  private calculatePropertyTypePreferences(interactions: UserInteraction[]): Array<{ type: string; score: number }> {
    const typeScores = new Map<string, number>();
    
    interactions.forEach(interaction => {
      if (interaction.propertyType) {
        const currentScore = typeScores.get(interaction.propertyType) || 0;
        typeScores.set(interaction.propertyType, currentScore + interaction.weight);
      }
    });

    return Array.from(typeScores.entries())
      .map(([type, score]) => ({ type, score }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
  }

  private calculatePriceRangePreference(interactions: UserInteraction[]): { min: number; max: number; confidence: number } {
    const prices = interactions
      .filter(i => i.price && i.price > 0)
      .map(i => i.price!);

    if (prices.length === 0) {
      return { min: 0, max: 1000000, confidence: 0 };
    }

    prices.sort((a, b) => a - b);
    const percentile25 = prices[Math.floor(prices.length * 0.25)] || 0;
    const percentile75 = prices[Math.floor(prices.length * 0.75)] || 1000000;

    return {
      min: percentile25,
      max: percentile75,
      confidence: Math.min(prices.length / 10, 1), // More data = higher confidence
    };
  }

  private calculateBedroomPreferences(interactions: UserInteraction[]): Array<{ count: number; score: number }> {
    const bedroomScores = new Map<number, number>();
    
    interactions.forEach(interaction => {
      if (interaction.bedrooms !== undefined) {
        const currentScore = bedroomScores.get(interaction.bedrooms) || 0;
        bedroomScores.set(interaction.bedrooms, currentScore + interaction.weight);
      }
    });

    return Array.from(bedroomScores.entries())
      .map(([count, score]) => ({ count, score }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  }

  private calculateAmenityPreferences(interactions: UserInteraction[]): Array<{ amenity: string; score: number }> {
    // This would need to be implemented based on your property amenities structure
    // For now, return empty array
    return [];
  }

  private calculateInteractionPatterns(interactions: UserInteraction[]): {
    viewToFavoriteRatio: number;
    viewToInquiryRatio: number;
    averageTimeOnPage: number;
    peakActivityHours: number[];
  } {
    const views = interactions.filter(i => i.interactionType === InteractionType.PROPERTY_VIEW).length;
    const favorites = interactions.filter(i => i.interactionType === InteractionType.PROPERTY_FAVORITE).length;
    const inquiries = interactions.filter(i => i.interactionType === InteractionType.PROPERTY_INQUIRY).length;

    const hourCounts = new Array(24).fill(0);
    interactions.forEach(interaction => {
      const hour = interaction.createdAt.getHours();
      hourCounts[hour]++;
    });

    const peakHours = hourCounts
      .map((count, hour) => ({ hour, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)
      .map(h => h.hour);

    return {
      viewToFavoriteRatio: views > 0 ? favorites / views : 0,
      viewToInquiryRatio: views > 0 ? inquiries / views : 0,
      averageTimeOnPage: 0, // Would need time tracking metadata
      peakActivityHours: peakHours,
    };
  }
}
