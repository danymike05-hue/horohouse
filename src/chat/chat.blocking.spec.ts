import { ChatService } from './chat.service';
import { ReportsService } from '../reports/reports.service';

const ME = '507f1f77bcf86cd799439011';
const THEM = '507f1f77bcf86cd799439012';
const CHAT = '507f1f77bcf86cd799439013';

const query = (v: any) => {
  const q: any = {};
  for (const k of ['select', 'lean', 'sort', 'limit', 'populate']) q[k] = () => q;
  q.exec = () => Promise.resolve(v);
  q.then = (ok: any, no: any) => Promise.resolve(v).then(ok, no);
  return q;
};

function chat(people: any[], other: any = { _id: THEM, role: 'guest' }) {
  const userModel: any = {
    find: jest.fn(() => query(people)),
    findById: jest.fn(() => query(other)),
    findOne: jest.fn(() => query({ _id: '507f1f77bcf86cd799439099' })),
    updateOne: jest.fn().mockResolvedValue(undefined),
  };
  const conversation = { participants: [{ userId: { _id: ME } }, { userId: { _id: THEM } }] };
  const messageModel: any = { create: jest.fn() };
  const service = new ChatService({ findById: jest.fn(() => query(conversation)) } as any, messageModel, {} as any, userModel);
  (service as any).logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
  return { service, userModel, messageModel };
}

describe('blocking in chat', () => {
  const codeOf = (p: Promise<any>) => p.then(() => 'sent', (e) => e.getResponse().code);

  it('lets people write when nobody blocked anybody', async () => {
    const { service } = chat([{ _id: ME, blockedUsers: [] }, { _id: THEM }]);
    expect(await codeOf(service.assertCanContact(ME, THEM))).toBe('sent');
  });

  it('stops both directions, without telling who blocked', async () => {
    expect(await codeOf(chat([{ _id: ME, blockedUsers: [THEM] }, { _id: THEM }]).service.assertCanContact(ME, THEM))).toBe('YOU_BLOCKED');
    expect(await codeOf(chat([{ _id: ME }, { _id: THEM, blockedUsers: [ME] }]).service.assertCanContact(ME, THEM))).toBe('CANNOT_CONTACT');
  });

  it('a blocked message is never saved', async () => {
    const { service, messageModel } = chat([{ _id: ME }, { _id: THEM, blockedUsers: [ME] }]);
    expect(await codeOf(service.sendMessage(ME, { conversationId: CHAT, content: 'hi' } as any))).toBe('CANNOT_CONTACT');
    expect(messageModel.create).not.toHaveBeenCalled();
  });

  it('nobody can write to a deleted account', async () => {
    const { service } = chat([{ _id: ME }, { _id: THEM, deletedAt: new Date() }]);
    expect(await codeOf(service.assertCanContact(ME, THEM))).toBe('ACCOUNT_DELETED');
  });

  it('blocks a person but not support or yourself', async () => {
    const ok = chat([]);
    await expect(ok.service.blockUser(ME, THEM)).resolves.toEqual({ blocked: true });
    expect(ok.userModel.updateOne.mock.calls[0][1].$addToSet).toBeDefined();
    await expect(chat([], { _id: THEM, role: 'admin' }).service.blockUser(ME, THEM)).rejects.toThrow('support');
    await expect(chat([]).service.blockUser(ME, ME)).rejects.toThrow('yourself');
  });
});

describe('reporting a person', () => {
  function reports(opts: { between?: boolean; existing?: any; person?: any; messages?: any[] } = {}) {
    const saved: any[] = [];
    const reportModel: any = jest.fn((d: any) => ({ save: async () => { saved.push(d); return { ...d, _id: 'r1' }; } }));
    reportModel.exists = jest.fn().mockResolvedValue(opts.existing ?? null);
    reportModel.findById = jest.fn(() => query({ _id: 'r1', reportedUser: THEM, status: 'pending' }));
    reportModel.find = jest.fn(() => query([{ reporter: ME }]));
    reportModel.updateMany = jest.fn().mockResolvedValue(undefined);
    const propertyModel: any = { updateMany: jest.fn().mockResolvedValue(undefined) };
    const userModel: any = { findById: jest.fn(() => query(opts.person ?? { _id: THEM, name: 'Ben' })), updateOne: jest.fn().mockResolvedValue(undefined) };
    const notifications: any = { notifyAdmins: jest.fn().mockResolvedValue(undefined), create: jest.fn().mockResolvedValue(undefined) };
    const conversationModel: any = { exists: jest.fn().mockResolvedValue(opts.between === false ? null : { _id: CHAT }) };
    const messageModel: any = { find: jest.fn(() => query(opts.messages ?? [])), findOne: jest.fn(() => query(null)) };
    const service = new ReportsService(reportModel, propertyModel, userModel, {} as any, notifications, conversationModel, messageModel);
    (service as any).logger = { log: jest.fn(), warn: jest.fn() };
    return { service, saved, userModel, propertyModel, notifications };
  }

  it('keeps the last messages with the report, oldest first, with the reported one marked', async () => {
    const M = '507f1f77bcf86cd799439021';
    const { service, saved, notifications } = reports({
      messages: [
        { _id: M, senderId: THEM, content: 'rude', createdAt: new Date(2000) },
        { _id: 'm0', senderId: ME, content: 'hello', createdAt: new Date(1000) },
      ],
    });
    await service.createForUser({ reason: 'Harassment', conversationId: CHAT, messageId: M }, ME, THEM);
    expect(saved[0].evidence).toEqual([
      { byReported: false, text: 'hello', at: new Date(1000) },
      { byReported: true, text: 'rude', at: new Date(2000), reported: true },
    ]);
    expect(notifications.notifyAdmins).toHaveBeenCalled();
  });

  it('takes nothing from a chat that is not theirs', async () => {
    const { service, saved } = reports({ between: false, messages: [{ senderId: THEM, content: 'private' }] });
    await service.createForUser({ reason: 'Spam', conversationId: CHAT }, ME, THEM);
    expect(saved[0].evidence).toBeUndefined();
    expect(saved[0].conversation).toBeUndefined();
  });

  it('refuses a second open report and reporting yourself', async () => {
    await expect(reports({ existing: { _id: 'x' } }).service.createForUser({ reason: 'Spam' }, ME, THEM)).rejects.toThrow('already');
    await expect(reports().service.createForUser({ reason: 'Spam' }, ME, ME)).rejects.toThrow('yourself');
  });

  it('suspending signs the person out, hides their listings and tells who reported', async () => {
    const { service, userModel, propertyModel, notifications } = reports();
    await service.suspendUser('507f1f77bcf86cd799439031', 'Scam', { _id: 'admin' } as any);
    expect(userModel.updateOne).toHaveBeenCalledWith({ _id: THEM }, { $set: { isActive: false, sessions: [], pushTokens: [] } });
    expect(propertyModel.updateMany).toHaveBeenCalled();
    expect(notifications.create.mock.calls[0][0].message).toContain('closed their account');
  });

  it('never suspends an admin', async () => {
    const { service, userModel } = reports({ person: { _id: THEM, role: 'admin' } });
    await expect(service.suspendUser('507f1f77bcf86cd799439031', 'x y z', {} as any)).rejects.toThrow('admin');
    expect(userModel.updateOne).not.toHaveBeenCalled();
  });
});
