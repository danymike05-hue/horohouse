import { Types } from 'mongoose';
import { InquiryService } from './inquiry.service';

const ME = new Types.ObjectId();
const OTHER = String(new Types.ObjectId());
const as = (role: string) => ({ _id: ME, role }) as any;

function build() {
  const query: any[] = [];
  const chain = { populate: () => chain, sort: () => chain, skip: () => chain, limit: () => chain, exec: () => Promise.resolve([]) };
  const inquiryModel: any = {
    find: jest.fn((q: any) => { query.push(q); return chain; }),
    countDocuments: jest.fn(() => Promise.resolve(0)),
    aggregate: jest.fn((stages: any[]) => { query.push(stages[0].$match); return Promise.resolve([]); }),
  };
  const service = new InquiryService(inquiryModel, {} as any, {} as any, {} as any, {} as any);
  return { service, query };
}
const str = (q: any) => JSON.parse(JSON.stringify(q));

describe('who can list which inquiries', () => {
  it.each(['agent', 'landlord', 'host'])('a %s sees the ones they received', async (role) => {
    const { service, query } = build();
    await service.findAll({}, {}, as(role));
    expect(str(query[0])).toEqual({ agentId: String(ME) });
  });

  it.each(['registered_user', 'student', 'guest'])('a %s sees the ones they sent (hosts and students used to see everyone\'s)', async (role) => {
    const { service, query } = build();
    await service.findAll({}, {}, as(role));
    expect(str(query[0])).toEqual({ userId: String(ME) });
  });

  it("can't read someone else's by passing their id", async () => {
    const { service, query } = build();
    await service.findAll({ agentId: OTHER, userId: OTHER } as any, {}, as('agent'));
    expect(str(query[0])).toEqual({ agentId: String(ME) });
  });

  it('an agent can list the ones they sent themselves', async () => {
    const { service, query } = build();
    await service.findAll({ userId: String(ME) } as any, {}, as('agent'));
    expect(str(query[0])).toEqual({ userId: String(ME) });
  });

  it('admins see everything, and can filter by anyone', async () => {
    const { service, query } = build();
    await service.findAll({}, {}, as('admin'));
    await service.findAll({ agentId: OTHER } as any, {}, as('admin'));
    expect(str(query[0])).toEqual({});
    expect(str(query[1])).toEqual({ agentId: OTHER });
  });

  it('stats use the same limits', async () => {
    const { service, query } = build();
    await service.getInquiryStats(as('host'));
    expect(str(query[0])).toEqual({ agentId: String(ME) });
  });
});
