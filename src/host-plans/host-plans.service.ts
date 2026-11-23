// Everything a hosting plan changes in the app goes through here: the limits (listings,
// co-hosts, scheduled messages, smart pricing, AI writer), the extras (welcome boost,
// payout hold, support tier, badge) and the growth offers (free trial, founding hosts,
// referrals). Plans themselves are paid through checkout; see SubscriptionsService.
import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { randomBytes } from 'crypto';
import { Model, Types } from 'mongoose';
import { Subscription, SubscriptionDocument, SubscriptionStatus } from '../payments/schemas/subscription.schema';
import { SubscriptionPlanModel, SubscriptionPlanDocument } from '../payments/schemas/subscription-plan.schema';
import { Property, PropertyDocument } from '../properties/schemas/property.schema';
import { CoHost, CoHostDocument } from '../co-hosts/schemas/co-host.schema';
import { HostMessageTemplate, HostMessageTemplateDocument, TemplateKind } from '../host-messages/schemas/host-message.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { Booking, BookingDocument } from '../bookings/schema/booking.schema';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/schemas/notification.schema';
import {
  FOUNDING_DAYS, FOUNDING_PLAN, FOUNDING_SPOTS, HOST_PLAN_ORDER, HostPlanName, HostTier, isHostPlanName,
  REFERRAL_DAYS, REFERRAL_MAX_REWARDS, REFERRAL_PLAN, tierOf, TRIAL_DAYS, TRIAL_PLANS, within,
} from './host-plan-tiers';
import { HostPlanCounter, HostPlanCounterDocument, HostPlanState, HostPlanStateDocument } from './schemas/host-plan-state.schema';

export type LimitResource = 'listings' | 'co_hosts' | 'scheduled_messages' | 'promo_codes' | 'ai_writer' | 'smart_pricing' | 'insights';

/** 403 the app turns into "Upgrade to …" */
export class PlanLimitException extends ForbiddenException {
  constructor(resource: LimitResource, limit: number, plan: string, message: string) {
    super({ code: 'PLAN_LIMIT', resource, limit, plan, message });
  }
}

export type PlanChangeKind = 'new' | 'upgrade' | 'renew' | 'downgrade';
export interface PlanChange {
  kind: PlanChangeKind;
  /** Value left on the current paid plan, taken off an upgrade */
  credit: number;
  price: number;
  amount: number;
  startsAt: Date;
}

const DAY = 86_400_000;
const MIN_CHARGE = 500;
const PAID_LIKE = ['paid', 'trial', 'founding', 'referral'];
const monthKey = (d = new Date()) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
const cycleDays = (cycle: string) => (cycle === 'yearly' ? 365 : cycle === 'quarterly' ? 91 : cycle === 'weekly' ? 7 : 30);
const addCycle = (from: Date, cycle: string) => {
  const d = new Date(from);
  if (cycle === 'yearly') d.setFullYear(d.getFullYear() + 1);
  else if (cycle === 'quarterly') d.setMonth(d.getMonth() + 3);
  else if (cycle === 'weekly') d.setDate(d.getDate() + 7);
  else d.setMonth(d.getMonth() + 1);
  return d;
};

@Injectable()
export class HostPlansService {
  private readonly logger = new Logger(HostPlansService.name);

  constructor(
    @InjectModel(Subscription.name) private readonly subs: Model<SubscriptionDocument>,
    @InjectModel(SubscriptionPlanModel.name) private readonly plans: Model<SubscriptionPlanDocument>,
    @InjectModel(HostPlanState.name) private readonly states: Model<HostPlanStateDocument>,
    @InjectModel(HostPlanCounter.name) private readonly counters: Model<HostPlanCounterDocument>,
    @InjectModel(Property.name) private readonly properties: Model<PropertyDocument>,
    @InjectModel(CoHost.name) private readonly coHosts: Model<CoHostDocument>,
    @InjectModel(HostMessageTemplate.name) private readonly templates: Model<HostMessageTemplateDocument>,
    @InjectModel(User.name) private readonly users: Model<UserDocument>,
    @InjectModel(Booking.name) private readonly bookings: Model<BookingDocument>,
    private readonly notifications: NotificationsService,
  ) {}

  // ── The plan a host is on ────────────────────────────────────────────────────

  /** The host's running plan (a due scheduled one takes over here, not only at midnight) */
  async activeSubscription(userId: string): Promise<SubscriptionDocument | null> {
    const uid = new Types.ObjectId(userId);
    const now = new Date();
    const active = await this.subs
      .findOne({ userId: uid, status: SubscriptionStatus.ACTIVE, $or: [{ endDate: { $gt: now } }, { endDate: null }] })
      .sort({ createdAt: -1 });
    if (active) return active;
    const due = await this.subs.findOneAndUpdate(
      { userId: uid, status: SubscriptionStatus.SCHEDULED, startDate: { $lte: now }, endDate: { $gt: now } },
      { $set: { status: SubscriptionStatus.ACTIVE } },
      { new: true, sort: { startDate: 1 } },
    );
    if (due) await this.syncBadge(userId).catch(() => undefined);
    return due;
  }

