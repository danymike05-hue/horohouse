import {
  Controller,
  Get,
  Query,
  UseGuards,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { RevenueAnalyticsService } from '../services/revenue-analytics.service';
import { JwtAuthGuard } from '../../auth/guards/jwt.auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/guards/roles.guard';
import { UserRole } from '../../users/schemas/user.schema';

@ApiTags('Revenue Analytics')
@Controller('analytics/revenue')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
export class RevenueAnalyticsController {
  constructor(
    private readonly revenueAnalyticsService: RevenueAnalyticsService,
  ) {}

  // ==========================================
  // ADMIN ONLY ENDPOINTS
  // ==========================================

  @Get('overview')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ 
    summary: 'Get comprehensive revenue analytics overview',
    description: 'Returns detailed revenue metrics including MRR, ARR, ARPU, conversion rates, and revenue breakdown by type and payment method. Admin only.',
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Revenue analytics retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        totalRevenue: { type: 'number', example: 5000000 },
        monthlyRevenue: { type: 'number', example: 450000 },
        yearlyRevenue: { type: 'number', example: 4800000 },
        todayRevenue: { type: 'number', example: 25000 },
        totalTransactions: { type: 'number', example: 1250 },
        successfulTransactions: { type: 'number', example: 1100 },
        failedTransactions: { type: 'number', example: 100 },
        pendingTransactions: { type: 'number', example: 50 },
        averageTransactionValue: { type: 'number', example: 4545.45 },
        revenueByType: {
          type: 'object',
          properties: {
            subscriptions: { type: 'number' },
            listingFees: { type: 'number' },
            boosts: { type: 'number' },
            commissions: { type: 'number' },
            digitalServices: { type: 'number' },
          },
        },
        mrr: { type: 'number', example: 125000, description: 'Monthly Recurring Revenue' },
        arr: { type: 'number', example: 1500000, description: 'Annual Recurring Revenue' },
        arpu: { type: 'number', example: 5000, description: 'Average Revenue Per User' },
        conversionRate: { type: 'number', example: 88.5, description: 'Percentage' },
        revenueGrowth: { type: 'number', example: 15.3, description: 'Month-over-month growth %' },
        paymentMethodsDistribution: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              method: { type: 'string' },
              count: { type: 'number' },
              revenue: { type: 'number' },
              percentage: { type: 'number' },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  async getRevenueOverview() {
    return this.revenueAnalyticsService.getRevenueAnalytics();
  }

  @Get('monthly-chart')
  @ApiOperation({ 
    summary: 'Get monthly revenue chart data',
    description: 'Returns revenue data for the specified number of months for chart visualization.',
  })
  @ApiQuery({ 
    name: 'months', 
    required: false, 
    type: Number, 
    description: 'Number of months to retrieve (default: 12)',
    example: 12,
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Monthly revenue data retrieved successfully',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          month: { type: 'string', example: 'Jan 2024' },
          revenue: { type: 'number', example: 450000 },
          transactions: { type: 'number', example: 95 },
          avgTransactionValue: { type: 'number', example: 4736.84 },
        },
      },
    },
  })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  async getMonthlyRevenueChart(
    @Query('months', new DefaultValuePipe(12), ParseIntPipe) months: number,
  ) {
    return this.revenueAnalyticsService.getMonthlyRevenueChart(months);
  }

  @Get('subscriptions')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ 
    summary: 'Get subscription analytics',
    description: 'Returns subscription metrics including active/expired/cancelled counts, distribution by plan, and churn rate. Admin only.',
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Subscription analytics retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        activeSubscriptions: { type: 'number', example: 250 },
        expiredSubscriptions: { type: 'number', example: 45 },
        cancelledSubscriptions: { type: 'number', example: 30 },
        subscriptionsByPlan: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              _id: { type: 'string', example: 'professional' },
              count: { type: 'number', example: 120 },
            },
          },
        },
        churnRate: { type: 'number', example: 9.23, description: 'Percentage' },
      },
    },
  })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  async getSubscriptionAnalytics() {
    return this.revenueAnalyticsService.getSubscriptionAnalytics();
  }

  @Get('boosts')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ 
    summary: 'Get listing boost analytics',
    description: 'Returns boost metrics including total/active boosts, revenue, impressions, clicks, and CTR. Admin only.',
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Boost analytics retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        totalBoosts: { type: 'number', example: 450 },
        activeBoosts: { type: 'number', example: 120 },
        boostsByType: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              _id: { type: 'string', example: 'premium' },
              count: { type: 'number', example: 75 },
            },
          },
        },
        boostRevenue: { type: 'number', example: 850000 },
        totalImpressions: { type: 'number', example: 125000 },
        totalClicks: { type: 'number', example: 8500 },
        averageCTR: { type: 'number', example: 6.8, description: 'Click-through rate %' },
      },
    },
  })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  async getBoostAnalytics() {
    return this.revenueAnalyticsService.getBoostAnalytics();
  }

  @Get('top-users')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ 
    summary: 'Get top revenue generating users',
    description: 'Returns the top users by total revenue generated. Admin only.',
  })
  @ApiQuery({ 
    name: 'limit', 
    required: false, 
    type: Number, 
    description: 'Number of top users to retrieve (default: 10)',
    example: 10,
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Top revenue users retrieved successfully',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          userId: { type: 'string', example: '507f1f77bcf86cd799439011' },
          userName: { type: 'string', example: 'John Doe' },
          userEmail: { type: 'string', example: 'john@example.com' },
          totalRevenue: { type: 'number', example: 250000 },
          transactionCount: { type: 'number', example: 25 },
        },
      },
    },
  })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  async getTopRevenueUsers(
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ) {
    return this.revenueAnalyticsService.getTopRevenueUsers(limit);
  }

  @Get('summary')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ 
    summary: 'Get consolidated analytics summary',
    description: 'Returns a consolidated view of revenue, subscriptions, and boost analytics. Admin only.',
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Analytics summary retrieved successfully',
  })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  async getAnalyticsSummary() {
    const [revenue, subscriptions, boosts] = await Promise.all([
      this.revenueAnalyticsService.getRevenueAnalytics(),
      this.revenueAnalyticsService.getSubscriptionAnalytics(),
      this.revenueAnalyticsService.getBoostAnalytics(),
    ]);

    return {
      revenue: {
        total: revenue.totalRevenue,
        monthly: revenue.monthlyRevenue,
        yearly: revenue.yearlyRevenue,
        today: revenue.todayRevenue,
        mrr: revenue.mrr,
        arr: revenue.arr,
        growth: revenue.revenueGrowth,
      },
      transactions: {
        total: revenue.totalTransactions,
        successful: revenue.successfulTransactions,
        failed: revenue.failedTransactions,
        pending: revenue.pendingTransactions,
        conversionRate: revenue.conversionRate,
        averageValue: revenue.averageTransactionValue,
      },
      subscriptions: {
        active: subscriptions.activeSubscriptions,
        expired: subscriptions.expiredSubscriptions,
        cancelled: subscriptions.cancelledSubscriptions,
        churnRate: subscriptions.churnRate,
        byPlan: subscriptions.subscriptionsByPlan,
      },
      boosts: {
        total: boosts.totalBoosts,
        active: boosts.activeBoosts,
        revenue: boosts.boostRevenue,
        impressions: boosts.totalImpressions,
        clicks: boosts.totalClicks,
        ctr: boosts.averageCTR,
        byType: boosts.boostsByType,
      },
      revenueBreakdown: revenue.revenueByType,
      paymentMethods: revenue.paymentMethodsDistribution,
      metrics: {
        arpu: revenue.arpu,
        ltv: revenue.arpu * 12, // Simple LTV estimation
      },
    };
  }
}