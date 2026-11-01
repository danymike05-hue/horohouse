import {
  Controller,
  Get,
  Query,
  UseGuards,
  BadRequestException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';

import { AdminAnalyticsService, DateRange } from './admin-analytics.service';
import {
  AdminAnalyticsQueryDto,
  OccupancyQueryDto,
  RevenueQueryDto,
  AdminDateRangeDto,
} from './dto/admin-analytics.dto';
import { JwtAuthGuard } from '../auth/guards/jwt.auth.guard';
import { RolesGuard, Roles } from '../auth/guards/roles.guard';
import { UserRole } from '../users/schemas/user.schema';

// ─── Helper ───────────────────────────────────────────────────────────────────

function parseDateRange(startDate?: string, endDate?: string): DateRange {
  const end   = endDate   ? new Date(endDate)   : new Date();
  const start = startDate
    ? new Date(startDate)
    : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

  if (isNaN(start.getTime())) throw new BadRequestException('Invalid startDate');
  if (isNaN(end.getTime()))   throw new BadRequestException('Invalid endDate');
  if (start > end)            throw new BadRequestException('startDate must be before endDate');

  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  return { startDate: start, endDate: end };
}

// ─────────────────────────────────────────────────────────────────────────────

@ApiTags('Admin Analytics')
@ApiBearerAuth()
@Controller('analytics/admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminAnalyticsController {
  constructor(private readonly adminAnalyticsService: AdminAnalyticsService) {}

  // ════════════════════════════════════════════════════════════════════════════
  // FULL DASHBOARD
  // ════════════════════════════════════════════════════════════════════════════

  /**
   * GET /analytics/admin/dashboard
   * One-call endpoint for the admin dashboard page.
   * Returns KPIs, revenue chart, occupancy chart, breakdowns, leaderboards.
   */
  @Get('dashboard')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Admin dashboard — full analytics snapshot',
    description:
      'Returns all sections of the admin dashboard in a single call: ' +
      'platform KPIs, revenue over time, occupancy over time, status breakdown, ' +
      'property type breakdown, top properties, city performance, host leaderboard.',
  })
  @ApiQuery({ name: 'startDate',    required: false, type: String, description: 'ISO date (default: 30 days ago)' })
  @ApiQuery({ name: 'endDate',      required: false, type: String, description: 'ISO date (default: today)' })
  @ApiQuery({ name: 'granularity',  required: false, enum: ['day', 'week', 'month'], description: 'Chart granularity (default: month)' })
  @ApiResponse({ status: 200, description: 'Full dashboard analytics' })
  @ApiResponse({ status: 403, description: 'Admin only' })
  async getDashboard(@Query() query: AdminAnalyticsQueryDto) {
    const dateRange   = parseDateRange(query.startDate, query.endDate);
    const granularity = query.granularity ?? 'month';
    return this.adminAnalyticsService.getAdminDashboard(dateRange, granularity);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // KPIs
  // ════════════════════════════════════════════════════════════════════════════

  /**
   * GET /analytics/admin/kpis
   * Lightweight endpoint for the top-of-page stat cards.
   */
  @Get('kpis')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Platform KPIs',
    description:
      'Total bookings, revenue, cancellation rate, occupancy rate, ' +
      'new guests, average booking value, review completion rate, etc.',
  })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate',   required: false, type: String })
  @ApiResponse({ status: 200, description: 'Platform KPI object' })
  async getKPIs(@Query() query: AdminDateRangeDto) {
    const dateRange = parseDateRange(query.startDate, query.endDate);
    return this.adminAnalyticsService.getPlatformKPIs(dateRange);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // REVENUE
  // ════════════════════════════════════════════════════════════════════════════

  /**
   * GET /analytics/admin/revenue
   * Time-series revenue chart with optional host/property-type filters.
   */
  @Get('revenue')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Revenue over time',
    description:
      'Gross revenue and platform fees per period bucket. ' +
      'Optionally filtered by hostId or property type.',
  })
  @ApiQuery({ name: 'startDate',    required: false, type: String })
  @ApiQuery({ name: 'endDate',      required: false, type: String })
  @ApiQuery({ name: 'granularity',  required: false, enum: ['day', 'week', 'month'] })
  @ApiQuery({ name: 'hostId',       required: false, type: String, description: 'Filter by host user ID' })
  @ApiQuery({ name: 'propertyType', required: false, type: String, description: 'Filter by property type slug' })
  @ApiResponse({ status: 200, description: 'Array of RevenueDataPoint' })
  async getRevenue(@Query() query: RevenueQueryDto) {
    const dateRange = parseDateRange(query.startDate, query.endDate);
    return this.adminAnalyticsService.getRevenueOverTime(
      dateRange,
      query.granularity ?? 'month',
      { hostId: query.hostId, propertyType: query.propertyType },
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // OCCUPANCY
  // ════════════════════════════════════════════════════════════════════════════

  /**
   * GET /analytics/admin/occupancy
   * Occupancy rate per period with optional property/city filters.
   */
  @Get('occupancy')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Occupancy rate over time',
    description:
      'Nights booked vs available per period. ' +
      'Only counts short-term listings. ' +
      'Optionally filtered by propertyId or city.',
  })
  @ApiQuery({ name: 'startDate',   required: false, type: String })
  @ApiQuery({ name: 'endDate',     required: false, type: String })
  @ApiQuery({ name: 'granularity', required: false, enum: ['day', 'week', 'month'] })
  @ApiQuery({ name: 'propertyId',  required: false, type: String })
  @ApiQuery({ name: 'city',        required: false, type: String })
  @ApiResponse({ status: 200, description: 'Array of OccupancyDataPoint' })
  async getOccupancy(@Query() query: OccupancyQueryDto) {
    const dateRange = parseDateRange(query.startDate, query.endDate);
    return this.adminAnalyticsService.getOccupancyOverTime(
      dateRange,
      query.granularity ?? 'month',
      { propertyId: query.propertyId, city: query.city },
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // BREAKDOWNS
  // ════════════════════════════════════════════════════════════════════════════

  /**
   * GET /analytics/admin/breakdown/status
   */
  @Get('breakdown/status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Booking status breakdown (confirmed, cancelled, completed, etc.)' })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate',   required: false, type: String })
  @ApiResponse({ status: 200, description: 'Array of BookingStatusBreakdown' })
  async getStatusBreakdown(@Query() query: AdminDateRangeDto) {
    const dateRange = parseDateRange(query.startDate, query.endDate);
    return this.adminAnalyticsService.getBookingStatusBreakdown(dateRange);
  }

  /**
   * GET /analytics/admin/breakdown/property-type
   */
  @Get('breakdown/property-type')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Bookings and revenue broken down by property type' })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate',   required: false, type: String })
  @ApiResponse({ status: 200, description: 'Array of PropertyTypeBreakdown' })
  async getPropertyTypeBreakdown(@Query() query: AdminDateRangeDto) {
    const dateRange = parseDateRange(query.startDate, query.endDate);
    return this.adminAnalyticsService.getPropertyTypeBreakdown(dateRange);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // LEADERBOARDS
  // ════════════════════════════════════════════════════════════════════════════

  /**
   * GET /analytics/admin/top-properties
   */
  @Get('top-properties')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Top properties by revenue in the period' })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate',   required: false, type: String })
  @ApiQuery({ name: 'limit',     required: false, type: Number, description: 'Max results (default 10)' })
  @ApiResponse({ status: 200, description: 'Array of TopProperty' })
  async getTopProperties(
    @Query() query: AdminDateRangeDto & { limit?: string },
  ) {
    const dateRange = parseDateRange(query.startDate, query.endDate);
    const limit     = query.limit ? parseInt(query.limit, 10) : 10;
    return this.adminAnalyticsService.getTopProperties(dateRange, limit);
  }

  /**
   * GET /analytics/admin/city-performance
   */
  @Get('city-performance')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Booking volume and revenue by city' })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate',   required: false, type: String })
  @ApiQuery({ name: 'limit',     required: false, type: Number, description: 'Max cities (default 10)' })
  @ApiResponse({ status: 200, description: 'Array of CityPerformance' })
  async getCityPerformance(
    @Query() query: AdminDateRangeDto & { limit?: string },
  ) {
    const dateRange = parseDateRange(query.startDate, query.endDate);
    const limit     = query.limit ? parseInt(query.limit, 10) : 10;
    return this.adminAnalyticsService.getCityPerformance(dateRange, limit);
  }

  /**
   * GET /analytics/admin/host-leaderboard
   */
  @Get('host-leaderboard')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Top hosts by revenue with booking count and rating' })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate',   required: false, type: String })
  @ApiQuery({ name: 'limit',     required: false, type: Number, description: 'Max hosts (default 10)' })
  @ApiResponse({ status: 200, description: 'Array of HostLeaderboard' })
  async getHostLeaderboard(
    @Query() query: AdminDateRangeDto & { limit?: string },
  ) {
    const dateRange = parseDateRange(query.startDate, query.endDate);
    const limit     = query.limit ? parseInt(query.limit, 10) : 10;
    return this.adminAnalyticsService.getHostLeaderboard(dateRange, limit);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // COMPARISON
  // ════════════════════════════════════════════════════════════════════════════

  /**
   * GET /analytics/admin/comparison
   * Returns current period KPIs vs the equivalent previous period,
   * with a diff/percent-change for each metric.
   */
  @Get('comparison')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'KPI comparison — current period vs previous period',
    description:
      'Automatically calculates the previous period of equal length. ' +
      'Returns current, previous, and a per-metric diff object with trend direction.',
  })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate',   required: false, type: String })
  @ApiResponse({ status: 200, description: 'KPI comparison object' })
  async getComparison(@Query() query: AdminDateRangeDto) {
    const dateRange = parseDateRange(query.startDate, query.endDate);
    return this.adminAnalyticsService.getKPIComparison(dateRange);
  }
}