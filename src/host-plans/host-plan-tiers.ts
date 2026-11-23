// What each hosting plan gives. The plan documents in the database are seeded from this
// (SubscriptionsService), and every limit in the API is read through HostPlansService,
// so this file is the one place to change a plan.
//
// -1 means unlimited, 0 means not included.

export type HostPlanName = 'host_free' | 'host_starter' | 'host_growth' | 'host_pro' | 'host_elite';

export interface HostTier {
  /** Listings a host can have (hosts already above it keep theirs, they can't add more) */
  maxListings: number;
  /** Free boosts each calendar month */
  boostsPerMonth: number;
  /** Free plan: one boost to launch, once */
  welcomeBoost: boolean;
  /** Automatic (scheduled) messages to guests */
  maxScheduledMessages: number;
  /** Co-hosts across all listings */
  maxCoHosts: number;
  insights: 'basic' | 'full';
  insightsExport: boolean;
  /** Discount codes the host makes for their guests */
  promoCodes: boolean;
  /** Listings that get AI smart pricing (the oldest ones first) */
  smartPricingListings: number;
  /** AI listing writer uses: a lifetime allowance on Free, a monthly one after */
  aiWriterLimit: number;
  aiWriterPeriod: 'lifetime' | 'month';
  support: 'standard' | 'priority' | 'dedicated';
  /** Hours after check-in before the host's money can be withdrawn */
  payoutHoldHours: number;
  badge: 'pro' | 'elite' | null;
}

export const HOST_TIERS: Record<HostPlanName, HostTier> = {
  host_free: {
    maxListings: 5, boostsPerMonth: 0, welcomeBoost: true, maxScheduledMessages: 2, maxCoHosts: 1,
    insights: 'basic', insightsExport: false, promoCodes: false, smartPricingListings: 1,
    aiWriterLimit: 3, aiWriterPeriod: 'lifetime', support: 'standard', payoutHoldHours: 24, badge: null,
  },
  host_starter: {
    maxListings: 12, boostsPerMonth: 2, welcomeBoost: false, maxScheduledMessages: 5, maxCoHosts: 2,
    insights: 'basic', insightsExport: false, promoCodes: true, smartPricingListings: 1,
    aiWriterLimit: 10, aiWriterPeriod: 'month', support: 'standard', payoutHoldHours: 24, badge: null,
  },
  host_growth: {
    maxListings: 30, boostsPerMonth: 4, welcomeBoost: false, maxScheduledMessages: -1, maxCoHosts: 5,
    insights: 'full', insightsExport: false, promoCodes: true, smartPricingListings: 3,
    aiWriterLimit: -1, aiWriterPeriod: 'month', support: 'priority', payoutHoldHours: 24, badge: null,
  },
  host_pro: {
    maxListings: 75, boostsPerMonth: 8, welcomeBoost: false, maxScheduledMessages: -1, maxCoHosts: 15,
    insights: 'full', insightsExport: false, promoCodes: true, smartPricingListings: -1,
    aiWriterLimit: -1, aiWriterPeriod: 'month', support: 'priority', payoutHoldHours: 12, badge: 'pro',
  },
  host_elite: {
    maxListings: -1, boostsPerMonth: -1, welcomeBoost: false, maxScheduledMessages: -1, maxCoHosts: -1,
    insights: 'full', insightsExport: true, promoCodes: true, smartPricingListings: -1,
    aiWriterLimit: -1, aiWriterPeriod: 'month', support: 'dedicated', payoutHoldHours: 12, badge: 'elite',
  },
};

export const HOST_PLAN_ORDER: HostPlanName[] = ['host_free', 'host_starter', 'host_growth', 'host_pro', 'host_elite'];

export const isHostPlanName = (v: unknown): v is HostPlanName => typeof v === 'string' && v in HOST_TIERS;

export const tierOf = (plan: unknown): HostTier => HOST_TIERS[isHostPlanName(plan) ? plan : 'host_free'];

/** Growth levers */
export const TRIAL_DAYS = 30;
export const TRIAL_PLANS: HostPlanName[] = ['host_starter', 'host_growth'];
export const FOUNDING_PLAN: HostPlanName = 'host_growth';
export const FOUNDING_DAYS = 182;
export const FOUNDING_SPOTS = 500;
export const REFERRAL_PLAN: HostPlanName = 'host_starter';
export const REFERRAL_DAYS = 30;
/** Rewards one host can earn by bringing others (stops abuse with made-up accounts) */
export const REFERRAL_MAX_REWARDS = 12;

export const within = (limit: number, used: number) => limit === -1 || used < limit;
