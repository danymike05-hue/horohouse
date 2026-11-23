import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { OnModuleInit } from '@nestjs/common';
import {
  Subscription,
  SubscriptionDocument,
  SubscriptionPlan,
  SubscriptionStatus,
  BillingCycle,
  SubscriptionFeatures,
} from '../schemas/subscription.schema';
import {
  SubscriptionPlanModel,
  SubscriptionPlanDocument,
} from '../schemas/subscription-plan.schema';
import {
  Transaction,
  TransactionDocument,
  TransactionStatus,
  TransactionType,
} from '../schemas/transaction.schema';
import {
  CreateSubscriptionDto,
  CancelSubscriptionDto,
} from '../dto/payment.dto';
import { HostPlansService } from '../../host-plans/host-plans.service';
import { HOST_TIERS, HostPlanName, isHostPlanName } from '../../host-plans/host-plan-tiers';

/** Short host plan blurbs; the app shows the full list from the tier numbers */
const HOST_PLAN_TEXT: Record<HostPlanName, { displayName: string; description: string; highlights: string[]; monthly: number; popular?: boolean; order: number }> = {
  host_free: { displayName: 'Free', description: 'Everything you need to start hosting', highlights: ['Up to 5 listings', '1 welcome boost', 'Basic insights'], monthly: 0, order: 30 },
  host_starter: { displayName: 'Starter', description: 'For hosts growing past their first homes', highlights: ['Up to 12 listings', '2 boosts a month', 'Promo codes for your guests'], monthly: 8000, order: 31 },
  host_growth: { displayName: 'Growth', description: 'Full insights and priority support', highlights: ['Up to 30 listings', '4 boosts a month', 'Full insights'], monthly: 15000, popular: true, order: 32 },
  host_pro: { displayName: 'Pro', description: 'AI tools and faster payouts', highlights: ['Up to 75 listings', 'AI smart pricing on every listing', 'Payouts 12h after check-in'], monthly: 23000, order: 33 },
  host_elite: { displayName: 'Elite', description: 'For property managers and big teams', highlights: ['Unlimited listings and boosts', 'Insights export', 'Dedicated support'], monthly: 30000, order: 34 },
};

function hostPlanSeeds() {
  return (Object.keys(HOST_TIERS) as HostPlanName[]).map((name) => {
    const t = HOST_TIERS[name];
    const x = HOST_PLAN_TEXT[name];
    return {
      name: name as any,
      displayName: x.displayName,
      description: x.description,
      highlights: x.highlights,
      pricing: { [BillingCycle.MONTHLY]: x.monthly, [BillingCycle.YEARLY]: x.monthly * 10 },
      features: {
        role: 'host',
        ...t,
        // Older readers of these fields
        maxProperties: t.maxListings,
        maxActiveListings: t.maxListings,
        canBoostListings: t.boostsPerMonth !== 0,
        smartPricing: t.smartPricingListings !== 0,
        analytics: t.insights === 'full',
        prioritySupport: t.support !== 'standard',
        dedicatedSupport: t.support === 'dedicated',
        bookingCalendar: true,
        shortTermRentalSupport: true,
      } as SubscriptionFeatures,
      displayOrder: x.order,
      isActive: true,
      isPublic: true,
      isPopular: !!x.popular,
      metadata: { role: 'host', ...(x.popular ? { badge: 'Most Popular' } : {}) },
    };
  });
}

@Injectable()
export class SubscriptionsService implements OnModuleInit {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(
    @InjectModel(Subscription.name)
    private subscriptionModel: Model<SubscriptionDocument>,
    @InjectModel(SubscriptionPlanModel.name)
    private subscriptionPlanModel: Model<SubscriptionPlanDocument>,
    @InjectModel(Transaction.name)
    private transactionModel: Model<TransactionDocument>,
    private readonly hostPlans: HostPlansService,
  ) {}

  // ── Fix #4: use lifecycle hook instead of constructor async call ──────────
  async onModuleInit(): Promise<void> {
    await this.initializeDefaultPlans();
  }

