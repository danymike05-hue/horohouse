import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  forwardRef,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model, Types } from 'mongoose';
import {
  Currency,
  PaymentMethod,
  Transaction,
  TransactionDocument,
  TransactionStatus,
  TransactionType,
} from '../payments/schemas/transaction.schema';
import { BoostStatus, BoostType, ListingBoost, ListingBoostDocument } from '../payments/schemas/listing-boost.schema';
import { Wallet, WalletDocument } from '../payments/schemas/wallet.schema';
import { Subscription, SubscriptionDocument } from '../payments/schemas/subscription.schema';
import { SubscriptionsService } from '../payments/services/subscriptions.service';
import { ListingBoostService } from '../payments/services/listing-boost.service';
import { WalletService } from '../payments/services/wallet.service';
import { Property, PropertyDocument } from '../properties/schemas/property.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { BookingChangesService } from '../booking-changes/booking-changes.service';
import { normalizeCmPhone } from './momo.util';
import type { CheckoutPaymentDocument, CheckoutPurchase, CheckoutPurpose } from './schemas/checkout-payment.schema';

/** The boost types the app sells (getBoostOptions only prices these) */
const SOLD_BOOSTS: string[] = [BoostType.STANDARD, BoostType.FEATURED, BoostType.HOMEPAGE, BoostType.SOCIAL_MEDIA];
const DURATIONS = [24, 168, 720];

export interface PurchaseRequest {
  purpose: Exclude<CheckoutPurpose, 'booking'>;
  changeId?: string;
  planName?: string;
  billingCycle?: 'monthly' | 'quarterly' | 'yearly';
  propertyId?: string;
  boostType?: string;
  duration?: number;
}

export interface PurchaseQuote {
  amount: number;
  purchase: CheckoutPurchase;
  /** One pending attempt per subscription / per listing */
  key: string;
  customerName?: string;
  /** Profile phone (9 local digits), used for card payments */
  customerPhone?: string;
}

export interface QuoteView {
  purpose: 'subscription' | 'boost' | 'date_change';
  amount: number;
  currency: 'XAF';
  label: string;
  purchase: CheckoutPurchase;
  /** Wallet balance; the wallet row is shown when it covers the amount */
  walletBalance: number;
  canUseWallet: boolean;
  /** Free boosts left in the host's plan this month (-1 = unlimited) */
  planBoostsLeft: number;
  canUsePlanCredit: boolean;
}

export type PurchaseResult = 'activated' | 'already_done' | 'not_possible';

/**
 * Subscriptions and listing boosts through checkout. Prices come from the plans in the
 * database (SubscriptionsService) and BOOST_PRICING (ListingBoostService) — never from the
 * app. Activation reuses activateSubscription / activateBoost, which expect a SUCCESS
 * Transaction, so payment history and admin revenue keep working.
 */
@Injectable()
export class PurchaseGateway {
  private readonly logger = new Logger(PurchaseGateway.name);

  constructor(
    @InjectModel(Transaction.name) private readonly transactions: Model<TransactionDocument>,
    @InjectModel(ListingBoost.name) private readonly boosts: Model<ListingBoostDocument>,
    @InjectModel(Property.name) private readonly properties: Model<PropertyDocument>,
    @InjectModel(User.name) private readonly users: Model<UserDocument>,
    @InjectModel(Wallet.name) private readonly wallets: Model<WalletDocument>,
    @InjectModel(Subscription.name) private readonly subscriptionDocs: Model<SubscriptionDocument>,
    @Inject(forwardRef(() => SubscriptionsService)) private readonly subscriptions: SubscriptionsService,
    @Inject(forwardRef(() => ListingBoostService)) private readonly listingBoosts: ListingBoostService,
    @Inject(forwardRef(() => WalletService)) private readonly walletService: WalletService,
    @Inject(forwardRef(() => BookingChangesService)) private readonly dateChanges: BookingChangesService,
  ) {}

  // ───────────────────────────────────────────────────────────────────────────
  // Pricing
  // ───────────────────────────────────────────────────────────────────────────

