import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { CheckoutService } from './checkout.service';
import { accountTokenFor, StorePurchaseRejected } from './store-verify.service';
import { allStoreProducts, parseStoreProductId, storeProductId } from './store-products';

const USER = '507f1f77bcf86cd799439051';
const OTHER = '507f1f77bcf86cd799439052';
const PLAN = 'com.horohouse.app.plan.host_growth.monthly';

function build(opts: { verified?: any; rejected?: StorePurchaseRejected; used?: any; quoteError?: Error } = {}) {
  const created: any[] = [];
  const payments: any = {
    findOne: jest.fn().mockResolvedValue(opts.used ?? null),
    create: jest.fn(async (doc: any) => { created.push(doc); return { ...doc, id: String(doc._id) }; }),
    findById: jest.fn(async () => created[0]),
    updateOne: jest.fn().mockResolvedValue({}),
  };
  const purchases: any = {
    quote: opts.quoteError
      ? jest.fn().mockRejectedValue(opts.quoteError)
      : jest.fn().mockResolvedValue({ amount: 15000, key: `sub:${USER}`, purchase: { label: 'Growth (monthly)', planName: 'host_growth', billingCycle: 'monthly' } }),
  };
  const store: any = {
    verify: opts.rejected
      ? jest.fn().mockRejectedValue(opts.rejected)
      : jest.fn().mockResolvedValue(opts.verified ?? { platform: 'ios', reference: 'apple:2000001', productId: PLAN, accountToken: accountTokenFor(USER), environment: 'Sandbox' }),
    consumeGoogle: jest.fn().mockResolvedValue(undefined),
  };
  const config: any = { get: () => 'https://api.example.test/api/v1' };
  const service = new CheckoutService(payments, {} as any, {} as any, purchases, config, undefined, store);
  const fulfil = jest.fn().mockResolvedValue(undefined);
  const flag = jest.fn().mockResolvedValue(undefined);
  (service as any).fulfil = fulfil;
  (service as any).flag = flag;
  (service as any).toView = (p: any) => ({ id: String(p?._id ?? p?.id), status: p?.status });
  return { service, payments, purchases, store, fulfil, flag, created };
}

describe('store products', () => {
  it('names 24 products and reads them back', () => {
    const ids = allStoreProducts();
    expect(ids).toHaveLength(24);
    for (const id of ids) expect(storeProductId(parseStoreProductId(id)!)).toBe(id);
    expect(parseStoreProductId('com.horohouse.app.plan.host_free.monthly')).toBeNull();
    expect(parseStoreProductId('com.other.plan.host_growth.monthly')).toBeNull();
  });

  it('ties purchases to an account with a UUID', () => {
    expect(accountTokenFor(USER)).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(accountTokenFor(USER)).not.toBe(accountTokenFor(OTHER));
  });
});

describe('POST /checkout/store-purchase', () => {
  it('checks the purchase, records it as paid and switches the plan on', async () => {
    const { service, fulfil, created } = build();
    await service.storePurchase(USER, { platform: 'ios', productId: PLAN, transactionId: '2000001' });
    expect(created[0]).toMatchObject({ method: 'app_store', status: 'paid', providerReference: 'apple:2000001', purpose: 'subscription', amount: 15000 });
    expect(fulfil).toHaveBeenCalledTimes(1);
  });

  it('refuses a purchase made from another account', async () => {
    const { service, fulfil } = build({ verified: { platform: 'ios', reference: 'apple:1', productId: PLAN, accountToken: accountTokenFor(OTHER) } });
    await expect(service.storePurchase(USER, { platform: 'ios', productId: PLAN, transactionId: '1' })).rejects.toBeInstanceOf(ForbiddenException);
    expect(fulfil).not.toHaveBeenCalled();
  });

  it('turns a store refusal into a clear error', async () => {
    const { service } = build({ rejected: new StorePurchaseRejected('REFUNDED', 'This purchase was refunded.') });
    await expect(service.storePurchase(USER, { platform: 'ios', productId: PLAN, transactionId: '1' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('answers the same purchase again without switching anything on twice', async () => {
    const { service, fulfil, payments } = build({ used: { _id: 'p1', userId: USER, status: 'paid' } });
    await expect(service.storePurchase(USER, { platform: 'ios', productId: PLAN, transactionId: '2000001' })).resolves.toEqual({ id: 'p1', status: 'paid' });
    expect(payments.create).not.toHaveBeenCalled();
    expect(fulfil).not.toHaveBeenCalled();
  });

  it('flags a paid purchase that can no longer be switched on, and consumes it on Android', async () => {
    const { service, flag, fulfil, store } = build({
      quoteError: new Error('ALREADY_BOOSTED'),
      verified: { platform: 'android', reference: 'google:GPA.1', productId: 'com.horohouse.app.boost.featured.168', accountToken: accountTokenFor(USER) },
    });
    await service.storePurchase(USER, {
      platform: 'android', productId: 'com.horohouse.app.boost.featured.168', purchaseToken: 'tok', propertyId: '507f1f77bcf86cd799439099',
    });
    expect(flag).toHaveBeenCalledTimes(1);
    expect(fulfil).not.toHaveBeenCalled();
    expect(store.consumeGoogle).toHaveBeenCalledWith('com.horohouse.app.boost.featured.168', 'tok');
  });
});