  async scheduledSubscription(userId: string): Promise<SubscriptionDocument | null> {
    return this.subs.findOne({ userId: new Types.ObjectId(userId), status: SubscriptionStatus.SCHEDULED }).sort({ startDate: 1 });
  }

  async planOf(userId: string): Promise<{ plan: HostPlanName; tier: HostTier; sub: SubscriptionDocument | null }> {
    const sub = await this.activeSubscription(userId);
    const plan: HostPlanName = sub && isHostPlanName(sub.plan) ? sub.plan : 'host_free';
    return { plan, tier: tierOf(plan), sub };
  }

  private async state(userId: string): Promise<HostPlanStateDocument> {
    return this.states.findOneAndUpdate(
      { userId: new Types.ObjectId(userId) },
      { $setOnInsert: { userId: new Types.ObjectId(userId) } },
      { upsert: true, new: true },
    ) as any;
  }

  private nameOf(plan: HostPlanName) {
    return { host_free: 'Free', host_starter: 'Starter', host_growth: 'Growth', host_pro: 'Pro', host_elite: 'Elite' }[plan];
  }

  /** The cheapest plan that lifts a limit, for the "Upgrade to …" message */
  private nextPlanFor(current: HostPlanName, ok: (t: HostTier) => boolean): HostPlanName | null {
    for (const p of HOST_PLAN_ORDER.slice(HOST_PLAN_ORDER.indexOf(current) + 1)) if (ok(tierOf(p))) return p;
    return null;
  }

  private limitError(resource: LimitResource, limit: number, plan: HostPlanName, ok: (t: HostTier) => boolean, what: string) {
    const next = this.nextPlanFor(plan, ok);
    const msg = next
      ? `Your ${this.nameOf(plan)} plan includes ${what}. Upgrade to ${this.nameOf(next)} for more.`
      : `You've reached the most your plan allows (${what}).`;
    return new PlanLimitException(resource, limit, next ?? plan, msg);
  }

  // ── Limits ───────────────────────────────────────────────────────────────────

  async listingCount(userId: string): Promise<number> {
    return this.properties.countDocuments({ ownerId: new Types.ObjectId(userId), approvalStatus: { $ne: 'rejected' } });
  }

  async assertCanAddListing(userId: string): Promise<void> {
    const { plan, tier } = await this.planOf(userId);
    if (tier.maxListings === -1) return;
    const used = await this.listingCount(userId);
    if (used >= tier.maxListings) {
      throw this.limitError('listings', tier.maxListings, plan, (t) => t.maxListings === -1 || t.maxListings > used, `${tier.maxListings} listings`);
    }
  }

  async coHostCount(ownerId: string): Promise<number> {
    const ids = await this.properties.find({ ownerId: new Types.ObjectId(ownerId) }).distinct('_id');
    return this.coHosts.countDocuments({ propertyId: { $in: ids }, open: true });
  }

  async assertCanAddCoHost(ownerId: string): Promise<void> {
    const { plan, tier } = await this.planOf(ownerId);
    if (tier.maxCoHosts === -1) return;
    const used = await this.coHostCount(ownerId);
    if (used >= tier.maxCoHosts) {
      throw this.limitError('co_hosts', tier.maxCoHosts, plan, (t) => t.maxCoHosts === -1 || t.maxCoHosts > used, `${tier.maxCoHosts} co-host${tier.maxCoHosts === 1 ? '' : 's'}`);
    }
  }

  async scheduledCount(userId: string): Promise<number> {
    return this.templates.countDocuments({ hostId: new Types.ObjectId(userId), kind: TemplateKind.SCHEDULED });
  }

  async assertCanAddScheduled(userId: string): Promise<void> {
    const { plan, tier } = await this.planOf(userId);
    if (tier.maxScheduledMessages === -1) return;
    const used = await this.scheduledCount(userId);
    if (used >= tier.maxScheduledMessages) {
      throw this.limitError('scheduled_messages', tier.maxScheduledMessages, plan, (t) => t.maxScheduledMessages === -1 || t.maxScheduledMessages > used, `${tier.maxScheduledMessages} automatic messages`);
    }
  }

  async assertPromoCodes(userId: string): Promise<void> {
    const { plan, tier } = await this.planOf(userId);
    if (!tier.promoCodes) throw this.limitError('promo_codes', 0, plan, (t) => t.promoCodes, 'no promo codes');
  }

