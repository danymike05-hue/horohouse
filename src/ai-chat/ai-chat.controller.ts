import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  UseGuards,
  Request,
  HttpStatus,
  HttpCode,
  Param,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/jwt.auth.guard';
import { AiChatService, ChatRequest, ChatResponse } from './ai-chat.service';

@ApiTags('AI Chat')
@Controller('ai-chat')
export class AiChatController {
  private readonly logger = new Logger(AiChatController.name);

  constructor(private readonly aiChatService: AiChatService) {}

  @Post('chat')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Send chat message and get AI response with property recommendations',
    description: 'Enhanced NLP with context memory, lead scoring, and spell correction'
  })
  @ApiResponse({
    status: 200,
    description: 'Chat response with properties and filters',
    schema: {
      example: {
        message: 'Parfait! Je recherche des appartements avec 3 chambres à Douala...',
        properties: [],
        filters: {
          propertyType: 'apartment',
          bedrooms: 3,
          city: 'Douala',
        },
        hasFilters: true,
        language: 'fr',
        suggestions: ['Avec piscine', 'Immeuble sécurisé', 'Proche des écoles'],
        leadScore: {
          score: 65,
          classification: 'warm',
          priority: 'medium',
          signals: ['has_budget', 'specific_location'],
          nextAction: 'Send curated property list',
        },
        contextSummary: 'Based on our conversation, you are focused on Douala and interested in apartments.',
        conversationType: 'search',
        confidence: 0.95,
        method: 'custom_nlp_enhanced',
        timestamp: '2024-01-15T10:30:00Z',
      },
    },
  })
  async chat(@Body() chatRequest: ChatRequest, @Request() req): Promise<ChatResponse> {
    try {
      // Get user from request if authenticated
      const user = req.user;

      // If user is authenticated, use their ID
      if (user && !chatRequest.userId) {
        chatRequest.userId = user.userId;
      }

      this.logger.log(`Chat request from user: ${chatRequest.userId || 'guest'}`);

      const response = await this.aiChatService.processChat(chatRequest, user);

      return response;
    } catch (error) {
      this.logger.error('Error in chat endpoint:', error);
      throw error;
    }
  }

  @Post('chat/guest')
