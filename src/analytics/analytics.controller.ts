import {
  Controller,
  Get,
  Query,
  UseGuards,
  Request,
  BadRequestException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AnalyticsService, DateRange } from './analytics.service';
import { JwtAuthGuard } from '../auth/guards/jwt.auth.guard';

@Controller('analytics')
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  /**
   * Get analytics dashboard data
   * Query params:
   *  - startDate: ISO date string (default: 30 days ago)
   *  - endDate: ISO date string (default: today)
   */
  @Get('dashboard')
  @HttpCode(HttpStatus.OK)
  async getDashboard(
    @Request() req,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const userId = req.user.userId || req.user.id;

    // Parse and validate date range
    const dateRange = this.parseDateRange(startDate, endDate);

    return this.analyticsService.getAnalytics(userId, dateRange);
  }

  /**
   * Get engagement metrics over time
   */
  @Get('engagement')
  @HttpCode(HttpStatus.OK)
  async getEngagement(
    @Request() req,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('granularity') granularity: 'day' | 'week' | 'month' = 'day',
  ) {
    const userId = req.user.userId || req.user.id;
    const dateRange = this.parseDateRange(startDate, endDate);

    // Return engagement data
    const analytics = await this.analyticsService.getAnalytics(userId, dateRange);
    return {
      engagementOverTime: analytics.engagementOverTime,
      granularity,
    };
  }

  /**
   * Get quick stats/KPIs
   */
  @Get('kpis')
  @HttpCode(HttpStatus.OK)
  async getKPIs(
    @Request() req,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const userId = req.user.userId || req.user.id;
    const dateRange = this.parseDateRange(startDate, endDate);

    const analytics = await this.analyticsService.getAnalytics(userId, dateRange);
    return analytics.kpis;
  }

  /**
   * Export analytics data
   */
  @Get('export')
  @HttpCode(HttpStatus.OK)
  async exportData(
    @Request() req,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('format') format: 'csv' | 'json' = 'json',
  ) {
    const userId = req.user.userId || req.user.id;
    const dateRange = this.parseDateRange(startDate, endDate);

    return this.analyticsService.exportAnalytics(userId, dateRange, format);
  }

  /**
   * Get comparison data (current period vs previous period)
   */
  @Get('comparison')
  @HttpCode(HttpStatus.OK)
  async getComparison(
    @Request() req,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const userId = req.user.userId || req.user.id;
    const dateRange = this.parseDateRange(startDate, endDate);

    // Calculate previous period
    const periodLength = dateRange.endDate.getTime() - dateRange.startDate.getTime();
    const previousPeriodEnd = new Date(dateRange.startDate.getTime() - 1);
    const previousPeriodStart = new Date(previousPeriodEnd.getTime() - periodLength);

    const [currentPeriod, previousPeriod] = await Promise.all([
      this.analyticsService.getAnalytics(userId, dateRange),
      this.analyticsService.getAnalytics(userId, {
        startDate: previousPeriodStart,
        endDate: previousPeriodEnd,
      }),
    ]);

    return {
      current: currentPeriod,
      previous: previousPeriod,
      comparison: this.calculateComparison(currentPeriod.kpis, previousPeriod.kpis),
    };
  }

  /**
   * Helper: Parse and validate date range
   */
  private parseDateRange(startDate?: string, endDate?: string): DateRange {
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate
      ? new Date(startDate)
      : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days ago

    // Validate dates
    if (isNaN(start.getTime())) {
      throw new BadRequestException('Invalid startDate format');
    }
    if (isNaN(end.getTime())) {
      throw new BadRequestException('Invalid endDate format');
    }
    if (start > end) {
      throw new BadRequestException('startDate must be before endDate');
    }

    // Set to start/end of day
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    return { startDate: start, endDate: end };
  }

  /**
   * Helper: Calculate percentage comparison between periods
   */
  private calculateComparison(current: any, previous: any) {
    const comparison: any = {};

    for (const key in current) {
      if (typeof current[key] === 'number' && typeof previous[key] === 'number') {
        const currentValue = current[key];
        const previousValue = previous[key];
        const change = currentValue - previousValue;
        const percentChange =
          previousValue !== 0
            ? Math.round((change / previousValue) * 100)
            : currentValue > 0
            ? 100
            : 0;

        comparison[key] = {
          current: currentValue,
          previous: previousValue,
          change,
          percentChange,
          trend: change > 0 ? 'up' : change < 0 ? 'down' : 'stable',
        };
      }
    }

    return comparison;
  }
}