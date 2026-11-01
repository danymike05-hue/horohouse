import { Controller, Get, Post, Body, Query, UseGuards, Request, BadRequestException, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt.auth.guard';
import { RecommendationService, RecommendationRequest } from './recommendation.service';
import { MLSyncService } from './ml-sync.service';
import { FlaskMLService } from './flask-ml.service';
import { User } from '../users/schemas/user.schema';

@ApiTags('recommendations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('recommendations')
export class RecommendationController {
  private readonly logger = new Logger(RecommendationController.name);

  constructor(
    private readonly recommendationService: RecommendationService,
    private readonly mlSyncService: MLSyncService,
    private readonly flaskMLService: FlaskMLService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get personalized property recommendations' })
  @ApiResponse({ status: 200, description: 'Recommendations retrieved successfully.' })
  async getRecommendations(
    @Request() req: { user: User },
    @Query('algorithm') algorithm?: string,
    @Query('limit') limit?: string,
    @Query('excludePropertyIds') excludePropertyIds?: string,
    @Query('contentWeight') contentWeight?: string,
    @Query('collaborativeWeight') collaborativeWeight?: string,
    @Query('popularityWeight') popularityWeight?: string,
    @Query('minScore') minScore?: string,
    @Query('locationWeight') locationWeight?: string,
    @Query('priceWeight') priceWeight?: string,
    @Query('amenitiesWeight') amenitiesWeight?: string,
    @Query('boostRecentViews') boostRecentViews?: string,
    @Query('boostSimilarProperties') boostSimilarProperties?: string,
    @Query('preferredPropertyType') preferredPropertyType?: string,
  ) {
    try {
      const request: RecommendationRequest = {
        userId: req.user._id.toString(),
        algorithm: (algorithm as any) || 'hybrid',
        limit: limit ? parseInt(limit) : 20,
        excludePropertyIds: excludePropertyIds ? excludePropertyIds.split(',') : undefined,
        options: {
          contentWeight: contentWeight ? parseFloat(contentWeight) : undefined,
          collaborativeWeight: collaborativeWeight ? parseFloat(collaborativeWeight) : undefined,
          popularityWeight: popularityWeight ? parseFloat(popularityWeight) : undefined,
          minScore: minScore ? parseFloat(minScore) : undefined,
          locationWeight: locationWeight ? parseFloat(locationWeight) : undefined,
          priceWeight: priceWeight ? parseFloat(priceWeight) : undefined,
          amenitiesWeight: amenitiesWeight ? parseFloat(amenitiesWeight) : undefined,
          boostRecentViews: boostRecentViews === 'true',
          boostSimilarProperties: boostSimilarProperties === 'true',
          preferredPropertyType,
        },
      };

      const result = await this.recommendationService.getRecommendations(request);
      
      return {
        success: true,
        data: result.data,
      };
    } catch (error) {
      this.logger.error('Error getting recommendations:', error);
      throw error;
    }
  }

  @Get('flask-ml')
  @ApiOperation({ summary: 'Get Flask ML-powered recommendations' })
  @ApiResponse({ status: 200, description: 'ML recommendations retrieved successfully.' })
  async getFlaskMLRecommendations(
    @Request() req: { user: User },
    @Query('limit') limit?: string,
    @Query('excludePropertyIds') excludePropertyIds?: string,
    @Query('preferredPropertyType') preferredPropertyType?: string,
  ) {
    try {
      const request: RecommendationRequest = {
        userId: req.user._id.toString(),
        algorithm: 'flask-ml',
        limit: limit ? parseInt(limit) : 20,
        excludePropertyIds: excludePropertyIds ? excludePropertyIds.split(',') : undefined,
        options: {
          preferredPropertyType,
        },
      };

      const result = await this.recommendationService.getRecommendations(request);
      
      return {
        success: true,
        data: result.data,
      };
    } catch (error) {
      this.logger.error('Error getting Flask ML recommendations:', error);
      throw error;
    }
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get user recommendation statistics and profile' })
  @ApiResponse({ status: 200, description: 'Recommendation stats retrieved successfully.' })
  async getRecommendationStats(@Request() req: { user: User }) {
    try {
      const stats = await this.recommendationService.getRecommendationStats(req.user._id.toString());
      
      return {
        success: true,
        data: stats,
      };
    } catch (error) {
      this.logger.error('Error getting recommendation stats:', error);
      throw error;
    }
  }

  @Post('feedback')
  @ApiOperation({ summary: 'Submit feedback on recommendations to improve future suggestions' })
  @ApiResponse({ status: 200, description: 'Feedback submitted successfully.' })
  async submitFeedback(
    @Body() body: {
      propertyId: string;
      rating: number;
      clicked?: boolean;
      favorited?: boolean;
      inquired?: boolean;
    },
    @Request() req: { user: User },
  ) {
    try {
      if (body.rating < 1 || body.rating > 5) {
        throw new BadRequestException('Rating must be between 1 and 5');
      }

      await this.recommendationService.updateRecommendationWeights(
        req.user._id.toString(),
        body,
      );
      
      return {
        success: true,
        message: 'Feedback submitted successfully. Recommendations will improve over time.',
      };
    } catch (error) {
      this.logger.error('Error submitting feedback:', error);
      throw error;
    }
  }

  // ML Sync Endpoints

  @Post('ml/train')
  @ApiOperation({ summary: 'Manually trigger ML model training' })
  @ApiResponse({ status: 200, description: 'ML model training initiated.' })
  async trainMLModel(@Query('force') force?: string) {
    try {
      const result = await this.mlSyncService.syncAndTrainModel(force === 'true');
      
      return {
        success: result.success,
        message: result.message,
        data: result.stats,
      };
    } catch (error) {
      this.logger.error('Error training ML model:', error);
      throw error;
    }
  }

  @Get('ml/status')
  @ApiOperation({ summary: 'Get ML service status' })
  @ApiResponse({ status: 200, description: 'ML service status retrieved.' })
  async getMLStatus() {
    try {
      const syncStatus = this.mlSyncService.getStatus();
      const flaskHealthy = await this.flaskMLService.healthCheck();

      return {
        success: true,
        data: {
          flaskService: {
            healthy: flaskHealthy,
            status: flaskHealthy ? 'online' : 'offline',
          },
          sync: syncStatus,
        },
      };
    } catch (error) {
      this.logger.error('Error getting ML status:', error);
      throw error;
    }
  }

  @Get('content-based')
  @ApiOperation({ summary: 'Get content-based recommendations only' })
  @ApiResponse({ status: 200, description: 'Content-based recommendations retrieved successfully.' })
  async getContentBasedRecommendations(
    @Request() req: { user: User },
    @Query('limit') limit?: string,
    @Query('excludePropertyIds') excludePropertyIds?: string,
    @Query('minScore') minScore?: string,
    @Query('locationWeight') locationWeight?: string,
    @Query('priceWeight') priceWeight?: string,
    @Query('amenitiesWeight') amenitiesWeight?: string,
  ) {
    try {
      const request: RecommendationRequest = {
        userId: req.user._id.toString(),
        algorithm: 'content-based',
        limit: limit ? parseInt(limit) : 20,
        excludePropertyIds: excludePropertyIds ? excludePropertyIds.split(',') : undefined,
        options: {
          minScore: minScore ? parseFloat(minScore) : undefined,
          locationWeight: locationWeight ? parseFloat(locationWeight) : undefined,
          priceWeight: priceWeight ? parseFloat(priceWeight) : undefined,
          amenitiesWeight: amenitiesWeight ? parseFloat(amenitiesWeight) : undefined,
        },
      };

      const result = await this.recommendationService.getRecommendations(request);
      
      return {
        success: true,
        data: result.data,
      };
    } catch (error) {
      this.logger.error('Error getting content-based recommendations:', error);
      throw error;
    }
  }

  @Get('collaborative')
  @ApiOperation({ summary: 'Get collaborative filtering recommendations only' })
  @ApiResponse({ status: 200, description: 'Collaborative recommendations retrieved successfully.' })
  async getCollaborativeRecommendations(
    @Request() req: { user: User },
    @Query('limit') limit?: string,
    @Query('excludePropertyIds') excludePropertyIds?: string,
  ) {
    try {
      const request: RecommendationRequest = {
        userId: req.user._id.toString(),
        algorithm: 'collaborative',
        limit: limit ? parseInt(limit) : 20,
        excludePropertyIds: excludePropertyIds ? excludePropertyIds.split(',') : undefined,
      };

      const result = await this.recommendationService.getRecommendations(request);
      
      return {
        success: true,
        data: result.data,
      };
    } catch (error) {
      this.logger.error('Error getting collaborative recommendations:', error);
      throw error;
    }
  }

  @Get('popularity')
  @ApiOperation({ summary: 'Get popularity-based recommendations only' })
  @ApiResponse({ status: 200, description: 'Popularity-based recommendations retrieved successfully.' })
  async getPopularityRecommendations(
    @Request() req: { user: User },
    @Query('limit') limit?: string,
    @Query('excludePropertyIds') excludePropertyIds?: string,
  ) {
    try {
      const request: RecommendationRequest = {
        userId: req.user._id.toString(),
        algorithm: 'popularity',
        limit: limit ? parseInt(limit) : 20,
        excludePropertyIds: excludePropertyIds ? excludePropertyIds.split(',') : undefined,
      };

      const result = await this.recommendationService.getRecommendations(request);
      
      return {
        success: true,
        data: result.data,
      };
    } catch (error) {
      this.logger.error('Error getting popularity recommendations:', error);
      throw error;
    }
  }

  @Get('hybrid')
  @ApiOperation({ summary: 'Get hybrid recommendations combining all algorithms' })
  @ApiResponse({ status: 200, description: 'Hybrid recommendations retrieved successfully.' })
  async getHybridRecommendations(
    @Request() req: { user: User },
    @Query('limit') limit?: string,
    @Query('excludePropertyIds') excludePropertyIds?: string,
    @Query('contentWeight') contentWeight?: string,
    @Query('collaborativeWeight') collaborativeWeight?: string,
    @Query('popularityWeight') popularityWeight?: string,
    @Query('minScore') minScore?: string,
  ) {
    try {
      const request: RecommendationRequest = {
        userId: req.user._id.toString(),
        algorithm: 'hybrid',
        limit: limit ? parseInt(limit) : 20,
        excludePropertyIds: excludePropertyIds ? excludePropertyIds.split(',') : undefined,
        options: {
          contentWeight: contentWeight ? parseFloat(contentWeight) : 0.5,
          collaborativeWeight: collaborativeWeight ? parseFloat(collaborativeWeight) : 0.3,
          popularityWeight: popularityWeight ? parseFloat(popularityWeight) : 0.2,
          minScore: minScore ? parseFloat(minScore) : undefined,
        },
      };

      const result = await this.recommendationService.getRecommendations(request);
      
      return {
        success: true,
        data: result.data,
      };
    } catch (error) {
      this.logger.error('Error getting hybrid recommendations:', error);
      throw error;
    }
  }
}