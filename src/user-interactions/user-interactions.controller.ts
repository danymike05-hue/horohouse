import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Param,
  UseGuards,
  Request,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt.auth.guard';
import { UserInteractionsService, CreateInteractionDto, InteractionQuery } from './user-interactions.service';
import { InteractionType, InteractionSource } from './schemas/user-interaction.schema';
import { User } from '../users/schemas/user.schema';

@ApiTags('user-interactions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('user-interactions')
export class UserInteractionsController {
  private readonly logger = new Logger(UserInteractionsController.name);

  constructor(private readonly userInteractionsService: UserInteractionsService) {}

  @Post()
  @ApiOperation({ summary: 'Track a user interaction' })
  @ApiResponse({ status: 201, description: 'Interaction tracked successfully.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  async trackInteraction(
    @Body() createInteractionDto: CreateInteractionDto,
    @Request() req: { user: User },
  ) {
    try {
      // Ensure the interaction is for the authenticated user
      if (createInteractionDto.userId.toString() !== req.user._id.toString()) {
        throw new BadRequestException('You can only track interactions for yourself');
      }

      const interaction = await this.userInteractionsService.trackInteraction(createInteractionDto);
      
      return {
        success: true,
        message: 'Interaction tracked successfully',
        data: interaction,
      };
    } catch (error) {
      this.logger.error('Error tracking interaction:', error);
      throw error;
    }
  }

  @Post('bulk')
  @ApiOperation({ summary: 'Track multiple user interactions in bulk' })
  @ApiResponse({ status: 201, description: 'Interactions tracked successfully.' })
  async trackBulkInteractions(
    @Body() body: { interactions: CreateInteractionDto[] },
    @Request() req: { user: User },
  ) {
    try {
      // Ensure all interactions are for the authenticated user
      const userId = req.user._id.toString();
      for (const interaction of body.interactions) {
        if (interaction.userId.toString() !== userId) {
          throw new BadRequestException('You can only track interactions for yourself');
        }
      }

      const interactions = await this.userInteractionsService.trackBulkInteractions(body.interactions);
      
      return {
        success: true,
        message: `${interactions.length} interactions tracked successfully`,
        data: interactions,
      };
    } catch (error) {
      this.logger.error('Error tracking bulk interactions:', error);
      throw error;
    }
  }

  @Get()
  @ApiOperation({ summary: 'Get user interactions with filtering' })
  @ApiResponse({ status: 200, description: 'Interactions retrieved successfully.' })
  async getUserInteractions(
    @Query() query: InteractionQuery,
    @Request() req: { user: User },
  ) {
    try {
      // Ensure user can only view their own interactions
      if (query.userId && query.userId.toString() !== req.user._id.toString()) {
        throw new BadRequestException('You can only view your own interactions');
      }

      const interactions = await this.userInteractionsService.getUserInteractions({
        ...query,
        userId: query.userId || req.user._id,
      });
      
      return {
        success: true,
        data: interactions,
        count: interactions.length,
      };
    } catch (error) {
      this.logger.error('Error getting user interactions:', error);
      throw error;
    }
  }

  @Get('profile')
  @ApiOperation({ summary: 'Get user recommendation profile' })
  @ApiResponse({ status: 200, description: 'Recommendation profile retrieved successfully.' })
  async getRecommendationProfile(@Request() req: { user: User }) {
    try {
      const profile = await this.userInteractionsService.getUserRecommendationProfile(req.user._id);
      
      return {
        success: true,
        data: profile,
      };
    } catch (error) {
      this.logger.error('Error getting recommendation profile:', error);
      throw error;
    }
  }

  @Get('similar-users')
  @ApiOperation({ summary: 'Get similar users based on interaction patterns' })
  @ApiResponse({ status: 200, description: 'Similar users retrieved successfully.' })
  async getSimilarUsers(
    @Query('limit') limit: string,
    @Request() req: { user: User },
  ) {
    try {
      const similarUsers = await this.userInteractionsService.getSimilarUsers(
        req.user._id,
        limit ? parseInt(limit) : 10,
      );
      
      return {
        success: true,
        data: similarUsers,
        count: similarUsers.length,
      };
    } catch (error) {
      this.logger.error('Error getting similar users:', error);
      throw error;
    }
  }

  @Get('recommendations')
  @ApiOperation({ summary: 'Get recommended properties based on user interactions' })
  @ApiResponse({ status: 200, description: 'Recommended properties retrieved successfully.' })
  async getRecommendedProperties(
    @Query('limit') limit: string,
    @Query('excludePropertyIds') excludePropertyIds: string,
    @Request() req: { user: User },
  ) {
    try {
      const excludeIds = excludePropertyIds ? excludePropertyIds.split(',') : undefined;
      const recommendations = await this.userInteractionsService.getRecommendedProperties(
        req.user._id,
        limit ? parseInt(limit) : 20,
        excludeIds,
      );
      
      return {
        success: true,
        data: recommendations,
        count: recommendations.length,
      };
    } catch (error) {
      this.logger.error('Error getting recommended properties:', error);
      throw error;
    }
  }

  @Post('track-property-view')
  @ApiOperation({ summary: 'Track property view interaction' })
  @ApiResponse({ status: 201, description: 'Property view tracked successfully.' })
  async trackPropertyView(
    @Body() body: {
      propertyId: string;
      source?: InteractionSource;
      metadata?: any;
      propertyDetails?: {
        city?: string;
        propertyType?: string;
        price?: number;
        listingType?: string;
        bedrooms?: number;
        bathrooms?: number;
        location?: { type: 'Point'; coordinates: [number, number] };
      };
    },
    @Request() req: { user: User },
  ) {
    try {
      const interaction = await this.userInteractionsService.trackInteraction({
        userId: req.user._id,
        interactionType: InteractionType.PROPERTY_VIEW,
        propertyId: body.propertyId,
        source: body.source,
        metadata: body.metadata,
        ...body.propertyDetails,
      });
      
      return {
        success: true,
        message: 'Property view tracked successfully',
        data: interaction,
      };
    } catch (error) {
      this.logger.error('Error tracking property view:', error);
      throw error;
    }
  }

  @Post('track-property-favorite')
  @ApiOperation({ summary: 'Track property favorite interaction' })
  @ApiResponse({ status: 201, description: 'Property favorite tracked successfully.' })
  async trackPropertyFavorite(
    @Body() body: {
      propertyId: string;
      source?: InteractionSource;
      metadata?: any;
      propertyDetails?: {
        city?: string;
        propertyType?: string;
        price?: number;
        listingType?: string;
        bedrooms?: number;
        bathrooms?: number;
      };
    },
    @Request() req: { user: User },
  ) {
    try {
      const interaction = await this.userInteractionsService.trackInteraction({
        userId: req.user._id,
        interactionType: InteractionType.PROPERTY_FAVORITE,
        propertyId: body.propertyId,
        source: body.source,
        metadata: body.metadata,
        ...body.propertyDetails,
      });
      
      return {
        success: true,
        message: 'Property favorite tracked successfully',
        data: interaction,
      };
    } catch (error) {
      this.logger.error('Error tracking property favorite:', error);
      throw error;
    }
  }

  @Post('track-property-inquiry')
  @ApiOperation({ summary: 'Track property inquiry interaction' })
  @ApiResponse({ status: 201, description: 'Property inquiry tracked successfully.' })
  async trackPropertyInquiry(
    @Body() body: {
      propertyId: string;
      agentId?: string;
      source?: InteractionSource;
      metadata?: any;
      propertyDetails?: {
        city?: string;
        propertyType?: string;
        price?: number;
        listingType?: string;
        bedrooms?: number;
        bathrooms?: number;
      };
    },
    @Request() req: { user: User },
  ) {
    try {
      const interaction = await this.userInteractionsService.trackInteraction({
        userId: req.user._id,
        interactionType: InteractionType.PROPERTY_INQUIRY,
        propertyId: body.propertyId,
        agentId: body.agentId,
        source: body.source,
        metadata: body.metadata,
        ...body.propertyDetails,
      });
      
      return {
        success: true,
        message: 'Property inquiry tracked successfully',
        data: interaction,
      };
    } catch (error) {
      this.logger.error('Error tracking property inquiry:', error);
      throw error;
    }
  }

  @Post('track-search')
  @ApiOperation({ summary: 'Track search interaction' })
  @ApiResponse({ status: 201, description: 'Search tracked successfully.' })
  async trackSearch(
    @Body() body: {
      searchQuery?: string;
      searchFilters?: any;
      resultsCount?: number;
      source?: InteractionSource;
      metadata?: any;
      userLocation?: { type: 'Point'; coordinates: [number, number] };
      city?: string;
    },
    @Request() req: { user: User },
  ) {
    try {
      const interaction = await this.userInteractionsService.trackInteraction({
        userId: req.user._id,
        interactionType: InteractionType.SEARCH,
        source: body.source,
        metadata: {
          ...body.metadata,
          searchQuery: body.searchQuery,
          searchFilters: body.searchFilters,
          resultsCount: body.resultsCount,
        },
        location: body.userLocation,
        city: body.city,
      });
      
      return {
        success: true,
        message: 'Search tracked successfully',
        data: interaction,
      };
    } catch (error) {
      this.logger.error('Error tracking search:', error);
      throw error;
    }
  }

  @Post('track-recommendation-click')
  @ApiOperation({ summary: 'Track recommendation click interaction' })
  @ApiResponse({ status: 201, description: 'Recommendation click tracked successfully.' })
  async trackRecommendationClick(
    @Body() body: {
      propertyId: string;
      recommendationScore?: number;
      recommendationReason?: string;
      metadata?: any;
      propertyDetails?: {
        city?: string;
        propertyType?: string;
        price?: number;
        listingType?: string;
        bedrooms?: number;
        bathrooms?: number;
      };
    },
    @Request() req: { user: User },
  ) {
    try {
      const interaction = await this.userInteractionsService.trackInteraction({
        userId: req.user._id,
        interactionType: InteractionType.RECOMMENDATION_CLICK,
        propertyId: body.propertyId,
        source: InteractionSource.RECOMMENDATIONS,
        metadata: {
          ...body.metadata,
          recommendationScore: body.recommendationScore,
          recommendationReason: body.recommendationReason,
        },
        ...body.propertyDetails,
      });
      
      return {
        success: true,
        message: 'Recommendation click tracked successfully',
        data: interaction,
      };
    } catch (error) {
      this.logger.error('Error tracking recommendation click:', error);
      throw error;
    }
  }

  @Get('analytics/summary')
  @ApiOperation({ summary: 'Get user interaction analytics summary' })
  @ApiResponse({ status: 200, description: 'Analytics summary retrieved successfully.' })
  async getAnalyticsSummary(@Request() req: { user: User }) {
    try {
      const userId = req.user._id;
      
      // Get various interaction counts
      const [
        totalInteractions,
        propertyViews,
        favorites,
        inquiries,
        searches,
      ] = await Promise.all([
        this.userInteractionsService.getUserInteractions({ userId, limit: 1 }),
        this.userInteractionsService.getUserInteractions({ 
          userId, 
          interactionTypes: [InteractionType.PROPERTY_VIEW],
          limit: 1 
        }),
        this.userInteractionsService.getUserInteractions({ 
          userId, 
          interactionTypes: [InteractionType.PROPERTY_FAVORITE],
          limit: 1 
        }),
        this.userInteractionsService.getUserInteractions({ 
          userId, 
          interactionTypes: [InteractionType.PROPERTY_INQUIRY],
          limit: 1 
        }),
        this.userInteractionsService.getUserInteractions({ 
          userId, 
          interactionTypes: [InteractionType.SEARCH],
          limit: 1 
        }),
      ]);

      const profile = await this.userInteractionsService.getUserRecommendationProfile(userId);
      
      return {
        success: true,
        data: {
          totalInteractions: totalInteractions.length,
          propertyViews: propertyViews.length,
          favorites: favorites.length,
          inquiries: inquiries.length,
          searches: searches.length,
          topCities: profile.preferredCities.slice(0, 5),
          topPropertyTypes: profile.preferredPropertyTypes.slice(0, 5),
          priceRange: profile.priceRange,
          interactionPatterns: profile.interactionPatterns,
        },
      };
    } catch (error) {
      this.logger.error('Error getting analytics summary:', error);
      throw error;
    }
  }
}
