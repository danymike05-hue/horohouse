import { Injectable, Logger } from '@nestjs/common';
import { Model, Types } from 'mongoose';
import { Property, PropertyDocument } from '../properties/schemas/property.schema';
import { UserInteractionsService } from '../user-interactions/user-interactions.service';
import { User, UserDocument } from '../users/schemas/user.schema';
import { InjectModel } from '@nestjs/mongoose';
import { InteractionType } from '../user-interactions/schemas/user-interaction.schema';


export interface ContentBasedRecommendation {
  propertyId: Types.ObjectId;
  score: number;
  reasons: string[];
  similarityFeatures: {
    propertyTypeMatch: number;
    priceRangeMatch: number;
    locationMatch: number;
    amenitiesMatch: number;
    sizeMatch: number;
    featuresMatch: number;
  };
}

export interface UserProfile {
  userId: Types.ObjectId;
  preferredPropertyTypes: Map<string, number>;
  priceRange: { min: number; max: number; weight: number };
  preferredCities: Map<string, number>;
  preferredAmenities: Map<string, number>;
  preferredBedrooms: Map<number, number>;
  preferredBathrooms: Map<number, number>;
  preferredSizeRange: { min: number; max: number; weight: number };
  interactionWeights: Map<InteractionType, number>;
}

export interface RecommendationOptions {
  limit?: number;
  excludePropertyIds?: string[];
  minScore?: number;
  boostRecentViews?: boolean;
  boostSimilarProperties?: boolean;
  locationWeight?: number;
  priceWeight?: number;
  amenitiesWeight?: number;
}

@Injectable()
export class ContentBasedRecommendationService {
  private readonly logger = new Logger(ContentBasedRecommendationService.name);

