import { Types } from 'mongoose';
import { HostPlansService } from './host-plans.service';
import { HOST_TIERS, tierOf } from './host-plan-tiers';

const DAY = 86_400_000;
const PRICES: Record<string, Record<string, number>> = {
  host_starter: { monthly: 8000, yearly: 80000 },
  host_growth: { monthly: 15000, yearly: 150000 },
  host_pro: { monthly: 23000, yearly: 230000 },
  host_elite: { monthly: 30000, yearly: 300000 },
};

function makeService(active: any = null, scheduled: any = null) {
  const lean = (v: any) => ({ select: () => ({ lean: async () => v }), lean: async () => v });
  const subs: any = {
    findOne: jest.fn((q: any) => ({
      sort: async () => (q.status === 'scheduled' ? scheduled : active),
      select: () => ({ sort: () => ({ lean: async () => active }) }),
    })),
    findOneAndUpdate: jest.fn(async () => null),
    create: jest.fn(async (doc: any) => ({ ...doc, _id: new Types.ObjectId() })),
  };
  const plans: any = { findOne: jest.fn((q: any) => lean({ pricing: PRICES[q.name] ?? { monthly: 0, yearly: 0 }, features: {} })) };
  const users: any = { updateOne: jest.fn(async () => ({})) };
  const svc = new HostPlansService(subs, plans, {} as any, {} as any, {} as any, {} as any, {} as any, users, {} as any, {} as any);
  return { svc, subs };
}

describe('Host plan tiers', () => {
  it('Free allows 5 listings and one welcome boost; unknown plans fall back to Free', () => {
    expect(HOST_TIERS.host_free.maxListings).toBe(5);
    expect(HOST_TIERS.host_free.welcomeBoost).toBe(true);
    expect(tierOf('agent_pro').maxListings).toBe(5);
  });
  it('each plan gives at least as much as the one below', () => {
    const order = ['host_free', 'host_starter', 'host_growth', 'host_pro', 'host_elite'] as const;
    const big = (n: number) => (n === -1 ? Infinity : n);
    for (let i = 1; i < order.length; i++) {
      const a = HOST_TIERS[order[i - 1]], b = HOST_TIERS[order[i]];
      expect(big(b.maxListings)).toBeGreaterThanOrEqual(big(a.maxListings));
      expect(big(b.maxCoHosts)).toBeGreaterThanOrEqual(big(a.maxCoHosts));
      expect(b.payoutHoldHours).toBeLessThanOrEqual(a.payoutHoldHours);
    }
  });
});

describe('HostPlansService plan changes', () => {
  it('values what is left of a paid plan, and nothing of a free one', () => {
    const { svc } = makeService();
    const now = new Date();
    const paid: any = { price: 15000, startDate: new Date(now.getTime() - 15 * DAY), endDate: new Date(now.getTime() + 15 * DAY) };
    expect(svc.creditOf(paid, now)).toBe(7500);
    expect(svc.creditOf({ ...paid, price: 0 } as any, now)).toBe(0);
    expect(svc.creditOf({ ...paid, endDate: new Date(now.getTime() - DAY) } as any, now)).toBe(0);
  });

  it('with no plan, a paid plan costs its price and starts now', async () => {
    const { svc } = makeService(null);
    const c = await svc.planChange(String(new Types.ObjectId()), 'host_growth', 'monthly');
    expect(c).toMatchObject({ kind: 'new', amount: 15000, credit: 0 });
  });

  it('an upgrade takes off what is left of the current plan', async () => {
    const now = Date.now();
    const current = { plan: 'host_starter', price: 8000, billingCycle: 'monthly', startDate: new Date(now - 15 * DAY), endDate: new Date(now + 15 * DAY) };
    const { svc } = makeService(current);
    const c = await svc.planChange(String(new Types.ObjectId()), 'host_pro', 'monthly');
    expect(c.kind).toBe('upgrade');
    expect(c.credit).toBeGreaterThan(3900);
    expect(c.amount).toBe(23000 - c.credit);
  });

  it('the same plan or a cheaper one starts when the current one ends', async () => {
    const end = new Date(Date.now() + 10 * DAY);
    const current = { plan: 'host_pro', price: 23000, billingCycle: 'monthly', startDate: new Date(Date.now() - 20 * DAY), endDate: end };
    const { svc } = makeService(current);
    const renew = await svc.planChange(String(new Types.ObjectId()), 'host_pro', 'monthly');
    expect(renew).toMatchObject({ kind: 'renew', amount: 23000, credit: 0 });
    expect(new Date(renew.startsAt).getTime()).toBe(end.getTime());
    const down = await svc.planChange(String(new Types.ObjectId()), 'host_starter', 'monthly');
    expect(down.kind).toBe('downgrade');
  });

  it('refuses a payment below the price minus what the current plan is worth', async () => {
    const { svc } = makeService(null);
    await expect(
      svc.applyPaidPlan({ userId: String(new Types.ObjectId()), planName: 'host_growth', cycle: 'monthly', amountPaid: 5000, creditClaimed: 10000, transactionId: new Types.ObjectId(), features: {} }),
    ).rejects.toThrow('Amount paid does not match');
  });

  it('a paid plan never renews on its own', async () => {
    const { svc, subs } = makeService(null);
    await svc.applyPaidPlan({ userId: String(new Types.ObjectId()), planName: 'host_starter', cycle: 'monthly', amountPaid: 8000, creditClaimed: 0, transactionId: new Types.ObjectId(), features: {} });
    expect(subs.create.mock.calls[0][0]).toMatchObject({ autoRenew: false, status: 'active', plan: 'host_starter' });
  });
});
