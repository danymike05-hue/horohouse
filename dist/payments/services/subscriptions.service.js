"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var SubscriptionsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubscriptionsService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const schedule_1 = require("@nestjs/schedule");
const subscription_schema_1 = require("../schemas/subscription.schema");
const subscription_plan_schema_1 = require("../schemas/subscription-plan.schema");
const transaction_schema_1 = require("../schemas/transaction.schema");
let SubscriptionsService = SubscriptionsService_1 = class SubscriptionsService {
    subscriptionModel;
    subscriptionPlanModel;
    transactionModel;
    logger = new common_1.Logger(SubscriptionsService_1.name);
    constructor(subscriptionModel, subscriptionPlanModel, transactionModel) {
        this.subscriptionModel = subscriptionModel;
        this.subscriptionPlanModel = subscriptionPlanModel;
        this.transactionModel = transactionModel;
    }
    async onModuleInit() {
        await this.initializeDefaultPlans();
    }
    async initializeDefaultPlans() {
        try {
            const defaultPlans = this.getDefaultPlans();
            const activePlanNames = defaultPlans.map(p => p.name);
            for (const plan of defaultPlans) {
                await this.subscriptionPlanModel.updateOne({ name: plan.name }, { $set: plan }, { upsert: true });
            }
            await this.subscriptionPlanModel.updateMany({ name: { $nin: activePlanNames } }, { $set: { isActive: false, isPublic: false } });
            this.logger.log(`Subscription plans seeded (${defaultPlans.length} plans); legacy plans deactivated`);
        }
        catch (error) {
            this.logger.error('Failed to seed subscription plans:', error);
            throw error;
        }
    }
    getDefaultPlans() {
        return [
            {
                name: subscription_schema_1.SubscriptionPlan.STUDENT_FREE,
                displayName: 'Free',
                description: 'Essential features for students looking for housing',
                highlights: ['Browse listings', 'Save favorites', 'Contact hosts/agents'],
                pricing: {
                    [subscription_schema_1.BillingCycle.MONTHLY]: 0,
                    [subscription_schema_1.BillingCycle.YEARLY]: 0,
                },
                features: {
                    role: 'student',
                    maxListings: 0,
                    prioritySupport: false,
                    analytics: false,
                },
                displayOrder: 0,
                isActive: true,
                isPublic: true,
                isPopular: false,
                metadata: { role: 'student' },
            },
            {
                name: subscription_schema_1.SubscriptionPlan.USER_FREE,
                displayName: 'Free',
                description: 'Explore properties and save favorites',
                highlights: ['Save favorites', 'Contact agents', 'Basic search'],
                pricing: {
                    [subscription_schema_1.BillingCycle.MONTHLY]: 0,
                    [subscription_schema_1.BillingCycle.YEARLY]: 0,
                },
                features: {
                    role: 'user',
                    maxListings: 0,
                    prioritySupport: false,
                    analytics: false,
                },
                displayOrder: 1,
                isActive: true,
                isPublic: true,
                isPopular: false,
                metadata: { role: 'user' },
            },
            {
                name: subscription_schema_1.SubscriptionPlan.USER_PREMIUM,
                displayName: 'Premium',
                description: 'Advanced insights for renters and buyers',
                highlights: ['AI suggestions', 'Early access to listings', 'Priority messaging'],
                pricing: {
                    [subscription_schema_1.BillingCycle.MONTHLY]: 2500,
                    [subscription_schema_1.BillingCycle.YEARLY]: 25000,
                },
                features: {
                    role: 'user',
                    maxListings: 0,
                    prioritySupport: true,
                    analytics: false,
                    premiumVisibility: true,
                },
                displayOrder: 2,
                isActive: true,
                isPublic: true,
                isPopular: true,
                metadata: { role: 'user', badge: 'Recommended' },
            },
            {
                name: subscription_schema_1.SubscriptionPlan.AGENT_FREE,
                displayName: 'Free',
                description: 'Get started at no cost',
                highlights: ['3 listings per month', 'Basic support', 'Standard visibility'],
                pricing: {
                    [subscription_schema_1.BillingCycle.MONTHLY]: 0,
                    [subscription_schema_1.BillingCycle.YEARLY]: 0,
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
                },
                displayOrder: 10,
                isActive: true,
                isPublic: true,
                isPopular: false,
                metadata: { role: 'agent' },
            },
            {
                name: subscription_schema_1.SubscriptionPlan.AGENT_BASIC,
                displayName: 'Basic',
                description: 'For growing agents',
                highlights: ['15 listings/month', 'Basic analytics', '1 boost/month'],
                pricing: {
                    [subscription_schema_1.BillingCycle.MONTHLY]: 10000,
                    [subscription_schema_1.BillingCycle.YEARLY]: 100000,
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
                },
                displayOrder: 11,
                isActive: true,
                isPublic: true,
                isPopular: false,
                metadata: { role: 'agent' },
            },
            {
                name: subscription_schema_1.SubscriptionPlan.AGENT_PRO,
                displayName: 'Pro',
                description: 'For professional agents',
                highlights: ['50 listings/month', 'Priority support', '5 boosts/month'],
                pricing: {
                    [subscription_schema_1.BillingCycle.MONTHLY]: 25000,
                    [subscription_schema_1.BillingCycle.YEARLY]: 250000,
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
                },
                displayOrder: 12,
                isActive: true,
                isPublic: true,
                isPopular: true,
                metadata: { role: 'agent', badge: 'Best Value' },
            },
            {
                name: subscription_schema_1.SubscriptionPlan.AGENT_ELITE,
                displayName: 'Elite',
                description: 'For top real estate agencies',
                highlights: ['Unlimited listings', 'Unlimited boosts', 'Full team access', 'API access'],
                pricing: {
                    [subscription_schema_1.BillingCycle.MONTHLY]: 50000,
                    [subscription_schema_1.BillingCycle.YEARLY]: 500000,
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
                },
                displayOrder: 13,
                isActive: true,
                isPublic: true,
                isPopular: false,
                metadata: { role: 'agent' },
            },
            {
                name: subscription_schema_1.SubscriptionPlan.LANDLORD_FREE,
                displayName: 'Free',
                description: 'Start listing at zero cost',
                highlights: ['1 property', 'Basic visibility'],
                pricing: {
                    [subscription_schema_1.BillingCycle.MONTHLY]: 0,
                    [subscription_schema_1.BillingCycle.YEARLY]: 0,
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
                },
                displayOrder: 20,
                isActive: true,
                isPublic: true,
                isPopular: false,
                metadata: { role: 'landlord' },
            },
            {
                name: subscription_schema_1.SubscriptionPlan.LANDLORD_BASIC,
                displayName: 'Basic',
                description: 'For landlords growing their portfolio',
                highlights: ['Up to 5 properties', 'Basic tenant management'],
                pricing: {
                    [subscription_schema_1.BillingCycle.MONTHLY]: 5000,
                    [subscription_schema_1.BillingCycle.YEARLY]: 50000,
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
                },
                displayOrder: 21,
                isActive: true,
                isPublic: true,
                isPopular: false,
                metadata: { role: 'landlord', pricingSuffix: '/property' },
            },
            {
                name: subscription_schema_1.SubscriptionPlan.LANDLORD_PRO,
                displayName: 'Pro',
                description: 'Analytics & maintenance for serious landlords',
                highlights: ['Unlimited properties', 'Analytics dashboard', 'Maintenance tracking'],
                pricing: {
                    [subscription_schema_1.BillingCycle.MONTHLY]: 15000,
                    [subscription_schema_1.BillingCycle.YEARLY]: 150000,
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
                },
                displayOrder: 22,
                isActive: true,
                isPublic: true,
                isPopular: true,
                metadata: { role: 'landlord', badge: 'Most Popular', pricingSuffix: '/property' },
            },
            {
                name: subscription_schema_1.SubscriptionPlan.HOST_FREE,
                displayName: 'Free',
                description: 'Try out short-term hosting',
                highlights: ['1 property', 'Basic booking calendar'],
                pricing: {
                    [subscription_schema_1.BillingCycle.MONTHLY]: 0,
                    [subscription_schema_1.BillingCycle.YEARLY]: 0,
                },
                features: {
                    role: 'host',
                    maxProperties: 1,
                    maxListings: 1,
                    maxActiveListings: 1,
                    canBoostListings: false,
                    boostsPerMonth: 0,
                    bookingCalendar: true,
                    shortTermRentalSupport: true,
                    analytics: false,
                },
                displayOrder: 30,
                isActive: true,
                isPublic: true,
                isPopular: false,
                metadata: { role: 'host' },
            },
            {
                name: subscription_schema_1.SubscriptionPlan.HOST_STARTER,
                displayName: 'Starter',
                description: 'For part-time hosts',
                highlights: ['Up to 3 properties', 'Short-term calendar support'],
                pricing: {
                    [subscription_schema_1.BillingCycle.MONTHLY]: 10000,
                    [subscription_schema_1.BillingCycle.YEARLY]: 100000,
                },
                features: {
                    role: 'host',
                    maxProperties: 3,
                    maxListings: 3,
                    maxActiveListings: 3,
                    canBoostListings: true,
                    boostsPerMonth: 1,
                    bookingCalendar: true,
                    shortTermRentalSupport: true,
                    analytics: false,
                },
                displayOrder: 31,
                isActive: true,
                isPublic: true,
                isPopular: false,
                metadata: { role: 'host' },
            },
            {
                name: subscription_schema_1.SubscriptionPlan.HOST_GROWTH,
                displayName: 'Growth',
                description: 'For scaling short-term operations',
                highlights: ['Up to 10 properties', 'Analytics dashboard', '2 boosts/month'],
                pricing: {
                    [subscription_schema_1.BillingCycle.MONTHLY]: 20000,
                    [subscription_schema_1.BillingCycle.YEARLY]: 200000,
                },
                features: {
                    role: 'host',
                    maxProperties: 10,
                    maxListings: 10,
                    maxActiveListings: 10,
                    canBoostListings: true,
                    boostsPerMonth: 2,
                    bookingCalendar: true,
                    shortTermRentalSupport: true,
                    analytics: true,
                    prioritySupport: true,
                },
                displayOrder: 32,
                isActive: true,
                isPublic: true,
                isPopular: true,
                metadata: { role: 'host', badge: 'Most Popular' },
            },
            {
                name: subscription_schema_1.SubscriptionPlan.HOST_PRO,
                displayName: 'Pro',
                description: 'Advanced tools for superhosts',
                highlights: ['Up to 25 properties', 'AI smart pricing', '5 boosts/month'],
                pricing: {
                    [subscription_schema_1.BillingCycle.MONTHLY]: 30000,
                    [subscription_schema_1.BillingCycle.YEARLY]: 300000,
                },
                features: {
                    role: 'host',
                    maxProperties: 25,
                    maxListings: 25,
                    maxActiveListings: 25,
                    canBoostListings: true,
                    boostsPerMonth: 5,
                    bookingCalendar: true,
                    shortTermRentalSupport: true,
                    analytics: true,
                    smartPricing: true,
                    prioritySupport: true,
                },
                displayOrder: 33,
                isActive: true,
                isPublic: true,
                isPopular: false,
                metadata: { role: 'host' },
            },
            {
                name: subscription_schema_1.SubscriptionPlan.HOST_ELITE,
                displayName: 'Elite',
                description: 'For vacation rental management companies',
                highlights: ['Unlimited properties', 'Premium visibility', 'Dedicated support'],
                pricing: {
                    [subscription_schema_1.BillingCycle.MONTHLY]: 40000,
                    [subscription_schema_1.BillingCycle.YEARLY]: 400000,
                },
                features: {
                    role: 'host',
                    maxProperties: -1,
                    maxListings: -1,
                    maxActiveListings: -1,
                    canBoostListings: true,
                    boostsPerMonth: -1,
                    bookingCalendar: true,
                    shortTermRentalSupport: true,
                    analytics: true,
                    smartPricing: true,
                    premiumVisibility: true,
                    dedicatedSupport: true,
                },
                displayOrder: 34,
                isActive: true,
                isPublic: true,
                isPopular: false,
                metadata: { role: 'host' },
            },
        ];
    }
    async getPlans() {
        return this.subscriptionPlanModel
            .find({ isActive: true, isPublic: true })
            .sort({ displayOrder: 1 })
            .exec();
    }
    async getUserSubscription(userId) {
        return this.subscriptionModel
            .findOne({
            userId: new mongoose_2.Types.ObjectId(userId),
            status: subscription_schema_1.SubscriptionStatus.ACTIVE,
        })
            .populate('lastPaymentTransactionId')
            .sort({ createdAt: -1 })
            .exec();
    }
    async getPendingSubscription(userId) {
        return this.subscriptionModel
            .findOne({
            userId: new mongoose_2.Types.ObjectId(userId),
            status: subscription_schema_1.SubscriptionStatus.PENDING,
        })
            .sort({ createdAt: -1 })
            .exec();
    }
    async activateSubscription(transactionId) {
        try {
            this.logger.log(`Activating subscription for transaction: ${transactionId}`);
            const transaction = await this.transactionModel.findById(transactionId).exec();
            if (!transaction) {
                throw new common_1.NotFoundException('Transaction not found');
            }
            if (transaction.type !== transaction_schema_1.TransactionType.SUBSCRIPTION) {
                throw new common_1.BadRequestException('Transaction is not for subscription');
            }
            const planName = transaction.metadata?.planName;
            const billingCycle = transaction.metadata?.billingCycle;
            if (!planName || !billingCycle) {
                throw new common_1.BadRequestException('Missing subscription details in transaction');
            }
            const plan = await this.subscriptionPlanModel.findOne({ name: planName });
            if (!plan) {
                throw new common_1.NotFoundException('Subscription plan not found');
            }
            const startDate = new Date();
            const endDate = this.calculateEndDate(startDate, billingCycle);
            const existingSubscription = await this.getUserSubscription(transaction.userId.toString());
            if (existingSubscription) {
                existingSubscription.status = subscription_schema_1.SubscriptionStatus.CANCELLED;
                existingSubscription.cancelledAt = new Date();
                existingSubscription.cancellationReason = 'Upgraded to new plan';
                await existingSubscription.save();
            }
            const subscription = new this.subscriptionModel({
                userId: transaction.userId,
                plan: planName,
                status: subscription_schema_1.SubscriptionStatus.ACTIVE,
                billingCycle,
                price: transaction.amount,
                currency: transaction.currency,
                features: plan.features,
                startDate,
                endDate,
                nextBillingDate: endDate,
                autoRenew: true,
                lastPaymentTransactionId: transaction._id,
                lastPaymentDate: new Date(),
                previousSubscriptionId: existingSubscription?._id,
                upgradedFrom: existingSubscription?.plan,
            });
            await subscription.save();
            transaction.subscriptionId = subscription._id;
            await transaction.save();
            this.logger.log(`Subscription activated: ${subscription._id}`);
            return subscription;
        }
        catch (error) {
            this.logger.error('Activate subscription error:', error);
            throw error;
        }
    }
    async cancelSubscription(userId, cancelDto) {
        const subscription = await this.getUserSubscription(userId);
        if (!subscription) {
            throw new common_1.NotFoundException('No active subscription found');
        }
        if (cancelDto.cancelImmediately) {
            subscription.status = subscription_schema_1.SubscriptionStatus.CANCELLED;
        }
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
    async checkUsageLimit(userId, resourceType) {
        const subscription = await this.getUserSubscription(userId);
        if (!subscription) {
            let role = 'user';
            try {
                const user = await this.subscriptionModel.db.collection('users').findOne({ _id: new mongoose_2.Types.ObjectId(userId) });
                if (user && user.role) {
                    role = user.role;
                }
            }
            catch (e) {
                this.logger.error('Failed to lookup user role for free limit check', e);
            }
            let planRoleTarget = role;
            if (['student', 'registered_user', 'guest'].includes(role))
                planRoleTarget = 'user';
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
            }
            else {
                limit = resourceType === 'listings' ? (planRoleTarget === 'agent' ? 3 : planRoleTarget === 'host' || planRoleTarget === 'landlord' ? 1 : 0) : 0;
            }
            const usedThisMonth = await this.countFreeUsageThisMonth(userId, resourceType);
            const remaining = limit === -1 ? -1 : Math.max(0, limit - usedThisMonth);
            const canUse = limit === -1 || remaining > 0;
            return { canUse, remaining, limit };
        }
        const limit = resourceType === 'listings'
            ? subscription.features.maxListings
            : subscription.features.boostsPerMonth;
        if (limit === undefined) {
            return { canUse: false, remaining: 0, limit: 0 };
        }
        const used = resourceType === 'listings'
            ? subscription.listingsUsed
            : subscription.boostsUsed;
        const remaining = limit === -1 ? -1 : limit - used;
        const canUse = limit === -1 || used < limit;
        return { canUse, remaining, limit };
    }
    async countFreeUsageThisMonth(userId, resourceType) {
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);
        return 0;
    }
    async incrementUsage(userId, resourceType) {
        const subscription = await this.getUserSubscription(userId);
        if (!subscription) {
            this.logger.warn(`incrementUsage called for user ${userId} with no active subscription (free-plan user)`);
            return;
        }
        if (resourceType === 'listings') {
            subscription.listingsUsed += 1;
        }
        else if (resourceType === 'boosts') {
            subscription.boostsUsed += 1;
        }
        await subscription.save();
    }
    async checkExpiredSubscriptions() {
        try {
            this.logger.log('Running subscription expiration check');
            const expiredSubscriptions = await this.subscriptionModel.find({
                status: subscription_schema_1.SubscriptionStatus.ACTIVE,
                endDate: { $lte: new Date() },
            });
            for (const subscription of expiredSubscriptions) {
                if (subscription.autoRenew) {
                    this.logger.log(`Auto-renewal needed for subscription: ${subscription._id}`);
                }
                else {
                    subscription.status = subscription_schema_1.SubscriptionStatus.EXPIRED;
                    await subscription.save();
                    this.logger.log(`Subscription expired: ${subscription._id}`);
                }
            }
            this.logger.log(`Processed ${expiredSubscriptions.length} expired subscriptions`);
        }
        catch (error) {
            this.logger.error('Error checking expired subscriptions:', error);
        }
    }
    async resetMonthlyUsage() {
        try {
            this.logger.log('Resetting monthly usage counters');
            await this.subscriptionModel.updateMany({ status: subscription_schema_1.SubscriptionStatus.ACTIVE }, { $set: { listingsUsed: 0, boostsUsed: 0 } });
            this.logger.log('Monthly usage counters reset successfully');
        }
        catch (error) {
            this.logger.error('Error resetting monthly usage:', error);
        }
    }
    calculateEndDate(startDate, billingCycle) {
        const endDate = new Date(startDate);
        switch (billingCycle) {
            case subscription_schema_1.BillingCycle.WEEKLY:
                endDate.setDate(endDate.getDate() + 7);
                break;
            case subscription_schema_1.BillingCycle.MONTHLY:
                endDate.setMonth(endDate.getMonth() + 1);
                break;
            case subscription_schema_1.BillingCycle.QUARTERLY:
                endDate.setMonth(endDate.getMonth() + 3);
                break;
            case subscription_schema_1.BillingCycle.YEARLY:
                endDate.setFullYear(endDate.getFullYear() + 1);
                break;
        }
        return endDate;
    }
};
exports.SubscriptionsService = SubscriptionsService;
__decorate([
    (0, schedule_1.Cron)(schedule_1.CronExpression.EVERY_DAY_AT_MIDNIGHT),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SubscriptionsService.prototype, "checkExpiredSubscriptions", null);
__decorate([
    (0, schedule_1.Cron)(schedule_1.CronExpression.EVERY_1ST_DAY_OF_MONTH_AT_MIDNIGHT),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SubscriptionsService.prototype, "resetMonthlyUsage", null);
exports.SubscriptionsService = SubscriptionsService = SubscriptionsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(subscription_schema_1.Subscription.name)),
    __param(1, (0, mongoose_1.InjectModel)(subscription_plan_schema_1.SubscriptionPlanModel.name)),
    __param(2, (0, mongoose_1.InjectModel)(transaction_schema_1.Transaction.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model])
], SubscriptionsService);
//# sourceMappingURL=subscriptions.service.js.map