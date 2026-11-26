import { ChatService } from './chat.service';

const ME = '507f1f77bcf86cd799439011';
const SUPPORT = '507f1f77bcf86cd799439012';
const LISTING = '507f1f77bcf86cd799439014';

const query = (v: any) => {
  const q: any = {};
  for (const k of ['select', 'lean', 'sort', 'limit', 'populate']) q[k] = () => q;
  q.exec = () => Promise.resolve(v);
  q.then = (ok: any, no: any) => Promise.resolve(v).then(ok, no);
  return q;
};

/** A conversation store with a few chats, answering the queries the service makes */
function setup(chats: any[]) {
  const matches = (c: any, f: any) => {
    if (f.isSupport === true && !c.isSupport) return false;
    if (f.isSupport?.$ne === true && c.isSupport) return false;
    if (f.propertyId?.$exists === false && c.propertyId) return false;
    if (f.propertyId && f.propertyId.$exists === undefined && String(f.propertyId) !== String(c.propertyId)) return false;
    return true;
  };
  const conversationModel: any = {
    findOne: jest.fn((f: any) => query(chats.find((c) => matches(c, f)) ?? null)),
    findOneAndUpdate: jest.fn((f: any, u: any) => {
      const c = chats.find((x) => matches(x, f));
      if (c) Object.assign(c, u.$set);
      return Promise.resolve(c ?? null);
    }),
    findById: jest.fn((id: any) => query(chats.find((c) => String(c._id) === String(id)) ?? null)),
    create: jest.fn(async (doc: any) => { const c = { _id: 'new', ...doc }; chats.push(c); return c; }),
  };
  const userModel: any = {
    findOne: jest.fn(() => query({ _id: SUPPORT })),
    findById: jest.fn((id: any) => query({ _id: id, role: 'guest' })),
    find: jest.fn(() => query([])),
  };
  const service = new ChatService(conversationModel, { create: jest.fn() } as any, { findById: jest.fn(() => query({ _id: LISTING })) } as any, userModel);
  (service as any).logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
  return { service, conversationModel, chats };
}

describe('support chat', () => {
  const OLD = process.env.SUPPORT_USER_ID;
  beforeAll(() => { delete process.env.SUPPORT_USER_ID; });
  afterAll(() => { process.env.SUPPORT_USER_ID = OLD; });

  it('never opens the chat about a listing', async () => {
    const { service, chats } = setup([{ _id: 'listing-chat', propertyId: LISTING, participants: [] }]);
    const conv: any = await service.createSupportConversation(ME);
    expect(conv._id).toBe('new');
    expect(conv.isSupport).toBe(true);
    expect(conv.propertyId).toBeUndefined();
    expect(chats.find((c) => c._id === 'listing-chat').isSupport).toBeUndefined();
  });

  it('comes back to the same support chat', async () => {
    const { service, conversationModel } = setup([{ _id: 'support-chat', isSupport: true, participants: [] }]);
    const conv: any = await service.createSupportConversation(ME);
    expect(conv._id).toBe('support-chat');
    expect(conversationModel.create).not.toHaveBeenCalled();
  });

  it('keeps an older support chat (no listing) and marks it', async () => {
    const { service, chats } = setup([{ _id: 'older', participants: [] }]);
    const conv: any = await service.createSupportConversation(ME);
    expect(conv._id).toBe('older');
    expect(chats[0].isSupport).toBe(true);
  });

  it('a chat about a listing never lands in the support chat', async () => {
    const { service, conversationModel } = setup([{ _id: 'support-chat', isSupport: true, participants: [] }]);
    const found = await (service as any).findExistingConversation(ME, SUPPORT, LISTING);
    expect(found).toBeNull();
    for (const [filter] of conversationModel.findOne.mock.calls) expect(filter.isSupport).toEqual({ $ne: true });
  });
});
