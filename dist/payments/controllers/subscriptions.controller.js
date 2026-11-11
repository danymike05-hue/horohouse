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
var SubscriptionsController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubscriptionsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const subscriptions_service_1 = require("../services/subscriptions.service");
const payments_service_1 = require("../services/payments.service");
const jwt_auth_guard_1 = require("../../auth/guards/jwt.auth.guard");
const roles_guard_1 = require("../../auth/guards/roles.guard");
const payment_dto_1 = require("../dto/payment.dto");
const transaction_schema_1 = require("../schemas/transaction.schema");
let SubscriptionsController = SubscriptionsController_1 = class SubscriptionsController {
    subscriptionsService;
    paymentsService;
    logger = new common_1.Logger(SubscriptionsController_1.name);
    constructor(subscriptionsService, paymentsService) {
        this.subscriptionsService = subscriptionsService;
        this.paymentsService = paymentsService;
    }
    async getPlans() {
        try {
            this.logger.log('GET /subscriptions/plans - Fetching subscription plans');
            const plans = await this.subscriptionsService.getPlans();
            this.logger.log(`Found ${plans.length} subscription plans`);
            return plans;
        }
        catch (error) {
            this.logger.error('Error fetching plans:', error);
            throw error;
        }
    }
    async getMySubscription(req) {
        try {
            this.logger.log(`GET /subscriptions/my-subscription - User: ${req.user?.id || req.user?._id}`);
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
        }
        catch (error) {
            this.logger.error('Error fetching user subscription:', error);
            throw error;
        }
    }
    async subscribe(createSubscriptionDto, req) {
        try {
            this.logger.log(`POST /subscriptions/subscribe - User: ${req.user?.id || req.user?._id}`);
            const plans = await this.subscriptionsService.getPlans();
            const plan = plans.find(p => p.name === createSubscriptionDto.planName);
            if (!plan) {
                this.logger.error(`Plan not found: ${createSubscriptionDto.planName}`);
                throw new Error('Plan not found');
            }
            const price = plan.pricing[createSubscriptionDto.billingCycle];
            if (!price) {
                this.logger.error(`Invalid billing cycle: ${createSubscriptionDto.billingCycle}`);
                throw new Error('Invalid billing cycle for this plan');
            }
            const paymentDto = {
                type: transaction_schema_1.TransactionType.SUBSCRIPTION,
                amount: price,
                currency: 'XAF',
                paymentMethod: createSubscriptionDto.paymentMethod || transaction_schema_1.PaymentMethod.CARD,
                description: `Subscription: ${plan.displayName} (${createSubscriptionDto.billingCycle})`,
                metadata: {
                    planName: plan.name,
                    billingCycle: createSubscriptionDto.billingCycle,
                    discountCode: createSubscriptionDto.discountCode,
                },
            };
            const result = await this.paymentsService.initializePayment(paymentDto, req.user);
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
        }
        catch (error) {
            this.logger.error('Error subscribing:', error);
            throw error;
        }
    }
    async activateSubscription(transactionId, req) {
        try {
            this.logger.log(`POST /subscriptions/activate/${transactionId}`);
            const transaction = await this.paymentsService.verifyPayment({ transactionId }, req.user);
            if (transaction.status !== 'success') {
                this.logger.warn(`Payment not successful: ${transaction.status}`);
                return {
                    message: 'Payment not successful',
                    status: transaction.status,
                };
            }
            const subscription = await this.subscriptionsService.activateSubscription(transactionId);
            this.logger.log(`Subscription activated: ${subscription._id}`);
            return {
                message: 'Subscription activated successfully',
                subscription,
            };
        }
        catch (error) {
            this.logger.error('Error activating subscription:', error);
            throw error;
        }
    }
    async cancelSubscription(cancelDto, req) {
        try {
            this.logger.log(`PATCH /subscriptions/cancel - User: ${req.user?.id || req.user?._id}`);
            const userId = req.user?.id || req.user?._id?.toString();
            const subscription = await this.subscriptionsService.cancelSubscription(userId, cancelDto);
            this.logger.log(`Subscription cancelled: ${subscription._id}`);
            return {
                message: 'Subscription cancelled successfully',
                subscription,
                endsAt: subscription.endDate,
            };
        }
        catch (error) {
            this.logger.error('Error cancelling subscription:', error);
            throw error;
        }
    }
    async getUsage(req) {
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
                        remaining: maxListings === -1
                            ? 'Unlimited'
                            : maxListings - subscription.listingsUsed,
                    },
                    boosts: {
                        used: subscription.boostsUsed,
                        limit: boostsPerMonth,
                        remaining: boostsPerMonth === -1
                            ? 'Unlimited'
                            : boostsPerMonth - subscription.boostsUsed,
                    },
                },
            };
            this.logger.log('Usage data retrieved successfully');
            return usage;
        }
        catch (error) {
            this.logger.error('Error fetching usage:', error);
            throw error;
        }
    }
    async checkLimit(resourceType, req) {
        try {
            this.logger.log(`GET /subscriptions/check-limit/${resourceType} - User: ${req.user?.id || req.user?._id}`);
            const userId = req.user?.id || req.user?._id?.toString();
            const result = await this.subscriptionsService.checkUsageLimit(userId, resourceType);
            this.logger.log(`Limit check result: ${JSON.stringify(result)}`);
            return result;
        }
        catch (error) {
            this.logger.error('Error checking limit:', error);
            throw error;
        }
    }
};
exports.SubscriptionsController = SubscriptionsController;
__decorate([
    (0, common_1.Get)('plans'),
    (0, roles_guard_1.Public)(),
    (0, swagger_1.ApiOperation)({ summary: 'Get all available subscription plans' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Plans retrieved successfully' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SubscriptionsController.prototype, "getPlans", null);
__decorate([
    (0, common_1.Get)('my-subscription'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiBearerAuth)('JWT-auth'),
    (0, swagger_1.ApiOperation)({ summary: 'Get current user subscription' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Subscription retrieved' }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], SubscriptionsController.prototype, "getMySubscription", null);
__decorate([
    (0, common_1.Post)('subscribe'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiBearerAuth)('JWT-auth'),
    (0, swagger_1.ApiOperation)({ summary: 'Subscribe to a plan' }),
    (0, swagger_1.ApiResponse)({ status: 201, description: 'Subscription initialized' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [payment_dto_1.CreateSubscriptionDto, Object]),
    __metadata("design:returntype", Promise)
], SubscriptionsController.prototype, "subscribe", null);
__decorate([
    (0, common_1.Post)('activate/:transactionId'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiBearerAuth)('JWT-auth'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Activate subscription after payment' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Subscription activated' }),
    __param(0, (0, common_1.Param)('transactionId')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], SubscriptionsController.prototype, "activateSubscription", null);
__decorate([
    (0, common_1.Patch)('cancel'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiBearerAuth)('JWT-auth'),
    (0, swagger_1.ApiOperation)({ summary: 'Cancel subscription' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Subscription cancelled' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [payment_dto_1.CancelSubscriptionDto, Object]),
    __metadata("design:returntype", Promise)
], SubscriptionsController.prototype, "cancelSubscription", null);
__decorate([
    (0, common_1.Get)('usage'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiBearerAuth)('JWT-auth'),
    (0, swagger_1.ApiOperation)({ summary: 'Get subscription usage statistics' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Usage retrieved' }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], SubscriptionsController.prototype, "getUsage", null);
__decorate([
    (0, common_1.Get)('check-limit/:resourceType'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiBearerAuth)('JWT-auth'),
    (0, swagger_1.ApiOperation)({ summary: 'Check if user can use resource' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Limit check result' }),
    __param(0, (0, common_1.Param)('resourceType')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], SubscriptionsController.prototype, "checkLimit", null);
exports.SubscriptionsController = SubscriptionsController = SubscriptionsController_1 = __decorate([
    (0, swagger_1.ApiTags)('Subscriptions'),
    (0, common_1.Controller)('subscriptions'),
    __metadata("design:paramtypes", [subscriptions_service_1.SubscriptionsService,
        payments_service_1.PaymentsService])
], SubscriptionsController);
//# sourceMappingURL=subscriptions.controller.js.map