import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Delete,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { SubscriptionsService } from '../services/subscriptions.service';
import { PaymentsService } from '../services/payments.service';
import { JwtAuthGuard } from '../../auth/guards/jwt.auth.guard';
import { Public } from '../../auth/guards/roles.guard';
import {
  CreateSubscriptionDto,
  CancelSubscriptionDto,
  InitializePaymentDto,
} from '../dto/payment.dto';
import { TransactionType, PaymentMethod } from '../schemas/transaction.schema';

@ApiTags('Subscriptions')
@Controller('subscriptions')
export class SubscriptionsController {
  private readonly logger = new Logger(SubscriptionsController.name);

  constructor(
    private readonly subscriptionsService: SubscriptionsService,
    private readonly paymentsService: PaymentsService,
  ) {}

  // ==========================================
  // PUBLIC ENDPOINTS
  // ==========================================

  @Get('plans')
  @Public()
  @ApiOperation({ summary: 'Get all available subscription plans' })
  @ApiResponse({ status: 200, description: 'Plans retrieved successfully' })
  async getPlans() {
    try {
      this.logger.log('GET /subscriptions/plans - Fetching subscription plans');
      const plans = await this.subscriptionsService.getPlans();
      this.logger.log(`Found ${plans.length} subscription plans`);
      return plans;
    } catch (error) {
      this.logger.error('Error fetching plans:', error);
      throw error;
    }
  }

  // ==========================================
  // USER ENDPOINTS
  // ==========================================

  @Get('my-subscription')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get current user subscription' })
  @ApiResponse({ status: 200, description: 'Subscription retrieved' })
  async getMySubscription(@Req() req: any) {
    try {
      this.logger.log(`GET /subscriptions/my-subscription - User: ${req.user?.id || req.user?._id}`);
      
      // Handle both req.user.id and req.user._id
      const userId = req.user?.id || req.user?._id?.toString();
      
      if (!userId) {
        this.logger.error('No user ID found in request');
        throw new Error('User not authenticated');
      }

      const subscription = await this.subscriptionsService.getUserSubscription(userId);

      if (!subscription) {
        this.logger.log('No active subscription found for user');
        return {
          message: 'No active subscription',
          subscription: null,
          plan: 'free',
        };
      }

      this.logger.log(`Found subscription: ${subscription._id}`);
      return { subscription };
    } catch (error) {
      this.logger.error('Error fetching user subscription:', error);
      throw error;
    }
  }

  @Post('subscribe')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Subscribe to a plan' })
  @ApiResponse({ status: 201, description: 'Subscription initialized' })
  async subscribe(
    @Body() createSubscriptionDto: CreateSubscriptionDto,
    @Req() req: any,
  ) {
    try {
      this.logger.log(`POST /subscriptions/subscribe - User: ${req.user?.id || req.user?._id}`);
      
      // Get plan details
      const plans = await this.subscriptionsService.getPlans();
      const plan = plans.find(p => p.name === createSubscriptionDto.planName);

      if (!plan) {
        this.logger.error(`Plan not found: ${createSubscriptionDto.planName}`);
        throw new Error('Plan not found');
      }

      // Get price based on billing cycle
      const price = plan.pricing[createSubscriptionDto.billingCycle];

      if (!price) {
        this.logger.error(`Invalid billing cycle: ${createSubscriptionDto.billingCycle}`);
        throw new Error('Invalid billing cycle for this plan');
      }

      // Initialize payment
      const paymentDto: InitializePaymentDto = {
        type: TransactionType.SUBSCRIPTION,
        amount: price,
        currency: 'XAF' as any,
        paymentMethod: createSubscriptionDto.paymentMethod || PaymentMethod.CARD,
        description: `Subscription: ${plan.displayName} (${createSubscriptionDto.billingCycle})`,
        metadata: {
          planName: plan.name,
          billingCycle: createSubscriptionDto.billingCycle,
          discountCode: createSubscriptionDto.discountCode,
        },
      };

      const result = await this.paymentsService.initializePayment(
        paymentDto,
        req.user,
      );

      this.logger.log(`Payment initialized: ${result.transaction._id}`);

      return {
        message: 'Payment initialized',
        transaction: result.transaction,
        paymentLink: result.paymentLink,
        plan: {
          name: plan.displayName,
          price,
          billingCycle: createSubscriptionDto.billingCycle,
        },
      };
    } catch (error) {
      this.logger.error('Error subscribing:', error);
      throw error;
    }
  }