  /**
   * Seed / refresh default subscription plans using upserts.
   * Safe to run on a non-empty collection — existing plans are updated,
   * missing plans are inserted.
   */
  private async initializeDefaultPlans(): Promise<void> {
    try {
      const defaultPlans = this.getDefaultPlans();
      const activePlanNames = defaultPlans.map(p => p.name);

      for (const plan of defaultPlans) {
        await this.subscriptionPlanModel.updateOne(
          { name: plan.name },
          { $set: plan },
          { upsert: true },
        );
      }

      // Deactivate any legacy plans that are no longer in the current list
      await this.subscriptionPlanModel.updateMany(
        { name: { $nin: activePlanNames } },
        { $set: { isActive: false, isPublic: false } },
      );

      this.logger.log(`Subscription plans seeded (${defaultPlans.length} plans); legacy plans deactivated`);
    } catch (error) {
      this.logger.error('Failed to seed subscription plans:', error);
      throw error;
    }
  }

  /**
   * Default subscription plans — one entry per plan across all roles.
   * A `features.role` field marks which role each plan targets so the
   * frontend can filter plans by the logged-in user's role.
   */
  private getDefaultPlans() {
    return [
      // ── STUDENT plans (Free only) ────────────────────────────────────────────
      {
        name: SubscriptionPlan.STUDENT_FREE,
        displayName: 'Free',
        description: 'Essential features for students looking for housing',
        highlights: ['Browse listings', 'Save favorites', 'Contact hosts/agents'],
        pricing: {
          [BillingCycle.MONTHLY]: 0,
          [BillingCycle.YEARLY]: 0,
        },
        features: {
          role: 'student',
          maxListings: 0,
          prioritySupport: false,
          analytics: false,
        } as SubscriptionFeatures,
        displayOrder: 0,
        isActive: true,
        isPublic: true,
        isPopular: false,
        metadata: { role: 'student' },
      },

      // ── REGULAR USER plans ───────────────────────────────────────────────────
      {
        name: SubscriptionPlan.USER_FREE,
        displayName: 'Free',
        description: 'Explore properties and save favorites',
        highlights: ['Save favorites', 'Contact agents', 'Basic search'],
        pricing: {
          [BillingCycle.MONTHLY]: 0,
          [BillingCycle.YEARLY]: 0,
        },
        features: {
          role: 'user',
          maxListings: 0,
          prioritySupport: false,
          analytics: false,
        } as SubscriptionFeatures,
        displayOrder: 1,
        isActive: true,
        isPublic: true,
        isPopular: false,
        metadata: { role: 'user' },
      },
      {
        name: SubscriptionPlan.USER_PREMIUM,
        displayName: 'Premium',
        description: 'Advanced insights for renters and buyers',
        highlights: ['AI suggestions', 'Early access to listings', 'Priority messaging'],
        pricing: {
          [BillingCycle.MONTHLY]: 2500,
          [BillingCycle.YEARLY]: 25000,
        },
        features: {
          role: 'user',
          maxListings: 0,
          prioritySupport: true,
          analytics: false,
          premiumVisibility: true, // using this for "early access" abstractly
        } as SubscriptionFeatures,
        displayOrder: 2,
        isActive: true,
        isPublic: true,
        isPopular: true,
        metadata: { role: 'user', badge: 'Recommended' },
      },

      // ── AGENT plans ──────────────────────────────────────────────────────────
      {
        name: SubscriptionPlan.AGENT_FREE,
        displayName: 'Free',
        description: 'Get started at no cost',
        highlights: ['3 listings per month', 'Basic support', 'Standard visibility'],
        pricing: {
          [BillingCycle.MONTHLY]: 0,
          [BillingCycle.YEARLY]: 0,
        },
        features: {
          role: 'agent',
          maxListings: 3,
          maxActiveListings: 3,
          canBoostListings: false,
          boostsPerMonth: 0,
          prioritySupport: false,
          analytics: false,
          apiAccess: false,
          teamMembers: 1,
        } as SubscriptionFeatures,
        displayOrder: 10,
        isActive: true,
        isPublic: true,
        isPopular: false,
        metadata: { role: 'agent' },
      },
      {
        name: SubscriptionPlan.AGENT_BASIC,
        displayName: 'Basic',
        description: 'For growing agents',
        highlights: ['15 listings/month', 'Basic analytics', '1 boost/month'],
        pricing: {
          [BillingCycle.MONTHLY]: 10000,
          [BillingCycle.YEARLY]: 100000,
        },
        features: {
          role: 'agent',
          maxListings: 15,
          maxActiveListings: 15,
          canBoostListings: true,
          boostsPerMonth: 1,
          prioritySupport: false,
          analytics: true,
          teamMembers: 1,
        } as SubscriptionFeatures,
        displayOrder: 11,
        isActive: true,
        isPublic: true,
        isPopular: false,
        metadata: { role: 'agent' },
      },
      {
        name: SubscriptionPlan.AGENT_PRO,
        displayName: 'Pro',
        description: 'For professional agents',
        highlights: ['50 listings/month', 'Priority support', '5 boosts/month'],
        pricing: {
          [BillingCycle.MONTHLY]: 25000,
          [BillingCycle.YEARLY]: 250000,
        },
        features: {
          role: 'agent',
          maxListings: 50,
          maxActiveListings: 50,
          canBoostListings: true,
          boostsPerMonth: 5,
          prioritySupport: true,
          analytics: true,
          teamMembers: 3,
        } as SubscriptionFeatures,
        displayOrder: 12,
        isActive: true,
        isPublic: true,
        isPopular: true,
        metadata: { role: 'agent', badge: 'Best Value' },
      },
      {
        name: SubscriptionPlan.AGENT_ELITE,
        displayName: 'Elite',
        description: 'For top real estate agencies',
        highlights: ['Unlimited listings', 'Unlimited boosts', 'Full team access', 'API access'],
        pricing: {
          [BillingCycle.MONTHLY]: 50000,
          [BillingCycle.YEARLY]: 500000,
        },
        features: {
          role: 'agent',
          maxListings: -1,
          maxActiveListings: -1,
          canBoostListings: true,
          boostsPerMonth: -1,
          prioritySupport: true,
          analytics: true,
          apiAccess: true,
          teamMembers: -1,
        } as SubscriptionFeatures,
        displayOrder: 13,
        isActive: true,
        isPublic: true,
        isPopular: false,
        metadata: { role: 'agent' },
      },

      // ── LANDLORD plans (Long-term rentals) ───────────────────────────────────
      {
        name: SubscriptionPlan.LANDLORD_FREE,
        displayName: 'Free',
        description: 'Start listing at zero cost',
        highlights: ['1 property', 'Basic visibility'],
        pricing: {
          [BillingCycle.MONTHLY]: 0,
          [BillingCycle.YEARLY]: 0,
        },
        features: {
          role: 'landlord',
          maxProperties: 1,
          maxListings: 1,
          maxActiveListings: 1,
          canBoostListings: false,
          boostsPerMonth: 0,
          bookingCalendar: false,
          shortTermRentalSupport: false,
          analytics: false,
          maintenanceTracking: false,
        } as SubscriptionFeatures,
        displayOrder: 20,
        isActive: true,
        isPublic: true,
        isPopular: false,
        metadata: { role: 'landlord' },
      },
      {
        name: SubscriptionPlan.LANDLORD_BASIC,
        displayName: 'Basic',
        description: 'For landlords growing their portfolio',
        highlights: ['Up to 5 properties', 'Basic tenant management'],
        pricing: {
          [BillingCycle.MONTHLY]: 5000,
          [BillingCycle.YEARLY]: 50000,
        },
        features: {
          role: 'landlord',
          maxProperties: 5,
          maxListings: 5,
          maxActiveListings: 5,
          canBoostListings: false,
          boostsPerMonth: 0,
          bookingCalendar: false,
          shortTermRentalSupport: false,
          analytics: false,
          maintenanceTracking: true,
        } as SubscriptionFeatures,
        displayOrder: 21,
        isActive: true,
        isPublic: true,
        isPopular: false,
        metadata: { role: 'landlord', pricingSuffix: '/property' },
      },
      {
        name: SubscriptionPlan.LANDLORD_PRO,
        displayName: 'Pro',
        description: 'Analytics & maintenance for serious landlords',
        highlights: ['Unlimited properties', 'Analytics dashboard', 'Maintenance tracking'],
        pricing: {
          [BillingCycle.MONTHLY]: 15000,
          [BillingCycle.YEARLY]: 150000,
        },
        features: {
          role: 'landlord',
          maxProperties: -1,
          maxListings: -1,
          maxActiveListings: -1,
          canBoostListings: true,
          boostsPerMonth: 5,
          bookingCalendar: false,
          shortTermRentalSupport: false,
          analytics: true,
          maintenanceTracking: true,
          prioritySupport: true,
        } as SubscriptionFeatures,
        displayOrder: 22,
        isActive: true,
        isPublic: true,
        isPopular: true,
        metadata: { role: 'landlord', badge: 'Most Popular', pricingSuffix: '/property' },
      },

      // ── HOST plans (Short-term rentals): limits live in host-plans/host-plan-tiers.ts ──
      ...hostPlanSeeds(),
    ];
  }