  async canUsePromoCodes(userId: string): Promise<boolean> {
    return (await this.planOf(userId)).tier.promoCodes;
  }

  /** Smart pricing covers the owner's oldest listings, up to the plan's number */
  async smartPricingFor(ownerId: string, propertyId: string): Promise<{ allowed: boolean; limit: number; plan: HostPlanName }> {
    const { plan, tier } = await this.planOf(ownerId);
    if (tier.smartPricingListings === -1) return { allowed: true, limit: -1, plan };
    if (tier.smartPricingListings === 0) return { allowed: false, limit: 0, plan };
    const first = await this.properties
      .find({ ownerId: new Types.ObjectId(ownerId), approvalStatus: { $ne: 'rejected' } })
      .sort({ createdAt: 1 })
      .limit(tier.smartPricingListings)
      .distinct('_id');
    return { allowed: first.some((id) => String(id) === String(propertyId)), limit: tier.smartPricingListings, plan };
  }

  /** Takes one AI writer use; call giveBackAiWriter if the writing then fails */
  async takeAiWriter(userId: string): Promise<{ remaining: number }> {
    const { plan, tier } = await this.planOf(userId);
    if (tier.aiWriterLimit === -1) return { remaining: -1 };
    const uid = new Types.ObjectId(userId);
    await this.state(userId);
    if (tier.aiWriterPeriod === 'lifetime') {
      const row = await this.states.findOneAndUpdate(
        { userId: uid, aiWriterLifetime: { $lt: tier.aiWriterLimit } },
        { $inc: { aiWriterLifetime: 1 } },
        { new: true },
      );
      if (!row) throw this.limitError('ai_writer', tier.aiWriterLimit, plan, (t) => t.aiWriterLimit === -1 || t.aiWriterPeriod === 'month', `${tier.aiWriterLimit} free AI writes`);
      return { remaining: tier.aiWriterLimit - row.aiWriterLifetime };
    }
    const month = monthKey();
    // A new month starts the count again
    await this.states.updateOne({ userId: uid, aiWriterMonth: { $ne: month } }, { $set: { aiWriterMonth: month, aiWriterMonthUses: 0 } });
    const row = await this.states.findOneAndUpdate(
      { userId: uid, aiWriterMonth: month, aiWriterMonthUses: { $lt: tier.aiWriterLimit } },
      { $inc: { aiWriterMonthUses: 1 } },
      { new: true },
    );
    if (!row) throw this.limitError('ai_writer', tier.aiWriterLimit, plan, (t) => t.aiWriterLimit === -1 || t.aiWriterLimit > tier.aiWriterLimit, `${tier.aiWriterLimit} AI writes a month`);
    return { remaining: tier.aiWriterLimit - row.aiWriterMonthUses };
  }

  async giveBackAiWriter(userId: string): Promise<void> {
    const { tier } = await this.planOf(userId);
    if (tier.aiWriterLimit === -1) return;
    const field = tier.aiWriterPeriod === 'lifetime' ? 'aiWriterLifetime' : 'aiWriterMonthUses';
    await this.states.updateOne({ userId: new Types.ObjectId(userId), [field]: { $gt: 0 } }, { $inc: { [field]: -1 } });
  }

  async payoutHoldHours(hostId: string): Promise<number> {
    try {
      return (await this.planOf(hostId)).tier.payoutHoldHours;
    } catch {
      return 24;
    }
  }

  async supportTier(userId: string): Promise<HostTier['support']> {
    return (await this.planOf(userId)).tier.support;
  }

  /** Support inbox: the tier of many people at once */
  async supportTiers(userIds: string[]): Promise<Record<string, HostTier['support']>> {
    const ids = [...new Set(userIds.filter((x) => Types.ObjectId.isValid(x)))].map((x) => new Types.ObjectId(x));
    const now = new Date();
    const rows = await this.subs
      .find({ userId: { $in: ids }, status: SubscriptionStatus.ACTIVE, endDate: { $gt: now } })
      .select('userId plan')
      .lean();
    const out: Record<string, HostTier['support']> = {};
    for (const r of rows) {
      const t = tierOf(r.plan).support;
      const prev = out[String(r.userId)];
      if (!prev || t === 'dedicated' || (t === 'priority' && prev === 'standard')) out[String(r.userId)] = t;
    }
    return out;
  }

  // ── Free plan's welcome boost ────────────────────────────────────────────────

  async welcomeBoostLeft(userId: string): Promise<boolean> {
    const { tier } = await this.planOf(userId);
    if (!tier.welcomeBoost) return false;
    const st: any = await this.states.findOne({ userId: new Types.ObjectId(userId) }).select('welcomeBoostUsedAt').lean();
    return !st?.welcomeBoostUsedAt;
  }