  @Post('activate/:transactionId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Activate subscription after payment' })
  @ApiResponse({ status: 200, description: 'Subscription activated' })
  async activateSubscription(
    @Param('transactionId') transactionId: string,
    @Req() req: any,
  ) {
    try {
      this.logger.log(`POST /subscriptions/activate/${transactionId}`);
      
      // Verify payment first
      const transaction = await this.paymentsService.verifyPayment(
        { transactionId },
        req.user,
      );

      if (transaction.status !== 'success') {
        this.logger.warn(`Payment not successful: ${transaction.status}`);
        return {
          message: 'Payment not successful',
          status: transaction.status,
        };
      }

      // Activate subscription
      const subscription = await this.subscriptionsService.activateSubscription(
        transactionId,
      );

      this.logger.log(`Subscription activated: ${subscription._id}`);

      return {
        message: 'Subscription activated successfully',
        subscription,
      };
    } catch (error) {
      this.logger.error('Error activating subscription:', error);
      throw error;
    }
  }

  @Patch('cancel')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Cancel subscription' })
  @ApiResponse({ status: 200, description: 'Subscription cancelled' })
  async cancelSubscription(
    @Body() cancelDto: CancelSubscriptionDto,
    @Req() req: any,
  ) {
    try {
      this.logger.log(`PATCH /subscriptions/cancel - User: ${req.user?.id || req.user?._id}`);
      
      const userId = req.user?.id || req.user?._id?.toString();
      const subscription = await this.subscriptionsService.cancelSubscription(
        userId,
        cancelDto,
      );

      this.logger.log(`Subscription cancelled: ${subscription._id}`);

      return {
        message: 'Subscription cancelled successfully',
        subscription,
        endsAt: subscription.endDate,
      };
    } catch (error) {
      this.logger.error('Error cancelling subscription:', error);
      throw error;
    }
  }

  @Get('usage')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get subscription usage statistics' })
  @ApiResponse({ status: 200, description: 'Usage retrieved' })
  async getUsage(@Req() req: any) {
    try {
      this.logger.log(`GET /subscriptions/usage - User: ${req.user?.id || req.user?._id}`);
      
      const userId = req.user?.id || req.user?._id?.toString();
      const subscription = await this.subscriptionsService.getUserSubscription(userId);

      if (!subscription) {
        this.logger.log('No active subscription found');
        return {
          message: 'No active subscription',
          usage: null,
        };
      }

      // Safely handle potentially undefined values
      const maxListings = subscription.features.maxListings ?? 0;
      const boostsPerMonth = subscription.features.boostsPerMonth ?? 0;

      const usage = {
        subscription: {
          plan: subscription.plan,
          status: subscription.status,
          endDate: subscription.endDate,
        },
        usage: {
          listings: {
            used: subscription.listingsUsed,
            limit: maxListings,
            remaining:
              maxListings === -1
                ? 'Unlimited'
                : maxListings - subscription.listingsUsed,
          },
          boosts: {
            used: subscription.boostsUsed,
            limit: boostsPerMonth,
            remaining:
              boostsPerMonth === -1
                ? 'Unlimited'
                : boostsPerMonth - subscription.boostsUsed,
          },
        },
      };

      this.logger.log('Usage data retrieved successfully');
      return usage;
    } catch (error) {
      this.logger.error('Error fetching usage:', error);
      throw error;
    }
  }

  @Get('check-limit/:resourceType')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Check if user can use resource' })
  @ApiResponse({ status: 200, description: 'Limit check result' })
  async checkLimit(
    @Param('resourceType') resourceType: 'listings' | 'boosts',
    @Req() req: any,
  ) {
    try {
      this.logger.log(`GET /subscriptions/check-limit/${resourceType} - User: ${req.user?.id || req.user?._id}`);
      
      const userId = req.user?.id || req.user?._id?.toString();
      const result = await this.subscriptionsService.checkUsageLimit(userId, resourceType);
      
      this.logger.log(`Limit check result: ${JSON.stringify(result)}`);
      return result;
    } catch (error) {
      this.logger.error('Error checking limit:', error);
      throw error;
    }
  }
}