import { Types } from 'mongoose';
import { LeaseTenantsService } from './lease-tenants.service';

const LANDLORD = new Types.ObjectId();
const ANA = new Types.ObjectId();
const BEN = new Types.ObjectId();
const lean = (v: any) => ({ lean: () => ({ exec: () => Promise.resolve(v) }) });

function build(opts: { inquiries?: any[]; viewings?: any[]; users?: any[]; found?: any } = {}) {
  const userModel: any = {
    find: jest.fn(() => ({ select: () => lean(opts.users ?? []) })),
    findOne: jest.fn(() => ({ select: () => lean(opts.found ?? null) })),
  };
  const inquiryModel: any = { find: jest.fn(() => ({ select: () => ({ sort: () => ({ limit: () => lean(opts.inquiries ?? []) }) }) })) };
  const appointmentModel: any = { find: jest.fn(() => ({ select: () => ({ sort: () => ({ limit: () => lean(opts.viewings ?? []) }) }) })) };
  return { service: new LeaseTenantsService(userModel, inquiryModel, appointmentModel), userModel };
}

describe('who a landlord can put on a lease', () => {
  it('people who contacted them or booked a viewing, once each, without placeholder numbers', async () => {
    const { service, userModel } = build({
      inquiries: [{ userId: ANA }, { userId: BEN }, { userId: LANDLORD }],
      viewings: [{ clientId: ANA }],
      users: [
        { _id: ANA, name: 'Ana', phoneNumber: '677000000', email: 'ana@x.co' },
        { _id: BEN, name: 'Ben', phoneNumber: 'google_123' },
      ],
    });
    const list = await service.candidates(String(LANDLORD));
    const ids = userModel.find.mock.calls[0][0]._id.$in.map(String);
    expect(ids.sort()).toEqual([String(ANA), String(BEN)].sort());
    expect(list).toEqual([
      { _id: String(ANA), name: 'Ana', phone: '677000000', email: 'ana@x.co', via: 'viewing' },
      { _id: String(BEN), name: 'Ben', via: 'inquiry' },
    ]);
  });

  it('finds one person by exact phone (with or without 237) or email, and only says their name', async () => {
    const { service, userModel } = build({ found: { _id: ANA, name: 'Ana' } });
    expect(await service.findByContact(String(LANDLORD), '+237 6 77 00 00 00')).toEqual({ _id: String(ANA), name: 'Ana' });
    expect(userModel.findOne.mock.calls[0][0].phoneNumber.$in).toEqual(expect.arrayContaining(['677000000', '237677000000', '+237677000000']));
    await service.findByContact(String(LANDLORD), ' Ana@X.co ');
    expect(userModel.findOne.mock.calls[1][0].email).toBe('ana@x.co');
  });

  it('refuses partial searches, unknown people and yourself', async () => {
    await expect(build().service.findByContact(String(LANDLORD), '677')).rejects.toThrow('full phone number');
    await expect(build().service.findByContact(String(LANDLORD), '677000000')).rejects.toThrow('No HoroHouse account');
    await expect(build({ found: { _id: LANDLORD, name: 'Me' } }).service.findByContact(String(LANDLORD), '677000000')).rejects.toThrow('No HoroHouse account');
  });
});