  async takeWelcomeBoost(userId: string): Promise<boolean> {
    if (!(await this.welcomeBoostLeft(userId))) return false;
    await this.state(userId);
    const res = await this.states.updateOne(
      { userId: new Types.ObjectId(userId), welcomeBoostUsedAt: { $exists: false } },
      { $set: { welcomeBoostUsedAt: new Date() } },
    );
    return res.modifiedCount === 1;
  }

  async giveBackWelcomeBoost(userId: string): Promise<void> {
    await this.states.updateOne({ userId: new Types.ObjectId(userId) }, { $unset: { welcomeBoostUsedAt: 1 } });
  }

  // ── Changing plan ────────────────────────────────────────────────────────────

  async priceOf(plan: string, cycle: string): Promise<number> {
    const doc: any = await this.plans.findOne({ name: plan }).select('pricing').lean();
    return Number(doc?.pricing?.[cycle] ?? 0) || 0;
  }

  /** What's left of a paid plan, in XAF */
  creditOf(sub: SubscriptionDocument | null, at = new Date()): number {
    if (!sub || !(sub.price > 0) || !sub.startDate || !sub.endDate) return 0;
    const total = sub.endDate.getTime() - sub.startDate.getTime();
    const left = sub.endDate.getTime() - at.getTime();
    if (total <= 0 || left <= 0) return 0;
    return Math.floor((sub.price * left) / total);
  }

  /**
   * What paying for a plan does: a higher plan starts now (with what's left of the current
   * one taken off), the same plan adds time after the current one, a lower one starts
   * when the current one ends.
   */
  async planChange(userId: string, planName: string, cycle: string): Promise<PlanChange> {
    if (!isHostPlanName(planName)) throw new BadRequestException('Unknown plan');
    const price = await this.priceOf(planName, cycle);
    if (!(price > 0)) throw new BadRequestException({ code: 'PLAN_NOT_PAYABLE', message: 'This plan cannot be paid for this period.' });
    const sub = await this.activeSubscription(userId);
    const now = new Date();
    if (!sub || !isHostPlanName(sub.plan)) return { kind: 'new', credit: 0, price, amount: price, startsAt: now };

    const scheduled = await this.scheduledSubscription(userId);
    const currentRank = HOST_PLAN_ORDER.indexOf(sub.plan);
    const newRank = HOST_PLAN_ORDER.indexOf(planName);
    const endsAt = sub.endDate ?? now;

    if (newRank > currentRank) {
      const credit = Math.min(this.creditOf(sub, now), price - MIN_CHARGE);
      return { kind: 'upgrade', credit: Math.max(0, credit), price, amount: Math.max(MIN_CHARGE, price - Math.max(0, credit)), startsAt: now };
    }
    if (scheduled) {
      throw new ConflictException({
        code: 'PLAN_ALREADY_PLANNED',
        message: `Your next plan is already set to start on ${scheduled.startDate?.toISOString().slice(0, 10)}.`,
      });
    }
    return { kind: newRank === currentRank ? 'renew' : 'downgrade', credit: 0, price, amount: price, startsAt: endsAt };
  }

  /**
   * Called once a plan is paid. Returns the new subscription; the previous one is ended
   * for an upgrade, kept running for a renewal or a downgrade.
   */
  async applyPaidPlan(params: {
    userId: string;
    planName: string;
    cycle: string;
    amountPaid: number;
    creditClaimed: number;
    transactionId: Types.ObjectId;
    currency?: string;
    features: any;
  }): Promise<SubscriptionDocument> {
    const { userId, planName, cycle } = params;
    const price = await this.priceOf(planName, cycle);
    const current = await this.activeSubscription(userId);
    const now = new Date();
    const rank = (p: string) => HOST_PLAN_ORDER.indexOf(p as HostPlanName);
    const isUp = !current || !isHostPlanName(current.plan) || rank(planName) > rank(current.plan);

    // An upgrade may be paid with less than the price: only as much less as the time left
    // on the current plan is worth (plus a day, since some time passed while paying)
    const creditNow = isUp && current ? this.creditOf(current, now) : 0;
    const dayValue = current && current.price > 0 ? Math.ceil(current.price / cycleDays(current.billingCycle)) : 0;
    const allowedCredit = Math.min(Math.max(0, params.creditClaimed), creditNow + dayValue);
    if (!(price > 0) || params.amountPaid < Math.max(MIN_CHARGE, price - allowedCredit)) {
      this.logger.error(`Plan ${planName}/${cycle} paid ${params.amountPaid}, costs ${price} (credit ${allowedCredit})`);
      throw new BadRequestException('Amount paid does not match the plan price');
    }

    const startDate = isUp ? now : current?.endDate && current.endDate > now ? current.endDate : now;
    const endDate = addCycle(startDate, cycle);
    if (isUp && current) {
      current.status = SubscriptionStatus.CANCELLED;
      current.cancelledAt = now;
      current.cancellationReason = `Moved to ${planName}`;
      await current.save();
    }
    const sub = await this.subs.create({
      userId: new Types.ObjectId(userId),
      plan: planName,
      status: startDate > now ? SubscriptionStatus.SCHEDULED : SubscriptionStatus.ACTIVE,
      billingCycle: cycle,
      price: params.amountPaid + allowedCredit,
      currency: params.currency ?? 'XAF',
      features: params.features,
      startDate,
      endDate,
      nextBillingDate: endDate,
      // Mobile Money can't be charged without the host: plans end, the host renews
      autoRenew: false,
      lastPaymentTransactionId: params.transactionId,
      lastPaymentDate: now,
      previousSubscriptionId: current?._id,
      upgradedFrom: current?.plan,
      metadata: { kind: 'paid', creditApplied: allowedCredit },
    });
    await this.syncBadge(userId).catch(() => undefined);
    return sub;
  }