  async quote(userId: string, req: PurchaseRequest): Promise<PurchaseQuote> {
    const user: any = await this.users.findById(userId).select('name phoneNumber').lean();
    if (!user) throw new NotFoundException('Compte introuvable.');
    const local = normalizeCmPhone(user.phoneNumber);
    const base = { customerName: user.name, customerPhone: local ?? undefined };

    if (req.purpose === 'date_change') {
      if (!req.changeId || !isValidObjectId(req.changeId)) throw new BadRequestException('Demande invalide.');
      const { change, title } = await this.dateChanges.payable(userId, req.changeId);
      return {
        ...base,
        amount: change.amountDue,
        key: `change:${req.changeId}`,
        purchase: {
          label: title,
          propertyTitle: title,
          changeId: req.changeId,
          bookingId: String(change.bookingId),
          checkIn: change.checkIn,
          checkOut: change.checkOut,
        },
      };
    }

    if (req.purpose === 'subscription') {
      const plans: any[] = await this.subscriptions.getPlans();
      const plan = plans.find((p) => p.name === req.planName);
      if (!plan) throw new NotFoundException({ code: 'PLAN_NOT_FOUND', message: 'Cette formule n’existe plus.' });
      const cycle = req.billingCycle ?? 'monthly';
      const amount = Number(plan.pricing?.[cycle] ?? 0);
      if (!(amount > 0)) {
        throw new UnprocessableEntityException({ code: 'PLAN_NOT_PAYABLE', message: 'Cette formule n’est pas payante pour cette période.' });
      }
      // Activating cancels the current plan and starts a new one today, so paying again for
      // the same plan would throw away the time left on it
      const current = await this.subscriptions.getUserSubscription(userId);
      if (current && current.plan === plan.name && current.billingCycle === cycle) {
        throw new ConflictException({ code: 'ALREADY_ON_PLAN', message: 'Vous avez déjà cette formule.' });
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

    // Boost
    if (!req.propertyId || !isValidObjectId(req.propertyId)) throw new BadRequestException('Annonce invalide.');
    if (!req.boostType || !SOLD_BOOSTS.includes(req.boostType)) {
      throw new BadRequestException({ code: 'INVALID_BOOST', message: 'Ce type de boost n’existe pas.' });
    }
    if (!req.duration || !DURATIONS.includes(Number(req.duration))) {
      throw new BadRequestException({ code: 'INVALID_DURATION', message: 'Durée de boost invalide.' });
    }
    const property: any = await this.properties.findById(req.propertyId).select('title ownerId agentId isActive').lean();
    if (!property) throw new NotFoundException('Annonce introuvable.');
    if (String(property.ownerId) !== String(userId) && String(property.agentId ?? '') !== String(userId)) {
      throw new ForbiddenException({ code: 'NOT_YOUR_LISTING', message: 'Vous ne pouvez booster que vos propres annonces.' });
    }
    if (property.isActive === false) {
      throw new UnprocessableEntityException({ code: 'LISTING_HIDDEN', message: 'Remettez l’annonce en ligne avant de la booster.' });
    }
    const active = await this.activeBoostFor(req.propertyId);
    if (active) {
      throw new ConflictException({
        code: 'ALREADY_BOOSTED',
        message: 'Cette annonce est déjà boostée.',
        endsAt: active.endDate,
      });
    }
    const amount = this.listingBoosts.getBoostPricing(req.boostType as BoostType, Number(req.duration));
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

  /** For the payment screen: price + which ways to pay apply */
  async quoteView(userId: string, req: PurchaseRequest): Promise<QuoteView> {
    const q = await this.quote(userId, req);
    const wallet: any = await this.wallets.findOne({ userId: new Types.ObjectId(userId) }).select('balance').lean();
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
      canUseWallet: req.purpose !== 'date_change' && walletBalance >= q.amount && q.amount > 0,
      planBoostsLeft,
      canUsePlanCredit: req.purpose === 'boost' && planBoostsLeft !== 0,
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Paying without CamerPay
  // ───────────────────────────────────────────────────────────────────────────

  /** Takes the amount from the wallet (atomic; fails if the balance is too low) */
  async chargeWallet(userId: string, amount: number, label: string, reference: string): Promise<void> {
    try {
      await this.walletService.debitWallet(userId, amount, `Paiement : ${label}`, reference);
    } catch (err: any) {
      if (err?.status === 404 || /insufficient/i.test(String(err?.message))) {
        throw new UnprocessableEntityException({ code: 'WALLET_TOO_LOW', message: 'Solde du portefeuille insuffisant.' });
      }
      throw err;
    }
  }

  /** Gives a wallet payment back when activation could not happen */
  async refundWallet(userId: string, amount: number, label: string, reference: string): Promise<void> {
    await this.walletService.creditWallet(userId, amount, `Remboursement : ${label}`, reference);
    // A refund is not income
    await this.wallets.updateOne({ userId: new Types.ObjectId(userId) }, { $inc: { totalEarned: -amount } });
  }

  /** Reserves one of the plan's free boosts; false when none are left */
  async usePlanBoost(userId: string): Promise<boolean> {
    const sub = await this.subscriptions.getUserSubscription(userId);
    if (!sub) return false;
    const limit = sub.features?.boostsPerMonth ?? 0;
    if (limit === 0) return false;
    // Atomic, so two taps can't both use the last free boost
    const filter: any = { _id: sub._id, status: sub.status };
    if (limit !== -1) filter.boostsUsed = { $lt: limit };
    const res = await this.subscriptionDocs.updateOne(filter, { $inc: { boostsUsed: 1 } });
    return res.modifiedCount === 1;
  }

  async releasePlanBoost(userId: string): Promise<void> {
    const sub = await this.subscriptions.getUserSubscription(userId);
    if (sub) await this.subscriptionDocs.updateOne({ _id: sub._id, boostsUsed: { $gt: 0 } }, { $inc: { boostsUsed: -1 } });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Fulfilment (called once per paid checkout, under CheckoutService's lock)
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * `save` stores progress (Transaction id, boost id) on the checkout row right away, so a
   * crash half-way never creates a second Transaction or boost on retry.
   */
  async activate(
    payment: CheckoutPaymentDocument,
    save: (p: CheckoutPurchase) => Promise<void>,
  ): Promise<{ result: PurchaseResult; purchase: CheckoutPurchase; reason?: string }> {
    const purchase: CheckoutPurchase = { ...(payment.purchase ?? {}) };
    const userId = String(payment.userId);

    if (payment.purpose === 'date_change') {
      const outcome = await this.dateChanges.applyPaid(String(purchase.changeId), {
        amount: payment.amount,
        providerReference: payment.providerReference,
        merchantInvoiceId: payment.merchantInvoiceId,
        paymentMethod: this.methodOf(payment),
        paidAt: payment.paidAt,
        checkoutPaymentId: String(payment._id),
      });
      if (!outcome.ok) return { result: 'not_possible', purchase, reason: outcome.reason };
      return { result: 'activated', purchase: { ...purchase, endsAt: outcome.checkOut } };
    }

    // Retry after a crash: the Transaction exists already
    let tx: TransactionDocument | null = purchase.transactionId ? await this.transactions.findById(purchase.transactionId) : null;

    if (payment.purpose === 'subscription') {
      if (tx?.subscriptionId) return { result: 'already_done', purchase };
      if (!tx) {
        tx = await this.transactions.create({
          userId: payment.userId,
          amount: payment.amount,
          currency: Currency.XAF,
          type: TransactionType.SUBSCRIPTION,
          status: TransactionStatus.SUCCESS,
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
      const sub: any = await this.subscriptions.activateSubscription(String(tx._id));
      purchase.subscriptionId = String(sub._id);
      purchase.endsAt = sub.endDate;
      return { result: 'activated', purchase };
    }

    // Boost
    if (purchase.boostId) {
      const b: any = await this.boosts.findById(purchase.boostId).lean();
      if (b?.status === BoostStatus.ACTIVE) return { result: 'already_done', purchase: { ...purchase, endsAt: b.endDate } };
    }
    let boostId = purchase.boostId;
    if (!boostId) {
      try {
        // Same checks as POST /boosts (ownership, no other active boost)
        const { boost } = await this.listingBoosts.createBoostRequest(userId, {
          propertyId: purchase.propertyId,
          boostType: purchase.boostType,
          duration: purchase.duration,
        } as any);
        boostId = String((boost as any)._id);
        purchase.boostId = boostId;
        await save(purchase);
      } catch (err: any) {
        // e.g. another boost went live on this listing while this one was being paid
        return { result: 'not_possible', purchase, reason: String(err?.message ?? err) };
      }
    }
    if (!tx) {
      tx = await this.transactions.create({
        userId: payment.userId,
        amount: payment.amount,
        currency: Currency.XAF,
        type: TransactionType.BOOST_LISTING,
        status: TransactionStatus.SUCCESS,
        paymentMethod: this.methodOf(payment),
        flutterwaveReference: payment.merchantInvoiceId,
        propertyId: new Types.ObjectId(purchase.propertyId),
        boostId: new Types.ObjectId(boostId),
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
    const boost: any = await this.listingBoosts.activateBoost(String(tx._id));
    purchase.endsAt = boost.endDate;
    return { result: 'activated', purchase };
  }

  /** Whether this listing has a boost running now */
  async activeBoostFor(propertyId: string): Promise<{ endDate?: Date } | null> {
    return this.boosts
      .findOne({ propertyId: new Types.ObjectId(propertyId), status: BoostStatus.ACTIVE, endDate: { $gte: new Date() } })
      .select('endDate boostType')
      .lean() as any;
  }

  private methodOf(payment: CheckoutPaymentDocument): PaymentMethod {
    if (payment.method === 'card') return PaymentMethod.CARD;
    if (payment.method === 'wallet' || payment.method === 'plan_credit') return PaymentMethod.WALLET;
    return payment.operator === 'orange_money' ? PaymentMethod.ORANGE_MONEY : PaymentMethod.MTN_MOMO;
  }
}
