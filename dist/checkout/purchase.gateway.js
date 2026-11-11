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
var PurchaseGateway_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PurchaseGateway = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const transaction_schema_1 = require("../payments/schemas/transaction.schema");
const listing_boost_schema_1 = require("../payments/schemas/listing-boost.schema");
const wallet_schema_1 = require("../payments/schemas/wallet.schema");
const subscription_schema_1 = require("../payments/schemas/subscription.schema");
const subscriptions_service_1 = require("../payments/services/subscriptions.service");
const listing_boost_service_1 = require("../payments/services/listing-boost.service");
const wallet_service_1 = require("../payments/services/wallet.service");
const property_schema_1 = require("../properties/schemas/property.schema");
const user_schema_1 = require("../users/schemas/user.schema");
const momo_util_1 = require("./momo.util");
const SOLD_BOOSTS = [listing_boost_schema_1.BoostType.STANDARD, listing_boost_schema_1.BoostType.FEATURED, listing_boost_schema_1.BoostType.HOMEPAGE, listing_boost_schema_1.BoostType.SOCIAL_MEDIA];
const DURATIONS = [24, 168, 720];
let PurchaseGateway = PurchaseGateway_1 = class PurchaseGateway {
    transactions;
    boosts;
    properties;
    users;
    wallets;
    subscriptionDocs;
    subscriptions;
    listingBoosts;
    walletService;
    logger = new common_1.Logger(PurchaseGateway_1.name);
    constructor(transactions, boosts, properties, users, wallets, subscriptionDocs, subscriptions, listingBoosts, walletService) {
        this.transactions = transactions;
        this.boosts = boosts;
        this.properties = properties;
        this.users = users;
        this.wallets = wallets;
        this.subscriptionDocs = subscriptionDocs;
        this.subscriptions = subscriptions;
        this.listingBoosts = listingBoosts;
        this.walletService = walletService;
    }
    async quote(userId, req) {
        const user = await this.users.findById(userId).select('name phoneNumber').lean();
        if (!user)
            throw new common_1.NotFoundException('Compte introuvable.');
        const local = (0, momo_util_1.normalizeCmPhone)(user.phoneNumber);
        const base = { customerName: user.name, customerPhone: local ?? undefined };
        if (req.purpose === 'subscription') {
            const plans = await this.subscriptions.getPlans();
            const plan = plans.find((p) => p.name === req.planName);
            if (!plan)
                throw new common_1.NotFoundException({ code: 'PLAN_NOT_FOUND', message: 'Cette formule n’existe plus.' });
            const cycle = req.billingCycle ?? 'monthly';
            const amount = Number(plan.pricing?.[cycle] ?? 0);
            if (!(amount > 0)) {
                throw new common_1.UnprocessableEntityException({ code: 'PLAN_NOT_PAYABLE', message: 'Cette formule n’est pas payante pour cette période.' });
            }
            const current = await this.subscriptions.getUserSubscription(userId);
            if (current && current.plan === plan.name && current.billingCycle === cycle) {
                throw new common_1.ConflictException({ code: 'ALREADY_ON_PLAN', message: 'Vous avez déjà cette formule.' });
            }
            return {
                ...base,
                amount,
                key: `sub:${userId}`,
                purchase: {
                    label: `${plan.displayName} (${cycle})`,
                    planName: plan.name,
                    billingCycle: cycle,
                },
            };
        }
        if (!req.propertyId || !(0, mongoose_2.isValidObjectId)(req.propertyId))
            throw new common_1.BadRequestException('Annonce invalide.');
        if (!req.boostType || !SOLD_BOOSTS.includes(req.boostType)) {
            throw new common_1.BadRequestException({ code: 'INVALID_BOOST', message: 'Ce type de boost n’existe pas.' });
        }
        if (!req.duration || !DURATIONS.includes(Number(req.duration))) {
            throw new common_1.BadRequestException({ code: 'INVALID_DURATION', message: 'Durée de boost invalide.' });
        }
        const property = await this.properties.findById(req.propertyId).select('title ownerId agentId isActive').lean();
        if (!property)
            throw new common_1.NotFoundException('Annonce introuvable.');
        if (String(property.ownerId) !== String(userId) && String(property.agentId ?? '') !== String(userId)) {
            throw new common_1.ForbiddenException({ code: 'NOT_YOUR_LISTING', message: 'Vous ne pouvez booster que vos propres annonces.' });
        }
        if (property.isActive === false) {
            throw new common_1.UnprocessableEntityException({ code: 'LISTING_HIDDEN', message: 'Remettez l’annonce en ligne avant de la booster.' });
        }
        const active = await this.activeBoostFor(req.propertyId);
        if (active) {
            throw new common_1.ConflictException({
                code: 'ALREADY_BOOSTED',
                message: 'Cette annonce est déjà boostée.',
                endsAt: active.endDate,
            });
        }
        const amount = this.listingBoosts.getBoostPricing(req.boostType, Number(req.duration));
        return {
            ...base,
            amount,
            key: `boost:${req.propertyId}`,
            purchase: {
                label: `Boost ${req.boostType} · ${Number(req.duration) / 24} j · ${property.title ?? ''}`.trim(),
                propertyId: String(req.propertyId),
                propertyTitle: property.title,
                boostType: req.boostType,
                duration: Number(req.duration),
            },
        };
    }
    async quoteView(userId, req) {
        const q = await this.quote(userId, req);
        const wallet = await this.wallets.findOne({ userId: new mongoose_2.Types.ObjectId(userId) }).select('balance').lean();
        const walletBalance = Math.max(0, Math.floor(wallet?.balance ?? 0));
        let planBoostsLeft = 0;
        if (req.purpose === 'boost') {
            const sub = await this.subscriptions.getUserSubscription(userId);
            if (sub) {
                const limit = sub.features?.boostsPerMonth ?? 0;
                planBoostsLeft = limit === -1 ? -1 : Math.max(0, limit - (sub.boostsUsed ?? 0));
            }
        }
        return {
            purpose: req.purpose,
            amount: q.amount,
            currency: 'XAF',
            label: q.purchase.label ?? '',
            purchase: q.purchase,
            walletBalance,
            canUseWallet: walletBalance >= q.amount && q.amount > 0,
            planBoostsLeft,
            canUsePlanCredit: req.purpose === 'boost' && planBoostsLeft !== 0,
        };
    }
    async chargeWallet(userId, amount, label, reference) {
        try {
            await this.walletService.debitWallet(userId, amount, `Paiement : ${label}`, reference);
        }
        catch (err) {
            if (err?.status === 404 || /insufficient/i.test(String(err?.message))) {
                throw new common_1.UnprocessableEntityException({ code: 'WALLET_TOO_LOW', message: 'Solde du portefeuille insuffisant.' });
            }
            throw err;
        }
    }
    async refundWallet(userId, amount, label, reference) {
        await this.walletService.creditWallet(userId, amount, `Remboursement : ${label}`, reference);
        await this.wallets.updateOne({ userId: new mongoose_2.Types.ObjectId(userId) }, { $inc: { totalEarned: -amount } });
    }
    async usePlanBoost(userId) {
        const sub = await this.subscriptions.getUserSubscription(userId);
        if (!sub)
            return false;
        const limit = sub.features?.boostsPerMonth ?? 0;
        if (limit === 0)
            return false;
        const filter = { _id: sub._id, status: sub.status };
        if (limit !== -1)
            filter.boostsUsed = { $lt: limit };
        const res = await this.subscriptionDocs.updateOne(filter, { $inc: { boostsUsed: 1 } });
        return res.modifiedCount === 1;
    }
    async releasePlanBoost(userId) {
        const sub = await this.subscriptions.getUserSubscription(userId);
        if (sub)
            await this.subscriptionDocs.updateOne({ _id: sub._id, boostsUsed: { $gt: 0 } }, { $inc: { boostsUsed: -1 } });
    }
    async activate(payment, save) {
        const purchase = { ...(payment.purchase ?? {}) };
        const userId = String(payment.userId);
        let tx = purchase.transactionId ? await this.transactions.findById(purchase.transactionId) : null;
        if (payment.purpose === 'subscription') {
            if (tx?.subscriptionId)
                return { result: 'already_done', purchase };
            if (!tx) {
                tx = await this.transactions.create({
                    userId: payment.userId,
                    amount: payment.amount,
                    currency: transaction_schema_1.Currency.XAF,
                    type: transaction_schema_1.TransactionType.SUBSCRIPTION,
                    status: transaction_schema_1.TransactionStatus.SUCCESS,
                    paymentMethod: this.methodOf(payment),
                    flutterwaveReference: payment.merchantInvoiceId,
                    description: `Subscription: ${purchase.label ?? purchase.planName}`,
                    metadata: { planName: purchase.planName, billingCycle: purchase.billingCycle, checkoutPaymentId: String(payment._id) },
                    platformFee: payment.amount,
                    paymentProcessingFee: 0,
                    netAmount: payment.amount,
                    completedAt: payment.paidAt ?? new Date(),
                });
                purchase.transactionId = String(tx._id);
                await save(purchase);
            }
            const sub = await this.subscriptions.activateSubscription(String(tx._id));
            purchase.subscriptionId = String(sub._id);
            purchase.endsAt = sub.endDate;
            return { result: 'activated', purchase };
        }
        if (purchase.boostId) {
            const b = await this.boosts.findById(purchase.boostId).lean();
            if (b?.status === listing_boost_schema_1.BoostStatus.ACTIVE)
                return { result: 'already_done', purchase: { ...purchase, endsAt: b.endDate } };
        }
        let boostId = purchase.boostId;
        if (!boostId) {
            try {
                const { boost } = await this.listingBoosts.createBoostRequest(userId, {
                    propertyId: purchase.propertyId,
                    boostType: purchase.boostType,
                    duration: purchase.duration,
                });
                boostId = String(boost._id);
                purchase.boostId = boostId;
                await save(purchase);
            }
            catch (err) {
                return { result: 'not_possible', purchase, reason: String(err?.message ?? err) };
            }
        }
        if (!tx) {
            tx = await this.transactions.create({
                userId: payment.userId,
                amount: payment.amount,
                currency: transaction_schema_1.Currency.XAF,
                type: transaction_schema_1.TransactionType.BOOST_LISTING,
                status: transaction_schema_1.TransactionStatus.SUCCESS,
                paymentMethod: this.methodOf(payment),
                flutterwaveReference: payment.merchantInvoiceId,
                propertyId: new mongoose_2.Types.ObjectId(purchase.propertyId),
                boostId: new mongoose_2.Types.ObjectId(boostId),
                description: `Listing boost: ${purchase.boostType} (${purchase.duration}h)`,
                metadata: {
                    boostType: purchase.boostType,
                    duration: purchase.duration,
                    propertyTitle: purchase.propertyTitle,
                    includedInPlan: payment.method === 'plan_credit',
                    checkoutPaymentId: String(payment._id),
                },
                platformFee: payment.amount,
                paymentProcessingFee: 0,
                netAmount: payment.amount,
                completedAt: payment.paidAt ?? new Date(),
            });
            purchase.transactionId = String(tx._id);
            await save(purchase);
        }
        const boost = await this.listingBoosts.activateBoost(String(tx._id));
        purchase.endsAt = boost.endDate;
        return { result: 'activated', purchase };
    }
    async activeBoostFor(propertyId) {
        return this.boosts
            .findOne({ propertyId: new mongoose_2.Types.ObjectId(propertyId), status: listing_boost_schema_1.BoostStatus.ACTIVE, endDate: { $gte: new Date() } })
            .select('endDate boostType')
            .lean();
    }
    methodOf(payment) {
        if (payment.method === 'card')
            return transaction_schema_1.PaymentMethod.CARD;
        if (payment.method === 'wallet' || payment.method === 'plan_credit')
            return transaction_schema_1.PaymentMethod.WALLET;
        return payment.operator === 'orange_money' ? transaction_schema_1.PaymentMethod.ORANGE_MONEY : transaction_schema_1.PaymentMethod.MTN_MOMO;
    }
};
exports.PurchaseGateway = PurchaseGateway;
exports.PurchaseGateway = PurchaseGateway = PurchaseGateway_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(transaction_schema_1.Transaction.name)),
    __param(1, (0, mongoose_1.InjectModel)(listing_boost_schema_1.ListingBoost.name)),
    __param(2, (0, mongoose_1.InjectModel)(property_schema_1.Property.name)),
    __param(3, (0, mongoose_1.InjectModel)(user_schema_1.User.name)),
    __param(4, (0, mongoose_1.InjectModel)(wallet_schema_1.Wallet.name)),
    __param(5, (0, mongoose_1.InjectModel)(subscription_schema_1.Subscription.name)),
    __param(6, (0, common_1.Inject)((0, common_1.forwardRef)(() => subscriptions_service_1.SubscriptionsService))),
    __param(7, (0, common_1.Inject)((0, common_1.forwardRef)(() => listing_boost_service_1.ListingBoostService))),
    __param(8, (0, common_1.Inject)((0, common_1.forwardRef)(() => wallet_service_1.WalletService))),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model,
        subscriptions_service_1.SubscriptionsService,
        listing_boost_service_1.ListingBoostService,
        wallet_service_1.WalletService])
], PurchaseGateway);
//# sourceMappingURL=purchase.gateway.js.map