  /** A plan given for free (trial, founding host, referral). A running plan is extended instead. */
  private async grant(userId: string, plan: HostPlanName, days: number, kind: 'trial' | 'founding' | 'referral'): Promise<SubscriptionDocument> {
    const now = new Date();
    const current = await this.activeSubscription(userId);
    if (current && isHostPlanName(current.plan) && current.plan !== 'host_free') {
      // Referral on top of a running plan: more time on it
      current.endDate = new Date((current.endDate ?? now).getTime() + days * DAY);
      current.nextBillingDate = current.endDate;
      current.metadata = { ...(current.metadata ?? {}), extendedBy: [...((current.metadata as any)?.extendedBy ?? []), { kind, days, at: now }] };
      current.markModified('metadata');
      await current.save();
      return current;
    }
    const planDoc: any = await this.plans.findOne({ name: plan }).select('features').lean();
    const sub = await this.subs.create({
      userId: new Types.ObjectId(userId),
      plan,
      status: SubscriptionStatus.ACTIVE,
      billingCycle: 'monthly',
      price: 0,
      currency: 'XAF',
      features: planDoc?.features ?? {},
      startDate: now,
      endDate: new Date(now.getTime() + days * DAY),
      autoRenew: false,
      metadata: { kind },
    });
    await this.syncBadge(userId).catch(() => undefined);
    return sub;
  }

  // ── Growth offers ────────────────────────────────────────────────────────────

  private async assertHost(userId: string): Promise<any> {
    const user: any = await this.users.findById(userId).select('role name').lean();
    if (!user) throw new NotFoundException('Account not found');
    if (!['host', 'admin'].includes(String(user.role))) throw new ForbiddenException('Hosting plans are for hosts');
    return user;
  }

  private async hadAnyHostPlan(userId: string): Promise<boolean> {
    return !!(await this.subs.exists({ userId: new Types.ObjectId(userId), plan: { $in: HOST_PLAN_ORDER.slice(1) } }));
  }

  async trialOffer(userId: string): Promise<{ eligible: boolean; days: number; plans: HostPlanName[] }> {
    const st: any = await this.states.findOne({ userId: new Types.ObjectId(userId) }).select('trialUsedAt').lean();
    const eligible = !st?.trialUsedAt && !(await this.hadAnyHostPlan(userId));
    return { eligible, days: TRIAL_DAYS, plans: TRIAL_PLANS };
  }

  async startTrial(userId: string, planName: string): Promise<SubscriptionDocument> {
    await this.assertHost(userId);
    if (!TRIAL_PLANS.includes(planName as HostPlanName)) throw new BadRequestException('The free month is for Starter or Growth');
    if (!(await this.trialOffer(userId)).eligible) throw new ConflictException({ code: 'TRIAL_USED', message: 'The free month is for hosts who never had a plan.' });
    await this.state(userId);
    const claimed = await this.states.updateOne(
      { userId: new Types.ObjectId(userId), trialUsedAt: { $exists: false } },
      { $set: { trialUsedAt: new Date(), trialPlan: planName } },
    );
    if (claimed.modifiedCount !== 1) throw new ConflictException({ code: 'TRIAL_USED', message: 'Your free month was already used.' });
    return this.grant(userId, planName as HostPlanName, TRIAL_DAYS, 'trial');
  }

  async foundingOffer(userId: string): Promise<{ eligible: boolean; spotsLeft: number; reason?: 'claimed' | 'full' | 'no_listing' | 'on_plan'; days: number }> {
    const counter: any = await this.counters.findById('founding').lean();
    const spotsLeft = Math.max(0, FOUNDING_SPOTS - (counter?.count ?? 0));
    const st: any = await this.states.findOne({ userId: new Types.ObjectId(userId) }).select('foundingClaimedAt').lean();
    const base = { spotsLeft, days: FOUNDING_DAYS };
    if (st?.foundingClaimedAt) return { ...base, eligible: false, reason: 'claimed' };
    if (spotsLeft <= 0) return { ...base, eligible: false, reason: 'full' };
    if ((await this.listingCount(userId)) === 0) return { ...base, eligible: false, reason: 'no_listing' };
    const sub = await this.activeSubscription(userId);
    if (sub && isHostPlanName(sub.plan) && sub.plan !== 'host_free') return { ...base, eligible: false, reason: 'on_plan' };
    return { ...base, eligible: true };
  }

