import { UserRole } from '../users/schemas/user.schema';
import { PriceSuggestionsService, suggestFromComparables } from './price-suggestions.service';

const PROPERTY = '507f1f77bcf86cd799439061';
const OWNER = '507f1f77bcf86cd799439062';
const STRANGER = '507f1f77bcf86cd799439063';

const listings = (prices: number[]) => prices.map((price) => ({ price }));

function build(opts: { smart?: boolean; rooms?: boolean; similar?: number[]; city?: number[]; coHost?: boolean } = {}) {
  const lean = (value: any) => ({ select: () => ({ lean: () => Promise.resolve(value), limit: () => ({ lean: () => Promise.resolve(value) }) }) });
  const propertyModel: any = {
    findById: jest.fn(() => lean({ _id: PROPERTY, ownerId: OWNER, price: 12000, city: 'Douala', type: 'apartment', bedrooms: 2 })),
    find: jest.fn((filter: any) => lean(listings(filter.type ? (opts.similar ?? []) : (opts.city ?? [])))),
  };
  const roomModel: any = { exists: jest.fn().mockResolvedValue(opts.rooms ? { _id: 'r' } : null) };
  const subscriptions: any = {
    getUserSubscription: jest.fn().mockResolvedValue(opts.smart === false ? { features: {} } : { features: { smartPricing: true } }),
  };
  const coHosts: any = { isActive: jest.fn().mockResolvedValue(!!opts.coHost) };
  const service = new PriceSuggestionsService(propertyModel, roomModel, subscriptions, coHosts);
  return { service, propertyModel, subscriptions };
}

describe('suggestFromComparables', () => {
  it('uses the middle price, rounded, and the middle half as the range', () => {
    expect(suggestFromComparables(listings([10000, 12000, 15100, 18000, 20000]))).toMatchObject({
      suggestedPrice: 15000, low: 12000, high: 18000, suggestedWeekendPrice: null,
    });
  });

  it('one very expensive listing does not move it', () => {
    const normal = suggestFromComparables(listings([10000, 11000, 12000, 13000, 14000]));
    const skewed = suggestFromComparables(listings([10000, 11000, 12000, 13000, 900000]));
    expect(skewed.suggestedPrice).toBe(normal.suggestedPrice);
  });

  it('weekend price follows the usual uplift, only with enough listings charging one', () => {
    const three = [
      { price: 10000, weekendPrice: 12000 }, { price: 20000, weekendPrice: 24000 }, { price: 10000, weekendPrice: 12000 },
      { price: 10000 }, { price: 10000 },
    ];
    expect(suggestFromComparables(three).suggestedWeekendPrice).toBe(12000);
    expect(suggestFromComparables(three.slice(1)).suggestedWeekendPrice).toBeNull();
  });
});

describe('PriceSuggestionsService', () => {
  const owner = { _id: OWNER };
  const enough = [10000, 12000, 15000, 18000, 20000];

  it('only for people who manage the listing', async () => {
    await expect(build().service.forListing({ _id: STRANGER }, PROPERTY)).rejects.toThrow('listings you manage');
    await expect(build({ similar: enough, coHost: true }).service.forListing({ _id: STRANGER }, PROPERTY)).resolves.toMatchObject({ available: true });
  });

  it('needs a plan with smart pricing, checked on the owner, and reveals nothing without one', async () => {
    const { service, subscriptions } = build({ smart: false, similar: enough, coHost: true });
    await expect(service.forListing({ _id: STRANGER }, PROPERTY)).resolves.toEqual({ available: false, reason: 'plan' });
    expect(subscriptions.getUserSubscription).toHaveBeenCalledWith(OWNER);
  });

  it('admins can always look', async () => {
    const { service } = build({ smart: false, similar: enough });
    await expect(service.forListing({ _id: STRANGER, role: UserRole.ADMIN }, PROPERTY)).resolves.toMatchObject({ available: true });
  });

  it('hotels price by room, so no suggestion', async () => {
    await expect(build({ rooms: true, similar: enough }).service.forListing(owner, PROPERTY)).resolves.toEqual({ available: false, reason: 'rooms' });
  });

  it('prefers similar listings, then widens to the city', async () => {
    await expect(build({ similar: enough }).service.forListing(owner, PROPERTY)).resolves.toMatchObject({ scope: 'similar', comparableCount: 5, currentPrice: 12000 });
    await expect(build({ similar: [10000], city: enough }).service.forListing(owner, PROPERTY)).resolves.toMatchObject({ scope: 'city', comparableCount: 5 });
  });

  it('says so when there is too little to go on', async () => {
    await expect(build({ similar: [10000], city: [10000, 12000] }).service.forListing(owner, PROPERTY))
      .resolves.toEqual({ available: false, reason: 'not_enough_data', comparableCount: 2 });
  });

  it('never compares a listing with itself', async () => {
    const { service, propertyModel } = build({ similar: enough });
    await service.forListing(owner, PROPERTY);
    expect(propertyModel.find.mock.calls[0][0]._id).toEqual({ $ne: PROPERTY });
  });
});