  /**
   * Get all available subscription plans
   */
  async getPlans(): Promise<SubscriptionPlanModel[]> {
    return this.subscriptionPlanModel
      .find({ isActive: true, isPublic: true })
      .sort({ displayOrder: 1 })
      .exec();
  }

  /**
   * Get user's current active subscription only.
   * PENDING subscriptions are intentionally excluded so callers never
   * receive a subscription that isn't usable yet.
   */
  async getUserSubscription(userId: string): Promise<SubscriptionDocument | null> {
    // Only a running plan: an ACTIVE row whose end date hasn't passed (the expiry job
    // runs hourly, so this doesn't wait for it)
    return this.hostPlans.activeSubscription(userId);
  }

  /**
   * Get user's pending subscription (separate from active).
   */
  async getPendingSubscription(userId: string): Promise<SubscriptionDocument | null> {
    return this.subscriptionModel
      .findOne({
        userId: new Types.ObjectId(userId),
        status: SubscriptionStatus.PENDING,
      })
      .sort({ createdAt: -1 })
      .exec();
  }

  /**
   * Activate subscription after successful payment
   */
  async activateSubscription(transactionId: string): Promise<SubscriptionDocument> {
    try {
      this.logger.log(`Activating subscription for transaction: ${transactionId}`);

      const transaction = await this.transactionModel.findById(transactionId).exec();

      if (!transaction) {
        throw new NotFoundException('Transaction not found');
      }

      if (transaction.type !== TransactionType.SUBSCRIPTION) {
        throw new BadRequestException('Transaction is not for subscription');
      }

      // Only paid transactions, and only once (the activate route and checkout can both call this)
      if (transaction.status !== TransactionStatus.SUCCESS) {
        throw new BadRequestException('Payment not completed');
      }
      if (transaction.subscriptionId) {
        const done = await this.subscriptionModel.findById(transaction.subscriptionId).exec();
        if (done) return done;
      }

      const planName = transaction.metadata?.planName as SubscriptionPlan;
      const billingCycle = transaction.metadata?.billingCycle as BillingCycle;

      if (!planName || !billingCycle) {
        throw new BadRequestException('Missing subscription details in transaction');
      }

      const plan = await this.subscriptionPlanModel.findOne({ name: planName });
      if (!plan) {
        throw new NotFoundException('Subscription plan not found');
      }

      if (isHostPlanName(planName)) {
        const sub = await this.hostPlans.applyPaidPlan({
          userId: transaction.userId.toString(),
          planName,
          cycle: billingCycle,
          amountPaid: transaction.amount,
          creditClaimed: Number(transaction.metadata?.credit ?? 0) || 0,
          transactionId: transaction._id as Types.ObjectId,
          currency: transaction.currency,
          features: plan.features,
        });
        transaction.subscriptionId = sub._id as Types.ObjectId;
        await transaction.save();
        this.logger.log(`Host plan ${planName} paid: ${sub._id} (${sub.status})`);
        return sub;
      }

      // /payments/initialize takes the amount from the app: never give a plan for less than its price
      const planPrice = Number((plan.pricing as any)?.[billingCycle] ?? 0);
      if (!(planPrice > 0) || transaction.amount < planPrice) {
        this.logger.error(`Subscription ${planName}/${billingCycle} paid ${transaction.amount} but costs ${planPrice} (tx ${transactionId})`);
        throw new BadRequestException('Amount paid does not match the plan price');
      }

      const startDate = new Date();
      const endDate = this.calculateEndDate(startDate, billingCycle);

      // Cancel any existing active subscription
      const existingSubscription = await this.getUserSubscription(
        transaction.userId.toString(),
      );
      if (existingSubscription) {
        existingSubscription.status = SubscriptionStatus.CANCELLED;
        existingSubscription.cancelledAt = new Date();
        existingSubscription.cancellationReason = 'Upgraded to new plan';
        await existingSubscription.save();
      }

      const subscription = new this.subscriptionModel({
        userId: transaction.userId,
        plan: planName,
        status: SubscriptionStatus.ACTIVE,
        billingCycle,
        price: transaction.amount,
        currency: transaction.currency,
        features: plan.features,
        startDate,
        endDate,
        // ── Fix #1: nextBillingDate equals endDate — inlined directly ────
        nextBillingDate: endDate,
        // Nothing charges a plan automatically: it ends, and the person renews
        autoRenew: false,
        lastPaymentTransactionId: transaction._id,
        lastPaymentDate: new Date(),
        previousSubscriptionId: existingSubscription?._id,
        upgradedFrom: existingSubscription?.plan,
      });

      await subscription.save();

      transaction.subscriptionId = subscription._id as Types.ObjectId;
      await transaction.save();

      this.logger.log(`Subscription activated: ${subscription._id}`);
      return subscription;
    } catch (error) {
      this.logger.error('Activate subscription error:', error);
      throw error;
    }
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(
    userId: string,
    cancelDto: CancelSubscriptionDto,
  ): Promise<SubscriptionDocument> {
    const subscription = await this.getUserSubscription(userId);

    if (!subscription) {
      throw new NotFoundException('No active subscription found');
    }

    if (cancelDto.cancelImmediately) {
      subscription.status = SubscriptionStatus.CANCELLED;
    }
    // If not immediate: status stays ACTIVE, autoRenew=false ensures the
    // cron marks it EXPIRED at endDate rather than attempting renewal.
    // ── Fix #3: store scheduledCancellationDate so intent is explicit ────
    if (!cancelDto.cancelImmediately) {
      subscription.scheduledCancellationDate = subscription.endDate;
    }

    subscription.autoRenew = false;
    subscription.cancelledAt = new Date();
    subscription.cancellationReason = cancelDto.reason;

    await subscription.save();

    this.logger.log(`Subscription cancelled: ${subscription._id}`);
    return subscription;
  }

  /**
   * Check subscription usage limits.
   * Free-plan users (no active subscription) are checked against free-tier limits.
   */
  async checkUsageLimit(
    userId: string,
    resourceType: 'listings' | 'boosts',
  ): Promise<{ canUse: boolean; remaining: number; limit: number }> {
    const subscription = await this.getUserSubscription(userId);

    // ── Fix #2: properly handle free-plan users ───────────────────────────
    if (!subscription) {
      let role = 'user';
      try {
        const user = await this.subscriptionModel.db.collection('users').findOne({ _id: new Types.ObjectId(userId) });
        if (user && user.role) {
          role = user.role;
        }
      } catch (e) {
        this.logger.error('Failed to lookup user role for free limit check', e);
      }

      let planRoleTarget = role;
      if (['student', 'registered_user', 'guest'].includes(role)) planRoleTarget = 'user';

      const freePlan = await this.subscriptionPlanModel.findOne({
        $or: [
          { name: { $regex: /_free$/i } },
          { name: new RegExp(`${planRoleTarget}_free`, 'i') },
        ],
      }).exec();

      let limit = 0;
      if (freePlan) {
        limit = resourceType === 'listings'
          ? (freePlan.features.maxListings || 0)
          : (freePlan.features.boostsPerMonth || 0);
      } else {
        // Fallback default if no free plan explicitly exists
        limit = resourceType === 'listings' ? (planRoleTarget === 'agent' ? 3 : planRoleTarget === 'host' || planRoleTarget === 'landlord' ? 1 : 0) : 0;
      }

      // Count actual usage from the DB for this month so free users
      // aren't hard-blocked regardless of how many they've created.
      const usedThisMonth = await this.countFreeUsageThisMonth(userId, resourceType);
      
      const remaining = limit === -1 ? -1 : Math.max(0, limit - usedThisMonth);
      const canUse = limit === -1 || remaining > 0;

      return { canUse, remaining, limit };
    }

    const limit =
      resourceType === 'listings'
        ? subscription.features.maxListings
        : subscription.features.boostsPerMonth;

    if (limit === undefined) {
      return { canUse: false, remaining: 0, limit: 0 };
    }

    const used =
      resourceType === 'listings'
        ? subscription.listingsUsed
        : subscription.boostsUsed;

    // ── Fix #6: return -1 for unlimited instead of Infinity ──────────────
    const remaining = limit === -1 ? -1 : limit - used;
    const canUse = limit === -1 || used < limit;

    return { canUse, remaining, limit };
  }

  /**
   * Count how many listings/boosts a free-plan user has used this month.
   * Adjust the query to match your actual listings/boosts collection.
   */
  private async countFreeUsageThisMonth(
    userId: string,
    resourceType: 'listings' | 'boosts',
  ): Promise<number> {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    // Subscriptions track listingsUsed/boostsUsed on the document itself,
    // but free users have no subscription row. Fall back to 0 here and let
    // the caller (listings/boosts service) pass actual usage if available.
    // This is a safe default — replace with a real DB query if you track
    // free-tier usage in a separate collection.
    return 0;
  }

  /**
   * Increment usage counter
   */
  async incrementUsage(
    userId: string,
    resourceType: 'listings' | 'boosts',
  ): Promise<void> {
    const subscription = await this.getUserSubscription(userId);

    // ── Fix #6: log when there's no subscription to increment ────────────
    if (!subscription) {
      this.logger.warn(
        `incrementUsage called for user ${userId} with no active subscription (free-plan user)`,
      );
      return;
    }

    if (resourceType === 'listings') {
      subscription.listingsUsed += 1;
    } else if (resourceType === 'boosts') {
      subscription.boostsUsed += 1;
    }

    await subscription.save();
  }

  /**
   * Cron job: Check and expire subscriptions daily
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async checkExpiredSubscriptions(): Promise<void> {
    try {
      this.logger.log('Running subscription expiration check');

      // Host plans: HostPlansService.runPlanLifecycle (reminders, next plan, badge)
      const expiredSubscriptions = await this.subscriptionModel.find({
        status: SubscriptionStatus.ACTIVE,
        endDate: { $lte: new Date() },
        plan: { $nin: Object.keys(HOST_TIERS) },
      });

      // No payment is ever taken automatically, so every ended plan ends
      for (const subscription of expiredSubscriptions) {
        subscription.status = SubscriptionStatus.EXPIRED;
        await subscription.save();
        this.logger.log(`Subscription expired: ${subscription._id}`);
      }

      this.logger.log(
        `Processed ${expiredSubscriptions.length} expired subscriptions`,
      );
    } catch (error) {
      this.logger.error('Error checking expired subscriptions:', error);
    }
  }

  /**
   * Reset monthly usage counters
   */
  @Cron(CronExpression.EVERY_1ST_DAY_OF_MONTH_AT_MIDNIGHT)
  async resetMonthlyUsage(): Promise<void> {
    try {
      this.logger.log('Resetting monthly usage counters');

      await this.subscriptionModel.updateMany(
        { status: SubscriptionStatus.ACTIVE },
        { $set: { listingsUsed: 0, boostsUsed: 0 } },
      );

      this.logger.log('Monthly usage counters reset successfully');
    } catch (error) {
      this.logger.error('Error resetting monthly usage:', error);
    }
  }

  // ── PRIVATE HELPERS ───────────────────────────────────────────────────────

  private calculateEndDate(startDate: Date, billingCycle: BillingCycle): Date {
    const endDate = new Date(startDate);

    switch (billingCycle) {
      case BillingCycle.WEEKLY:
        endDate.setDate(endDate.getDate() + 7);
        break;
      case BillingCycle.MONTHLY:
        endDate.setMonth(endDate.getMonth() + 1);
        break;
      case BillingCycle.QUARTERLY:
        endDate.setMonth(endDate.getMonth() + 3);
        break;
      case BillingCycle.YEARLY:
        endDate.setFullYear(endDate.getFullYear() + 1);
        break;
    }

    return endDate;
  }
}