  async claimFounding(userId: string): Promise<SubscriptionDocument> {
    await this.assertHost(userId);
    const offer = await this.foundingOffer(userId);
    if (!offer.eligible) {
      const msg = {
        claimed: 'You are already a founding host.',
        full: 'All founding host places are taken.',
        no_listing: 'Publish your first listing to claim it.',
        on_plan: 'Claim it when your current plan ends.',
      }[offer.reason ?? 'claimed'];
      throw new ConflictException({ code: 'FOUNDING_NOT_AVAILABLE', reason: offer.reason, message: msg });
    }
    await this.state(userId);
    const mine = await this.states.updateOne(
      { userId: new Types.ObjectId(userId), foundingClaimedAt: { $exists: false } },
      { $set: { foundingClaimedAt: new Date() } },
    );
    if (mine.modifiedCount !== 1) throw new ConflictException({ code: 'FOUNDING_NOT_AVAILABLE', reason: 'claimed', message: 'You are already a founding host.' });
    // One place, atomically (two hosts can't take the last one)
    try {
      const seat = await this.counters.findOneAndUpdate(
        { _id: 'founding', count: { $lt: FOUNDING_SPOTS } },
        { $inc: { count: 1 } },
        { upsert: true, new: true },
      );
      if (!seat) throw new Error('full');
    } catch {
      await this.states.updateOne({ userId: new Types.ObjectId(userId) }, { $unset: { foundingClaimedAt: 1 } });
      throw new ConflictException({ code: 'FOUNDING_NOT_AVAILABLE', reason: 'full', message: 'All founding host places are taken.' });
    }
    return this.grant(userId, FOUNDING_PLAN, FOUNDING_DAYS, 'founding');
  }

  async referralCode(userId: string): Promise<string> {
    const st = await this.state(userId);
    if (st.referralCode) return st.referralCode;
    for (let i = 0; i < 5; i++) {
      const code = 'HOST' + randomBytes(3).toString('hex').toUpperCase();
      try {
        const row = await this.states.findOneAndUpdate(
          { userId: new Types.ObjectId(userId), referralCode: { $exists: false } },
          { $set: { referralCode: code } },
          { new: true },
        );
        if (row?.referralCode) return row.referralCode;
        const again: any = await this.states.findOne({ userId: new Types.ObjectId(userId) }).select('referralCode').lean();
        if (again?.referralCode) return again.referralCode;
      } catch (err: any) {
        if (err?.code !== 11000) throw err;
      }
    }
    throw new ConflictException('Could not make a code. Try again.');
  }

  /** A new host says who brought them. Only before their first approved listing. */
  async applyReferral(userId: string, rawCode: string): Promise<void> {
    await this.assertHost(userId);
    const code = String(rawCode ?? '').trim().toUpperCase();
    if (!/^HOST[0-9A-F]{6}$/.test(code)) throw new BadRequestException({ code: 'BAD_CODE', message: 'This code does not exist.' });
    const owner: any = await this.states.findOne({ referralCode: code }).select('userId').lean();
    if (!owner) throw new NotFoundException({ code: 'BAD_CODE', message: 'This code does not exist.' });
    if (String(owner.userId) === String(userId)) throw new BadRequestException({ code: 'OWN_CODE', message: 'You can’t use your own code.' });
    if (await this.properties.exists({ ownerId: new Types.ObjectId(userId), approvalStatus: 'approved' })) {
      throw new ConflictException({ code: 'TOO_LATE', message: 'Codes are for hosts who haven’t published a listing yet.' });
    }
    await this.state(userId);
    const res = await this.states.updateOne(
      { userId: new Types.ObjectId(userId), referredBy: { $exists: false } },
      { $set: { referredBy: owner.userId, referredAt: new Date() } },
    );
    if (res.modifiedCount !== 1) throw new ConflictException({ code: 'ALREADY_REFERRED', message: 'You already entered a code.' });
  }

