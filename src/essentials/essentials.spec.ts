import { Types } from 'mongoose';
import { EssentialsService } from './essentials.service';
import { cityKey, deliveryCode } from './essentials.util';

/** A stand-in model: find() returns the given rows, whatever the query */
function model(rows: any[]) {
  const chain = (data: any[]) => {
    const c: any = { lean: async () => data, sort: () => c, select: () => c, limit: () => c };
    return c;
  };
  return { find: (q: any = {}) => chain(filter(rows, q)), findOne: () => chain(rows[0] ? [rows[0]] : []) } as any;
}
/** Enough of Mongo's filtering for these tests: _id $in and key $in */
function filter(rows: any[], q: any) {
  return rows.filter((r) => {
    if (q?._id?.$in) return q._id.$in.map(String).includes(String(r._id));
    if (q?.key?.$in) return q.key.$in.includes(r.key);
    return true;
  });
}

const shopId = new Types.ObjectId();
const tplId = new Types.ObjectId();
const kitId = new Types.ObjectId();
const itemId = new Types.ObjectId();

const shop = { _id: shopId, name: 'Boutique Mimi', status: 'approved', paused: false, minOrder: 0, zones: [{ city: 'Yaoundé', cityKey: 'yaounde', fee: 1000, minutes: 120 }] };
const template = {
  _id: tplId, key: 'sleep', isActive: true, icon: '🛏️', name: { en: 'Sleep kit', fr: 'Kit sommeil' },
  lines: [{ itemTypeKey: 'sheets', qty: 2, removable: false }, { itemTypeKey: 'pillow', qty: 1, removable: true }, { itemTypeKey: 'blanket', qty: 1, removable: true }],
  options: [{ key: 'bed', label: { en: 'Bed size', fr: 'Taille du lit' }, values: [{ key: 'single', label: { en: 'Single', fr: 'Une place' } }, { key: 'double', label: { en: 'Double', fr: 'Deux places' } }] }],
};
const kit = { _id: kitId, shopId, templateId: tplId, price: 30000, available: true, optionPrices: { 'bed:double': 6000 }, removeDiscounts: { pillow: 2500, blanket: 5000 }, photos: [] };
const item = { _id: itemId, shopId, itemTypeKey: 'blender', title: 'Blender 1.5 L', price: 18000, stock: 2, isActive: true, options: [{ key: 'colour', label: 'Colour', values: [{ key: 'red', label: 'Red', extra: 0 }, { key: 'black', label: 'Black', extra: 1500 }] }], photos: [] };
const types = ['sheets', 'pillow', 'blanket', 'blender'].map((key) => ({ key, name: { en: key, fr: key }, icon: '📦' }));

function service() {
  const config: any = { get: (k: string) => (k === 'JWT_SECRET' ? 'test-secret' : undefined) };
  return new EssentialsService(
    model([{ country: 'CM', serviceFee: 500, commissionPct: 12, currency: 'XAF' }]) as any,
    model(types), model([template]), model([shop]), model([kit]), model([item]),
    model([]), model([]), model([]), model([]), model([]), model([]),
    {} as any, {} as any, config,
  );
}

describe('Essentials pricing', () => {
  it('prices a kit with an option and a removed line', async () => {
    const [line] = await service().priceLines('Yaoundé', [{ kind: 'kit', offerId: String(kitId), qty: 2, options: { bed: 'double' }, removed: ['pillow'] }]);
    expect(line.ok).toBe(true);
    // 30 000 + 6 000 (double) − 2 500 (no pillow) = 33 500, twice
    expect(line.line?.unitPrice).toBe(33500);
    expect(line.line?.total).toBe(67000);
    expect(line.line?.removed).toEqual([{ en: 'pillow', fr: 'pillow' }]);
    expect(line.line?.contents?.map((c) => c.en)).toEqual(['2 × sheets', '1 × blanket']);
  });

  it('ignores removing a line that is not removable', async () => {
    const [line] = await service().priceLines('Yaoundé', [{ kind: 'kit', offerId: String(kitId), qty: 1, removed: ['sheets'] }]);
    expect(line.line?.unitPrice).toBe(30000);
    expect(line.removed).toEqual([]);
  });

  it('adds an item option price and flags too few in stock', async () => {
    const s = service();
    const [ok] = await s.priceLines('Yaoundé', [{ kind: 'item', offerId: String(itemId), qty: 2, options: { colour: 'black' } }]);
    expect(ok.ok).toBe(true);
    expect(ok.line?.unitPrice).toBe(19500);
    const [tooMany] = await s.priceLines('Yaoundé', [{ kind: 'item', offerId: String(itemId), qty: 3 }]);
    expect(tooMany.ok).toBe(false);
    expect(tooMany.problem).toBe('stock');
  });

  it('flags a shop that does not deliver to the city, matching cities without accents', async () => {
    const s = service();
    const [far] = await s.priceLines('Douala', [{ kind: 'item', offerId: String(itemId), qty: 1 }]);
    expect(far.problem).toBe('no_delivery');
    const [near] = await s.priceLines('YAOUNDE', [{ kind: 'item', offerId: String(itemId), qty: 1 }]);
    expect(near.ok).toBe(true);
  });

  it('marks unknown offers as gone', async () => {
    const [gone] = await service().priceLines('Yaoundé', [{ kind: 'item', offerId: String(new Types.ObjectId()), qty: 1 }]);
    expect(gone.ok).toBe(false);
    expect(gone.problem).toBe('gone');
  });
});

describe('Essentials helpers', () => {
  it('makes a stable 4-digit delivery code per part', () => {
    const a = deliveryCode('s', 'part-1');
    expect(a).toMatch(/^\d{4}$/);
    expect(deliveryCode('s', 'part-1')).toBe(a);
  });

  it('matches cities without accents or case', () => {
    expect(cityKey(' Yaoundé ')).toBe('yaounde');
    expect(cityKey('NGAOUNDÉRÉ')).toBe('ngaoundere');
  });
});
