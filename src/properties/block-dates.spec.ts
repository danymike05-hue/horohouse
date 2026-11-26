// Nights a host blocks must really be blocked: the end is exclusive, a longer block over the
// same start is kept, and imported nights are never removed by hand.
import { Types } from 'mongoose';
import { PropertiesService } from './properties.service';
import { ListingType } from './schemas/property.schema';

const ID = String(new Types.ObjectId());
const D = (s: string) => new Date(`${s}T00:00:00.000Z`);

function build(unavailableDates: any[] = []) {
  const calls: { update?: any; arrayFilters?: any; push?: any[]; pull?: any } = {};
  const svc: any = Object.create(PropertiesService.prototype);
  svc.logger = { log: () => undefined };
  svc.assertCanManageCalendar = async () => undefined;
  const doc = { listingType: ListingType.SHORT_TERM, unavailableDates };
  svc.propertyModel = {
    findById: () => Object.assign(Promise.resolve(doc), { select: () => ({ lean: () => ({ exec: async () => doc }) }) }),
    updateOne: jest.fn((_f: any, u: any, o: any) => { calls.update = u; calls.arrayFilters = o.arrayFilters; return { exec: async () => ({}) }; }),
    findByIdAndUpdate: jest.fn((_id: any, u: any) => {
      calls.push = u.$push?.unavailableDates.$each;
      calls.pull = u.$pull;
      return { lean: () => ({ exec: async () => doc }) };
    }),
  };
  return { svc, calls };
}

describe('blocking nights', () => {
  it('saves a range as it is sent (exclusive end)', async () => {
    const { svc, calls } = build();
    await svc.blockDates(ID, { ranges: [{ from: '2027-01-10', to: '2027-01-13' }] }, {});
    expect(calls.push).toEqual([{ from: D('2027-01-10'), to: D('2027-01-13'), reason: undefined }]);
  });

  it('one night sent as the same day twice (older apps) covers that night', async () => {
    const { svc, calls } = build();
    await svc.blockDates(ID, { ranges: [{ from: '2027-01-10', to: '2027-01-10' }] }, {});
    expect(calls.push![0]).toMatchObject({ from: D('2027-01-10'), to: D('2027-01-11') });
  });

  it('makes a block that already starts that day longer, instead of ignoring it', async () => {
    const { svc, calls } = build([{ from: D('2027-01-10'), to: D('2027-01-11') }]);
    await svc.blockDates(ID, { ranges: [{ from: '2027-01-10', to: '2027-01-15' }] }, {});
    expect(calls.push).toEqual([]);
    expect(calls.update).toEqual({ $max: { 'unavailableDates.$[block].to': D('2027-01-15') } });
    expect(calls.arrayFilters).toEqual([{ 'block.from': D('2027-01-10'), 'block.source': { $ne: 'ical' } }]);
  });

  it('an imported block that starts that day doesn’t stand in for the host’s own', async () => {
    const { svc, calls } = build([{ from: D('2027-01-10'), to: D('2027-01-11'), source: 'ical' }]);
    await svc.blockDates(ID, { ranges: [{ from: '2027-01-10', to: '2027-01-15' }] }, {});
    expect(calls.push).toHaveLength(1);
  });
});

it('unblocking leaves imported nights alone', async () => {
  const { svc, calls } = build();
  await svc.unblockDates(ID, { fromDates: ['2027-01-10'] }, {});
  expect(calls.pull).toEqual({ unavailableDates: { from: { $in: [D('2027-01-10')] }, source: { $ne: 'ical' } } });
});