  /** First approved listing of a host someone brought: that person gets a month of Starter */
  async onListingApproved(ownerId: string): Promise<void> {
    try {
      const approved = await this.properties.countDocuments({ ownerId: new Types.ObjectId(ownerId), approvalStatus: 'approved' });
      if (approved !== 1) return;
      const st = await this.states.findOneAndUpdate(
        { userId: new Types.ObjectId(ownerId), referredBy: { $exists: true }, referralRewardedAt: { $exists: false } },
        { $set: { referralRewardedAt: new Date() } },
        { new: true },
      );
      if (!st?.referredBy) return;
      const referrerId = String(st.referredBy);
      const ref = await this.states.findOneAndUpdate(
        { userId: st.referredBy, referralRewards: { $lt: REFERRAL_MAX_REWARDS } },
        { $inc: { referralRewards: 1 } },
        { new: true },
      );
      if (!ref) return;
      await this.grant(referrerId, REFERRAL_PLAN, REFERRAL_DAYS, 'referral');
      const newHost: any = await this.users.findById(ownerId).select('name').lean();
      await this.notify(referrerId, {
        title: 'You earned a free month',
        message: `${newHost?.name ?? 'A host you invited'} published their first listing. Enjoy a month of Starter, on us.`,
        fr: { title: 'Vous avez gagné un mois offert', message: `${newHost?.name ?? 'Un hôte que vous avez invité'} a publié sa première annonce. Profitez d’un mois Starter offert.` },
      });
    } catch (err: any) {
      this.logger.warn(`Referral reward for ${ownerId} failed: ${err?.message}`);
    }
  }

  // ── What the plans screen shows ──────────────────────────────────────────────

  async overview(userId: string) {
    const { plan, tier, sub } = await this.planOf(userId);
    const st: any = (await this.state(userId)).toObject();
    const [listings, coHosts, scheduled, scheduledSub, trial, founding, code, welcome] = await Promise.all([
      this.listingCount(userId),
      this.coHostCount(userId),
      this.scheduledCount(userId),
      this.scheduledSubscription(userId),
      this.trialOffer(userId),
      this.foundingOffer(userId),
      this.referralCode(userId),
      this.welcomeBoostLeft(userId),
    ]);
    const aiUsed = tier.aiWriterPeriod === 'lifetime' ? st.aiWriterLifetime ?? 0 : st.aiWriterMonth === monthKey() ? st.aiWriterMonthUses ?? 0 : 0;
    const boostsUsed = sub?.boostsUsed ?? 0;

    // The exact price of each plan for this host, for both billing periods
    const changes: Record<string, Record<string, PlanChange | { error: string }>> = {};
    for (const p of HOST_PLAN_ORDER.slice(1)) {
      changes[p] = {};
      for (const c of ['monthly', 'yearly']) {
        try {
          changes[p][c] = await this.planChange(userId, p, c);
        } catch (err: any) {
          changes[p][c] = { error: err?.response?.code ?? 'UNAVAILABLE' };
        }
      }
    }

    const kind = (sub?.metadata as any)?.kind ?? (sub ? 'paid' : 'free');
    return {
      plan,
      kind,
      tier,
      subscription: sub
        ? { id: String(sub._id), plan: sub.plan, billingCycle: sub.billingCycle, startDate: sub.startDate, endDate: sub.endDate, price: sub.price, kind }
        : null,
      next: scheduledSub ? { plan: scheduledSub.plan, billingCycle: scheduledSub.billingCycle, startDate: scheduledSub.startDate, endDate: scheduledSub.endDate } : null,
      usage: {
        listings: { used: listings, limit: tier.maxListings },
        boosts: { used: boostsUsed, limit: tier.boostsPerMonth, welcomeLeft: welcome },
        coHosts: { used: coHosts, limit: tier.maxCoHosts },
        scheduledMessages: { used: scheduled, limit: tier.maxScheduledMessages },
        aiWriter: { used: aiUsed, limit: tier.aiWriterLimit, period: tier.aiWriterPeriod },
        smartPricing: { limit: tier.smartPricingListings },
      },
      changes,
      offers: {
        trial,
        founding,
        referral: {
          code,
          rewards: st.referralRewards ?? 0,
          maxRewards: REFERRAL_MAX_REWARDS,
          days: REFERRAL_DAYS,
          enteredCode: !!st.referredBy,
          canEnterCode: !st.referredBy && !(await this.properties.exists({ ownerId: new Types.ObjectId(userId), approvalStatus: 'approved' })),
        },
      },
      dedicatedContact: tier.support === 'dedicated' ? process.env.ELITE_SUPPORT_PHONE || null : null,
    };
  }

  // ── Badges ───────────────────────────────────────────────────────────────────

  /** "Pro host" / "Elite host" on the public profile, kept in step with the plan */
  async syncBadge(userId: string): Promise<void> {
    const now = new Date();
    const sub: any = await this.subs
      .findOne({ userId: new Types.ObjectId(userId), status: SubscriptionStatus.ACTIVE, endDate: { $gt: now } })
      .select('plan')
      .sort({ createdAt: -1 })
      .lean();
    const badge = sub ? tierOf(sub.plan).badge : null;
    await this.users.updateOne({ _id: new Types.ObjectId(userId) }, badge ? { $set: { 'hostProfile.planBadge': badge } } : { $unset: { 'hostProfile.planBadge': 1 } });
  }