  constructor(
    @InjectModel(Property.name) private propertyModel: Model<PropertyDocument>,
    private userInteractionsService: UserInteractionsService,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  /**
   * Get content-based recommendations for a user
   */
  async getContentBasedRecommendations(
    userId: string | Types.ObjectId,
    options: RecommendationOptions = {},
  ): Promise<ContentBasedRecommendation[]> {
    try {
      const userObjectId = new Types.ObjectId(userId);
      
      // Get user profile from interactions
      const userProfile = await this.buildUserProfile(userObjectId);
      
      // Get candidate properties (exclude user's own properties and interacted properties)
      const candidateProperties = await this.getCandidateProperties(userObjectId, options);
      
      // Calculate similarity scores for each candidate
      const recommendations: ContentBasedRecommendation[] = [];
      
      for (const property of candidateProperties) {
        const score = await this.calculateContentSimilarity(property, userProfile, options);
        
        if (score.score >= (options.minScore || 0.3)) {
          recommendations.push(score);
        }
      }
      
      // Sort by score and apply boost factors
      const sortedRecommendations = recommendations
        .sort((a, b) => b.score - a.score)
        .slice(0, options.limit || 20);
      
      this.logger.log(`Generated ${sortedRecommendations.length} content-based recommendations for user ${userId}`);
      
      return sortedRecommendations;
    } catch (error) {
      this.logger.error('Error generating content-based recommendations:', error);
      throw error;
    }
  }

  /**
   * Build user profile from interaction history
   */
  async buildUserProfile(userId: Types.ObjectId): Promise<UserProfile> {
    try {
      // Get user interactions
      const interactions = await this.userInteractionsService.getUserInteractions({
        userId,
        interactionTypes: [
          InteractionType.PROPERTY_VIEW,
          InteractionType.PROPERTY_FAVORITE,
          InteractionType.PROPERTY_INQUIRY,
        ],
        limit: 500,
      });

      const userProfile: UserProfile = {
        userId,
        preferredPropertyTypes: new Map(),
        priceRange: { min: 0, max: 10000000, weight: 0 },
        preferredCities: new Map(),
        preferredAmenities: new Map(),
        preferredBedrooms: new Map(),
        preferredBathrooms: new Map(),
        preferredSizeRange: { min: 0, max: 1000, weight: 0 },
        interactionWeights: new Map(),
      };

      // Process interactions to build preferences
      const propertyIds = interactions
        .filter(i => i.propertyId)
        .map(i => i.propertyId!);

      if (propertyIds.length === 0) {
        // If the user has explicit preferences set on their profile, merge them
        try {
          const user = await this.userModel.findById(userId).exec();
          if (user && user.preferences) {
            const prefs = user.preferences as any;
            if (prefs.propertyTypes && Array.isArray(prefs.propertyTypes)) {
              prefs.propertyTypes.forEach((t: string) => {
                const current = userProfile.preferredPropertyTypes.get(t) || 0;
                userProfile.preferredPropertyTypes.set(t, current + 5); // give a moderate weight
              });
            }

            if (prefs.cities && Array.isArray(prefs.cities)) {
              prefs.cities.forEach((c: string) => {
                const current = userProfile.preferredCities.get(c) || 0;
                userProfile.preferredCities.set(c, current + 5);
              });
            }

            if (prefs.amenities && Array.isArray(prefs.amenities)) {
              prefs.amenities.forEach((a: string) => {
                const current = userProfile.preferredAmenities.get(a) || 0;
                userProfile.preferredAmenities.set(a, current + 3);
              });
            }

            if (prefs.minPrice || prefs.maxPrice) {
              userProfile.priceRange.min = prefs.minPrice || userProfile.priceRange.min;
              userProfile.priceRange.max = prefs.maxPrice || userProfile.priceRange.max;
              userProfile.priceRange.weight = 1; // indicate preference present
            }
          }
        } catch (err) {
          this.logger.warn('Error reading user preferences, continuing with default profile');
        }

        return userProfile; // Return profile possibly enriched with explicit preferences
      }

      // Get property details for interacted properties
      const properties = await this.propertyModel
        .find({ _id: { $in: propertyIds } })
        .exec();

      // Calculate preferences based on interactions
      for (const interaction of interactions) {
        if (!interaction.propertyId) continue;

        const property = properties.find(p => p._id.toString() === interaction.propertyId?.toString());
        if (!property) continue;

        const weight = this.getInteractionWeight(interaction.interactionType);

        // Property type preferences
        if (property.type) {
          const current = userProfile.preferredPropertyTypes.get(property.type) || 0;
          userProfile.preferredPropertyTypes.set(property.type, current + weight);
        }

        // Price range preferences
        if (property.price) {
          userProfile.priceRange.min = Math.min(userProfile.priceRange.min, property.price * 0.8);
          userProfile.priceRange.max = Math.max(userProfile.priceRange.max, property.price * 1.2);
          userProfile.priceRange.weight += weight;
        }

        // City preferences
        if (property.city) {
          const current = userProfile.preferredCities.get(property.city) || 0;
          userProfile.preferredCities.set(property.city, current + weight);
        }

        // Bedroom preferences
        if (property.amenities?.bedrooms) {
          const current = userProfile.preferredBedrooms.get(property.amenities.bedrooms) || 0;
          userProfile.preferredBedrooms.set(property.amenities.bedrooms, current + weight);
        }

        // Bathroom preferences
        if (property.amenities?.bathrooms) {
          const current = userProfile.preferredBathrooms.get(property.amenities.bathrooms) || 0;
          userProfile.preferredBathrooms.set(property.amenities.bathrooms, current + weight);
        }

        // Size preferences
        if (property.area) {
          userProfile.preferredSizeRange.min = Math.min(userProfile.preferredSizeRange.min, property.area * 0.8);
          userProfile.preferredSizeRange.max = Math.max(userProfile.preferredSizeRange.max, property.area * 1.2);
          userProfile.preferredSizeRange.weight += weight;
        }

        // Amenities preferences
        if (property.amenities) {
          Object.entries(property.amenities).forEach(([amenity, value]) => {
            if (value === true) {
              const current = userProfile.preferredAmenities.get(amenity) || 0;
              userProfile.preferredAmenities.set(amenity, current + weight * 0.5);
            }
          });
        }

        // Interaction weights
        const currentWeight = userProfile.interactionWeights.get(interaction.interactionType) || 0;
        userProfile.interactionWeights.set(interaction.interactionType, currentWeight + weight);
      }

      return userProfile;
    } catch (error) {
      this.logger.error('Error building user profile:', error);
      throw error;
    }
  }

  /**
   * Calculate content similarity between a property and user profile
   */
  private async calculateContentSimilarity(
    property: Property,
    userProfile: UserProfile,
    options: RecommendationOptions,
  ): Promise<ContentBasedRecommendation> {
    const features = {
      propertyTypeMatch: 0,
      priceRangeMatch: 0,
      locationMatch: 0,
      amenitiesMatch: 0,
      sizeMatch: 0,
      featuresMatch: 0,
    };

    const reasons: string[] = [];

    // Property type similarity
    if (property.type && userProfile.preferredPropertyTypes.has(property.type)) {
      features.propertyTypeMatch = userProfile.preferredPropertyTypes.get(property.type)! / 10;
      reasons.push(`Matches preferred property type: ${property.type}`);
    }

    // Price range similarity
    if (property.price && userProfile.priceRange.weight > 0) {
      const priceScore = this.calculatePriceSimilarity(property.price, userProfile.priceRange);
      features.priceRangeMatch = priceScore;
      if (priceScore > 0.5) {
        reasons.push('Within preferred price range');
      }
    }

    // Location similarity
    if (property.city && userProfile.preferredCities.has(property.city)) {
      features.locationMatch = userProfile.preferredCities.get(property.city)! / 10;
      reasons.push(`Located in preferred city: ${property.city}`);
    }

    // Amenities similarity
    if (property.amenities) {
      const amenitiesScore = this.calculateAmenitiesSimilarity(property.amenities, userProfile.preferredAmenities);
      features.amenitiesMatch = amenitiesScore;
      if (amenitiesScore > 0.3) {
        reasons.push('Has preferred amenities');
      }
    }

    // Size similarity
    if (property.area && userProfile.preferredSizeRange.weight > 0) {
      const sizeScore = this.calculateSizeSimilarity(property.area, userProfile.preferredSizeRange);
      features.sizeMatch = sizeScore;
      if (sizeScore > 0.5) {
        reasons.push('Matches preferred size');
      }
    }

    // Features similarity (keywords, nearby amenities, etc.)
    const featuresScore = this.calculateFeaturesSimilarity(property, userProfile);
    features.featuresMatch = featuresScore;

    // Calculate weighted score
    const locationWeight = options.locationWeight || 0.25;
    const priceWeight = options.priceWeight || 0.2;
    const amenitiesWeight = options.amenitiesWeight || 0.2;
    const typeWeight = 0.15;
    const sizeWeight = 0.1;
    const featuresWeight = 0.1;

    const totalScore = 
      features.propertyTypeMatch * typeWeight +
      features.priceRangeMatch * priceWeight +
      features.locationMatch * locationWeight +
      features.amenitiesMatch * amenitiesWeight +
      features.sizeMatch * sizeWeight +
      features.featuresMatch * featuresWeight;

    // Apply boost factors
    let finalScore = totalScore;
    
    if (options.boostRecentViews) {
      finalScore *= 1.1; // 10% boost for recently viewed properties
    }
    
    if (options.boostSimilarProperties) {
      finalScore *= 1.05; // 5% boost for similar properties
    }

    return {
      propertyId: property._id,
      score: Math.min(finalScore, 1.0), // Cap at 1.0
      reasons,
      similarityFeatures: features,
    };
  }

  /**
   * Get candidate properties for recommendation
   */
  private async getCandidateProperties(
    userId: Types.ObjectId,
    options: RecommendationOptions,
  ): Promise<Property[]> {
    try {
      // Get user's interacted properties to exclude
      const userInteractions = await this.userInteractionsService.getUserInteractions({
        userId,
        limit: 1000,
      });

      const excludeIds = [
        ...userInteractions.map(i => i.propertyId).filter(Boolean),
        ...(options.excludePropertyIds || []),
      ];

      // Get active properties
      const query: any = {
        isActive: true,
        availability: 'active',
        _id: { $nin: excludeIds },
      };

      // Exclude user's own properties
      query.ownerId = { $ne: userId };

      const properties = await this.propertyModel
        .find(query)
        .populate('ownerId', 'name')
        .populate('agentId', 'name agency')
        .limit(500) // Limit candidates for performance
        .exec();

      return properties;
    } catch (error) {
      this.logger.error('Error getting candidate properties:', error);
      throw error;
    }
  }

  /**
   * Calculate price similarity score
   */
  private calculatePriceSimilarity(price: number, priceRange: { min: number; max: number; weight: number }): number {
    if (price < priceRange.min || price > priceRange.max) {
      // Outside preferred range, calculate penalty
      const deviation = Math.max(priceRange.min - price, price - priceRange.max);
      const maxDeviation = Math.max(priceRange.max - priceRange.min, priceRange.min);
      return Math.max(0, 1 - (deviation / maxDeviation)) * 0.3;
    }
    
    // Within preferred range
    const center = (priceRange.min + priceRange.max) / 2;
    const range = priceRange.max - priceRange.min;
    const deviation = Math.abs(price - center);
    return Math.max(0, 1 - (deviation / range)) * 0.8;
  }

  /**
   * Calculate amenities similarity score
   */
  private calculateAmenitiesSimilarity(
    propertyAmenities: any,
    preferredAmenities: Map<string, number>,
  ): number {
    if (preferredAmenities.size === 0) return 0;

    let matchScore = 0;
    let totalWeight = 0;

    Object.entries(propertyAmenities).forEach(([amenity, value]) => {
      if (value === true && preferredAmenities.has(amenity)) {
        matchScore += preferredAmenities.get(amenity)!;
      }
      totalWeight += preferredAmenities.get(amenity) || 0;
    });

    return totalWeight > 0 ? matchScore / totalWeight : 0;
  }

  /**
   * Calculate size similarity score
   */
  private calculateSizeSimilarity(size: number, sizeRange: { min: number; max: number; weight: number }): number {
    if (size < sizeRange.min || size > sizeRange.max) {
      const deviation = Math.max(sizeRange.min - size, size - sizeRange.max);
      const maxDeviation = Math.max(sizeRange.max - sizeRange.min, sizeRange.min);
      return Math.max(0, 1 - (deviation / maxDeviation)) * 0.3;
    }
    
    const center = (sizeRange.min + sizeRange.max) / 2;
    const range = sizeRange.max - sizeRange.min;
    const deviation = Math.abs(size - center);
    return Math.max(0, 1 - (deviation / range)) * 0.8;
  }

  /**
   * Calculate features similarity score (keywords, nearby amenities, etc.)
   */
  private calculateFeaturesSimilarity(property: Property, userProfile: UserProfile): number {
    let score = 0;
    let factors = 0;

    // Keywords matching
    if (property.keywords && property.keywords.length > 0) {
      // This could be enhanced with user's search history
      factors++;
    }

    // Nearby amenities matching
    if (property.nearbyAmenities && property.nearbyAmenities.length > 0) {
      score += 0.3; // Base score for having nearby amenities
      factors++;
    }

    // Transport access
    if (property.transportAccess && property.transportAccess.length > 0) {
      score += 0.2;
      factors++;
    }

    // Property features
    if (property.isVerified) score += 0.1;
    if (property.isFeatured) score += 0.1;
    if (property.averageRating && property.averageRating > 4) score += 0.2;

    return factors > 0 ? score / factors : 0;
  }

  /**
   * Get interaction weight for different interaction types
   */
  private getInteractionWeight(interactionType: InteractionType): number {
    const weights = {
      [InteractionType.PROPERTY_VIEW]: 1,
      [InteractionType.PROPERTY_FAVORITE]: 3,
      [InteractionType.PROPERTY_INQUIRY]: 5,
      [InteractionType.PROPERTY_SHARE]: 2,
      [InteractionType.SCHEDULE_VIEWING]: 6,
      [InteractionType.CONTACT_AGENT]: 5,
    };

    return weights[interactionType] || 1;
  }

  /**
   * Get recommendations with detailed property information
   */
  async getRecommendationsWithDetails(
    userId: string | Types.ObjectId,
    options: RecommendationOptions = {},
  ): Promise<any[]> {
    try {
      const recommendations = await this.getContentBasedRecommendations(userId, options);
      
      if (recommendations.length === 0) {
        return [];
      }

      // Get full property details
      const propertyIds = recommendations.map(r => r.propertyId);
      const properties = await this.propertyModel
        .find({ _id: { $in: propertyIds } })
        .populate('ownerId', 'name profilePicture')
        .populate('agentId', 'name profilePicture agency')
        .exec();

      // Combine recommendations with property details
      return recommendations.map(rec => {
        const property = properties.find(p => p._id.toString() === rec.propertyId.toString());
        return {
          ...rec,
          property,
        };
      });
    } catch (error) {
      this.logger.error('Error getting recommendations with details:', error);
      throw error;
    }
  }
}
