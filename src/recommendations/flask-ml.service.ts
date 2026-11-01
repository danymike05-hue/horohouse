import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { AxiosError } from 'axios';

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

@Injectable()
export class FlaskMLService {
  private readonly logger = new Logger(FlaskMLService.name);
  private readonly flaskBaseUrl: string;
  private readonly timeout: number;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.flaskBaseUrl = this.configService.get<string>(
      'FLASK_ML_URL',
      'http://localhost:5000',
    );
    this.timeout = this.configService.get<number>('FLASK_TIMEOUT', 10000);
    
    this.logger.log(`Flask ML Service initialized at: ${this.flaskBaseUrl}`);
  }

  /**
   * Get similar properties based on a property ID
   */
  async getSimilarProperties(
    propertyId: string,
    limit: number = 5,
    excludeIds: string[] = [],
  ): Promise<any[]> {
    try {
      const url = `${this.flaskBaseUrl}/api/recommend/property/${propertyId}`;
      const params = {
        limit: limit.toString(),
        exclude: excludeIds.join(','),
      };

      this.logger.debug(`Calling Flask: GET ${url}`, params);

      const response = await firstValueFrom(
        this.httpService.get<FlaskRecommendationResponse>(url, {
          params,
          timeout: this.timeout,
        }),
      );

      if (!response.data.success) {
        throw new Error(response.data.error || 'Flask ML service returned error');
      }

      this.logger.log(
        `Retrieved ${response.data.data.recommendations.length} similar properties from Flask`,
      );

      return response.data.data.recommendations;
    } catch (error) {
      return this.handleFlaskError(error, 'getSimilarProperties');
    }
  }

  /**
   * Get personalized recommendations for a user
   */
  async getPersonalizedRecommendations(
    userId: string,
    limit: number = 5,
    excludeIds: string[] = [],
    propertyType?: string,
  ): Promise<any[]> {
    try {
      const url = `${this.flaskBaseUrl}/api/recommend/user/${userId}`;
      const params: any = {
        limit: limit.toString(),
        exclude: excludeIds.join(','),
      };

      if (propertyType) {
        params.property_type = propertyType;
      }

      this.logger.debug(`Calling Flask: GET ${url}`, params);

      const response = await firstValueFrom(
        this.httpService.get<FlaskRecommendationResponse>(url, {
          params,
          timeout: this.timeout,
        }),
      );

      if (!response.data.success) {
        throw new Error(response.data.error || 'Flask ML service returned error');
      }

      this.logger.log(
        `Retrieved ${response.data.data.recommendations.length} personalized recommendations from Flask`,
      );

      return response.data.data.recommendations;
    } catch (error) {
      return this.handleFlaskError(error, 'getPersonalizedRecommendations');
    }
  }

  /**
   * Train the Flask ML model with new data
   */
  async trainModel(
    properties: any[],
    userInteractions: any[] = [],
  ): Promise<{ success: boolean; message: string }> {
    try {
      const url = `${this.flaskBaseUrl}/api/train`;
      
      // Transform properties to Flask format
      const transformedProperties = this.transformPropertiesToFlaskFormat(properties);
      
      // Transform user interactions to Flask format
      const transformedInteractions = this.transformInteractionsToFlaskFormat(userInteractions);

      this.logger.debug(`Training Flask model with ${transformedProperties.length} properties`);

      const response = await firstValueFrom(
        this.httpService.post<FlaskRecommendationResponse>(
          url,
          {
            properties: transformedProperties,
            user_interactions: transformedInteractions,
          },
          {
            timeout: 60000, // 60 seconds for training
          },
        ),
      );

      if (!response.data.success) {
        throw new Error(response.data.error || 'Training failed');
      }

      this.logger.log('Flask model trained successfully');

      return {
        success: true,
        message: 'Model trained successfully',
      };
    } catch (error) {
      this.logger.error('Error training Flask model:', error);
      throw new HttpException(
        'Failed to train ML model',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Check if Flask service is healthy
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.flaskBaseUrl}/health`, {
          timeout: 5000,
        }),
      );
      return response.status === 200;
    } catch (error) {
      this.logger.warn('Flask service health check failed:', error.message);
      return false;
    }
  }

  /**
   * Transform NestJS properties to Flask format
   */
  private transformPropertiesToFlaskFormat(properties: any[]): any[] {
  return properties.map(property => ({
    _id:          property._id?.toString() || property.id?.toString(),
    title:        property.title,                          // ← add
    type:         property.type,
    listingType:  property.listingType,                   // ← add
    availability: property.availability,                  // ← add
    description:  property.description || '',
    amenities:    property.amenities || {},               // ← send object, not array
    price:        property.price,
    city:         property.city,
    area:         property.area,
    isActive:     property.isActive,                      // ← add
    averageRating: property.averageRating || 0,
    reviewCount:  property.reviewCount || 0,
    viewsCount:   property.viewsCount || 0,               // ← add (for prewarm sort)
  }));
}

  /**
   * Extract amenities as array of strings
   */
  private extractAmenitiesArray(amenities: any): string[] {
    if (!amenities) return [];
    
    const amenityList: string[] = [];
    
    // Handle amenities object
    if (typeof amenities === 'object') {
      Object.entries(amenities).forEach(([key, value]) => {
        if (value === true || (typeof value === 'number' && value > 0)) {
          amenityList.push(key);
        }
      });
    }
    
    return amenityList;
  }

  /**
   * Transform user interactions to Flask format
   */
  private transformInteractionsToFlaskFormat(interactions: any[]): any[] {
    return interactions.map(interaction => ({
      user_id: interaction.userId?.toString(),
      property_id: interaction.propertyId?.toString(),
      interaction_type: interaction.interactionType,
      timestamp: interaction.createdAt || new Date(),
      metadata: interaction.metadata || {},
    }));
  }

  /**
   * Handle Flask API errors
   */
  private handleFlaskError(error: any, operation: string): never {
    if (error.response) {
      // Flask returned an error response
      const status = error.response.status;
      const message = error.response.data?.error || error.message;
      
      this.logger.error(
        `Flask ML ${operation} failed [${status}]: ${message}`,
        error.response.data,
      );

      if (status === 503) {
        throw new HttpException(
          'ML model not initialized. Please train the model first.',
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      } else if (status === 404) {
        throw new HttpException(
          'Property or user not found in ML model',
          HttpStatus.NOT_FOUND,
        );
      } else {
        throw new HttpException(
          `ML service error: ${message}`,
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
    } else if (error.code === 'ECONNREFUSED') {
      // Flask service is not running
      this.logger.error(`Flask ML service is not reachable at ${this.flaskBaseUrl}`);
      throw new HttpException(
        'ML recommendation service is currently unavailable',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    } else {
      // Other errors
      this.logger.error(`Flask ML ${operation} error:`, error.message);
      throw new HttpException(
        'Failed to get ML recommendations',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}