  /** Superhost is earned: 10 completed stays and a 4.8 rating or better */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async refreshSuperhosts(): Promise<void> {
    try {
      const stays = await this.bookings.aggregate([
        { $match: { status: 'completed' } },
        { $group: { _id: '$hostId', n: { $sum: 1 } } },
        { $match: { n: { $gte: 10 } } },
      ]);
      const ratings = await this.properties.aggregate([
        { $match: { ownerId: { $in: stays.map((s) => s._id) }, averageRating: { $gt: 0 } } },
        { $group: { _id: '$ownerId', r: { $avg: '$averageRating' } } },
      ]);
      const good = ratings.filter((r) => r.r >= 4.8).map((r) => r._id);
      await this.users.updateMany({ 'hostProfile.isSuperhost': true, _id: { $nin: good } }, { $set: { 'hostProfile.isSuperhost': false } });
      await this.users.updateMany(
        { _id: { $in: good }, 'hostProfile.isSuperhost': { $ne: true } },
        { $set: { 'hostProfile.isSuperhost': true, 'hostProfile.superhostSince': new Date() } },
      );
    } catch (err: any) {
      this.logger.warn(`Superhost refresh failed: ${err?.message}`);
    }
  }

  // ── Plan ends: reminders, expiry, the next plan ──────────────────────────────

  @Cron(CronExpression.EVERY_HOUR)
  async runPlanLifecycle(): Promise<void> {
    const now = new Date();
    try {
      // Ended plans
      const ended = await this.subs.find({ status: SubscriptionStatus.ACTIVE, endDate: { $lte: now }, plan: { $in: HOST_PLAN_ORDER } }).limit(500);
      for (const sub of ended) {
        sub.status = SubscriptionStatus.EXPIRED;
        await sub.save();
        const userId = String(sub.userId);
        const next = await this.activeSubscription(userId); // starts a scheduled one
        await this.syncBadge(userId).catch(() => undefined);
        if (!next) {
          await this.notify(userId, {
            title: 'Your plan has ended',
            message: `Your ${this.nameOf(sub.plan as HostPlanName)} plan ended. You're on Free now; your listings stay online. Renew any time.`,
            fr: { title: 'Votre formule est terminée', message: `Votre formule ${this.nameOf(sub.plan as HostPlanName)} est terminée. Vous êtes maintenant sur Gratuit ; vos annonces restent en ligne. Renouvelez quand vous voulez.` },
          });
        }
      }
      // Reminders 7 days and 1 day before
      for (const days of [7, 1]) {
        const soon = await this.subs
          .find({
            status: SubscriptionStatus.ACTIVE,
            plan: { $in: HOST_PLAN_ORDER },
            endDate: { $gt: now, $lte: new Date(now.getTime() + days * DAY) },
            [`metadata.reminded${days}`]: { $ne: true },
          })
          .limit(500);
        for (const sub of soon) {
          await this.subs.updateOne({ _id: sub._id }, { $set: { [`metadata.reminded${days}`]: true } });
          if (await this.scheduledSubscription(String(sub.userId))) continue;
          const name = this.nameOf(sub.plan as HostPlanName);
          const kind = (sub.metadata as any)?.kind;
          await this.notify(String(sub.userId), {
            title: days === 1 ? `Your ${name} plan ends tomorrow` : `Your ${name} plan ends in ${days} days`,
            message: kind === 'trial' ? 'Your free month is almost over. Choose a plan to keep its tools.' : 'Renew now to keep your boosts, tools and limits.',
            fr: {
              title: days === 1 ? `Votre formule ${name} se termine demain` : `Votre formule ${name} se termine dans ${days} jours`,
              message: kind === 'trial' ? 'Votre mois gratuit se termine bientôt. Choisissez une formule pour garder ses outils.' : 'Renouvelez maintenant pour garder vos boosts, outils et limites.',
            },
          });
        }
      }
    } catch (err: any) {
      this.logger.error(`Plan lifecycle failed: ${err?.message}`);
    }
  }

  private async notify(userId: string, p: { title: string; message: string; fr: { title: string; message: string } }) {
    try {
      await this.notifications.create({ userId, type: NotificationType.SYSTEM, title: p.title, message: p.message, link: '/host/subscription', fr: p.fr } as any);
    } catch (err: any) {
      this.logger.warn(`Plan notification to ${userId} failed: ${err?.message}`);
    }
  }

  // Handy elsewhere
  isPaidLike(kind?: string) {
    return PAID_LIKE.includes(String(kind));
  }
}
