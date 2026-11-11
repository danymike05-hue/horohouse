import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Param,
  Req,
  UnauthorizedException,
  UseGuards
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';

import { HistoryService, LogActivityDto } from './history.service';
import { UserRole } from '../users/schemas/user.schema';
import { Roles } from '../auth/guards/roles.guard';
import { Public } from '../auth/guards/roles.guard';
import { JwtAuthGuard } from '../auth/guards/jwt.auth.guard';

@ApiTags('History')
@ApiBearerAuth('JWT-auth')
@Controller('history')
@UseGuards(JwtAuthGuard)
export class HistoryController {
  constructor(private readonly historyService: HistoryService) { }

  @Post('activity')
  @ApiOperation({ summary: 'Log user activity' })
  async logActivity(
    @Body() activityData: LogActivityDto,
    @Req() req: any,
  ) {

    if (!activityData.userId && req.user) {
      activityData.userId = req.user.id;
    }
    return this.historyService.logActivity(activityData);
  }

  @Get('popular-cities')
  @Public()
  @ApiOperation({ summary: 'Get popular cities based on user activity' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Number of cities to return' })
  @ApiQuery({ name: 'timeframe', required: false, type: Number, description: 'Timeframe in days' })
  @ApiResponse({ status: 200, description: 'Popular cities retrieved successfully' })
  async getPopularCities(
    @Query('limit') limit?: number,
    @Query('timeframe') timeframe?: number,
  ) {
    return this.historyService.getPopularCities(
      limit ? parseInt(limit.toString()) : 10,
      timeframe ? parseInt(timeframe.toString()) : 30,
    );
  }

  @Get('most-viewed-properties')
  @Public()
  @ApiOperation({ summary: 'Get most viewed properties' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'timeframe', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Most viewed properties retrieved successfully' })
  async getMostViewedProperties(
    @Query('limit') limit?: number,
    @Query('timeframe') timeframe?: number,
  ) {
    return this.historyService.getMostViewedProperties(
      limit ? parseInt(limit.toString()) : 10,
      timeframe ? parseInt(timeframe.toString()) : 30,
    );
  }

  @Get('search-trends')
  @Roles(UserRole.ADMIN, UserRole.AGENT)
  @ApiOperation({ summary: 'Get search trends and popular queries' })
  @ApiQuery({ name: 'timeframe', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Search trends retrieved successfully' })
  async getSearchTrends(
    @Query('timeframe') timeframe?: number,
    @Query('limit') limit?: number,
  ) {
    return this.historyService.getSearchTrends(
      timeframe ? parseInt(timeframe.toString()) : 7,
      limit ? parseInt(limit.toString()) : 20,
    );
  }

  @Get('user/:userId/activity')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get user activity summary (Admin only)' })
  @ApiQuery({ name: 'timeframe', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'User activity retrieved successfully' })
  async getUserActivity(
    @Param('userId') userId: string,
    @Query('timeframe') timeframe?: number,
  ) {
    return this.historyService.getUserActivity(
      userId,
      timeframe ? parseInt(timeframe.toString()) : 30,
    );
  }

  @Get('me/activity')
  @ApiOperation({ summary: 'Get current user activity summary' })
  @ApiQuery({ name: 'timeframe', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'User activity retrieved successfully' })
  async getMyActivity(
    @Req() req: any,
    @Query('timeframe') timeframe?: number,
  ) {
    // Add proper error handling for missing user
    if (!req.user || !req.user.id) {
      throw new UnauthorizedException('User not authenticated');
    }

    return this.historyService.getUserActivity(
      req.user.id,
      timeframe ? parseInt(timeframe.toString()) : 30,
    );
  }

  @Get('property/:propertyId/analytics')
  @Roles(UserRole.ADMIN, UserRole.AGENT)
  @ApiOperation({ summary: 'Get property analytics' })
  @ApiQuery({ name: 'timeframe', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Property analytics retrieved successfully' })
  async getPropertyAnalytics(
    @Param('propertyId') propertyId: string,
    @Query('timeframe') timeframe?: number,
  ) {
    return this.historyService.getPropertyAnalytics(
      propertyId,
      timeframe ? parseInt(timeframe.toString()) : 30,
    );
  }

  @Get('agent/:agentId/analytics')
  @Roles(UserRole.ADMIN, UserRole.AGENT)
  @ApiOperation({ summary: 'Get agent performance analytics' })
  @ApiQuery({ name: 'timeframe', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Agent analytics retrieved successfully' })
  async getAgentAnalytics(
    @Param('agentId') agentId: string,
    @Query('timeframe') timeframe?: number,
  ) {
    return this.historyService.getAgentAnalytics(
      agentId,
      timeframe ? parseInt(timeframe.toString()) : 30,
    );
  }

  @Get('dashboard')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get dashboard statistics (Admin only)' })
  @ApiQuery({ name: 'timeframe', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Dashboard statistics retrieved successfully' })
  async getDashboardStats(
    @Query('timeframe') timeframe?: number,
  ) {
    return this.historyService.getDashboardStats(
      timeframe ? parseInt(timeframe.toString()) : 30,
    );
  }

  @Get('all-activities')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get all history records with filtering and pagination (Admin only)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'activityType', required: false, type: String })
  @ApiQuery({ name: 'userId', required: false, type: String })
  @ApiQuery({ name: 'city', required: false, type: String })
  @ApiQuery({ name: 'ipAddress', required: false, type: String })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  @ApiResponse({ status: 200, description: 'History records retrieved successfully' })
  async getAllHistory(@Query() query: any) {
    return this.historyService.getAllHistory(query);
  }
}