@HttpCode(HttpStatus.OK)
@ApiOperation({ 
  summary: 'Send chat message as guest (no authentication required)',
  description: 'Process chat without requiring user authentication'
})
@ApiResponse({
  status: 200,
  description: 'Chat response with properties and filters',
})
async chatGuest(@Body() chatRequest: ChatRequest): Promise<ChatResponse> {
  try {
    this.logger.log(`Guest chat request from session: ${chatRequest.sessionId || 'new'}`);

    // Process chat without user authentication
    const response = await this.aiChatService.processChat(chatRequest, undefined);

    return response;
  } catch (error) {
    this.logger.error('Error in guest chat endpoint:', error);
    throw error;
  }
}

  @Post('refine')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Refine existing search based on feedback',
    description: 'Update search filters based on natural language feedback'
  })
  @ApiResponse({
    status: 200,
    description: 'Refined search results',
  })
  async refineSearch(
    @Body()
    body: {
      message: string;
      currentFilters: any;
      conversationHistory?: any[];
    },
    @Request() req,
  ): Promise<ChatResponse> {
    try {
      const user = req.user;
      const userId = user?.userId;

      return await this.aiChatService.refineSearch(
        body.message,
        body.currentFilters,
        userId,
        body.conversationHistory,
        user,
      );
    } catch (error) {
      this.logger.error('Error refining search:', error);
      throw error;
    }
  }

  @Get('recommendations')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ 
    summary: 'Get personalized property recommendations',
    description: 'Based on chat history and user interactions'
  })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({
    status: 200,
    description: 'Personalized property recommendations',
  })
  async getRecommendations(@Request() req, @Query('limit') limit?: number) {
    try {
      const userId = req.user.userId;
      const propertyLimit = limit ? parseInt(limit as any) : 6;

      const recommendations = await this.aiChatService.getPersonalizedRecommendations(
        userId,
        propertyLimit,
      );

      return {
        success: true,
        properties: recommendations,
        count: recommendations.length,
      };
    } catch (error) {
      this.logger.error('Error getting recommendations:', error);
      throw error;
    }
  }

  @Get('session/:sessionId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ 
    summary: 'Get chat session',
    description: 'Retrieve chat history and session data including lead score'
  })
  @ApiResponse({
    status: 200,
    description: 'Chat session data',
  })
  async getSession(@Param('sessionId') sessionId: string) {
    try {
      const session = await this.aiChatService.getSession(sessionId);

      if (!session) {
        return {
          success: false,
          message: 'Session not found',
        };
      }

      return {
        success: true,
        session,
      };
    } catch (error) {
      this.logger.error('Error getting session:', error);
      throw error;
    }
  }

  @Get('lead-score/:userId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ 
    summary: 'Get lead score for user',
    description: 'Retrieve current lead qualification score and signals'
  })
  @ApiResponse({
    status: 200,
    description: 'Lead score data',
    schema: {
      example: {
        success: true,
        leadScore: {
          score: 85,
          classification: 'hot',
          priority: 'high',
          signals: ['has_budget', 'specific_location', 'asked_viewing'],
          nextAction: 'Schedule viewing ASAP',
        },
      },
    },
  })
  async getLeadScore(@Param('userId') userId: string) {
    try {
      const leadScore = await this.aiChatService.getLeadScore(userId);

      return {
        success: true,
        leadScore,
      };
    } catch (error) {
      this.logger.error('Error getting lead score:', error);
      throw error;
    }
  }

  @Get('hot-leads')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ 
    summary: 'Get hot leads for sales team',
    description: 'Retrieve list of high-priority leads (score >= 70)'
  })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({
    status: 200,
    description: 'List of hot leads',
    schema: {
      example: {
        success: true,
        hotLeads: [
          {
            userId: '507f1f77bcf86cd799439011',
            user: {
              name: 'John Doe',
              email: 'john@example.com',
              phoneNumber: '+237670000000',
            },
            leadScore: {
              score: 85,
              classification: 'hot',
              priority: 'high',
              signals: ['has_budget', 'asked_viewing'],
              nextAction: 'Schedule viewing ASAP',
            },
            currentFilters: {
              propertyType: 'apartment',
              city: 'Douala',
              bedrooms: 3,
            },
            lastActive: '2024-01-15T10:30:00Z',
          },
        ],
        count: 1,
      },
    },
  })
  async getHotLeads(@Query('limit') limit?: number) {
    try {
      const leadLimit = limit ? parseInt(limit as any) : 20;
      const hotLeads = await this.aiChatService.getHotLeads(leadLimit);

      return {
        success: true,
        hotLeads,
        count: hotLeads.length,
      };
    } catch (error) {
      this.logger.error('Error getting hot leads:', error);
      throw error;
    }
  }

  @Get('stats')
  @ApiOperation({ 
    summary: 'Get chat statistics',
    description: 'Analytics including active sessions, messages, and lead distribution'
  })
  @ApiResponse({
    status: 200,
    description: 'Chat statistics and analytics',
    schema: {
      example: {
        success: true,
        stats: {
          activeSessions: 45,
          totalMessages: 1234,
          flaskServiceHealthy: true,
          leadDistribution: {
            hot: 5,
            warm: 15,
            cold: 25,
          },
          hotLeads: 5,
          warmLeads: 15,
          coldLeads: 25,
        },
      },
    },
  })
  async getStats() {
    try {
      const stats = await this.aiChatService.getChatStats();

      return {
        success: true,
        stats,
      };
    } catch (error) {
      this.logger.error('Error getting stats:', error);
      throw error;
    }
  }

  @Post('cleanup')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Cleanup old sessions (admin only)',
    description: 'Remove sessions older than 24 hours'
  })
  @ApiResponse({
    status: 200,
    description: 'Cleanup completed',
  })
  async cleanupSessions() {
    try {
      await this.aiChatService.cleanupOldSessions();

      return {
        success: true,
        message: 'Old sessions cleaned up successfully',
      };
    } catch (error) {
      this.logger.error('Error cleaning up sessions:', error);
      throw error;
    }
  }
}