import { Types } from 'mongoose';
import { ViewingsService } from './viewings.service';
import { AppointmentStatus, AppointmentType } from './schemas/appointment.schema';

const OWNER = new Types.ObjectId();
const AGENT = new Types.ObjectId();
const CLIENT = { _id: new Types.ObjectId(), name: 'Ana', role: 'registered_user' };
const PROPERTY = { _id: new Types.ObjectId(), title: 'Villa Bonapriso', ownerId: OWNER, agentId: AGENT, listingType: 'rent' };
const HOUR = 3_600_000;
const inHours = (h: number) => new Date(Date.now() + h * HOUR).toISOString();

function build(opts: { property?: any; existing?: boolean; clash?: boolean; appt?: any } = {}) {
  const lean = (v: any) => ({ lean: () => ({ exec: () => Promise.resolve(v) }) });
  const property = opts.property === undefined ? PROPERTY : opts.property;
  const propertyModel: any = { findById: jest.fn(() => ({ select: () => lean(property) })) };
  const created: any[] = [];
  const appointmentModel: any = {
    exists: jest.fn().mockResolvedValue(opts.existing ? { _id: 'x' } : null),
    findOne: jest.fn(() => ({ select: () => lean(opts.clash ? { _id: 'busy' } : null) })),
    create: jest.fn(async (doc: any) => { created.push(doc); return { _id: new Types.ObjectId(), ...doc }; }),
    findById: jest.fn(() => lean(opts.appt ?? null)),
    findOneAndUpdate: jest.fn(async (_q: any, update: any) => ({ ...opts.appt, ...update.$set })),
  };
  const notifications: any = { create: jest.fn().mockResolvedValue(undefined) };
  const service = new ViewingsService(appointmentModel, propertyModel, notifications);
  return { service, created, appointmentModel, notifications };
}
const ask = (over: any = {}) => ({ propertyId: String(PROPERTY._id), startsAt: inHours(26), tourType: AppointmentType.IN_PERSON, name: 'Ana', ...over });

describe('booking a viewing', () => {
  it('goes to the listing\'s agent, whatever agent the request names', async () => {
    const { service, created, notifications } = build();
    await service.book(ask({ agentId: String(new Types.ObjectId()) }) as any, CLIENT);
    expect(String(created[0].agentId)).toBe(String(AGENT));
    expect(String(created[0].clientId)).toBe(String(CLIENT._id));
    const [dto, fr] = notifications.create.mock.calls[0];
    expect(dto).toEqual(expect.objectContaining({ userId: String(AGENT), title: 'New viewing request', link: '/(tabs)/viewings' }));
    expect(fr.title).toBe('Nouvelle demande de visite');
  });

  it('goes to the owner when the listing has no agent', async () => {
    const { service, created } = build({ property: { ...PROPERTY, agentId: undefined } });
    await service.book(ask() as any, CLIENT);
    expect(String(created[0].agentId)).toBe(String(OWNER));
  });

  it('reads a typed date and time as Cameroon time', async () => {
    const { service, created } = build();
    const day = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10);
    await service.book(ask({ startsAt: undefined, viewingDate: day, viewingTime: '14:30' }) as any, CLIENT);
    expect(created[0].date.toISOString()).toBe(`${day}T13:30:00.000Z`);
  });

  it.each([
    ['in the past', { startsAt: inHours(-2) }, 'at least an hour'],
    ['too soon', { startsAt: inHours(0.5) }, 'at least an hour'],
    ['too far ahead', { startsAt: inHours(24 * 61) }, 'up to 60 days'],
  ])('refuses a time %s', async (_l, over, msg) => {
    await expect(build().service.book(ask(over) as any, CLIENT)).rejects.toThrow(msg);
  });

  it('refuses short stays, your own listing, a second open viewing and a taken slot', async () => {
    await expect(build({ property: { ...PROPERTY, listingType: 'short_term' } }).service.book(ask() as any, CLIENT)).rejects.toThrow('rent or buy');
    await expect(build().service.book(ask() as any, { _id: AGENT })).rejects.toThrow('your own listing');
    await expect(build({ existing: true }).service.book(ask() as any, CLIENT)).rejects.toThrow('already have a viewing');
    await expect(build({ clash: true }).service.book(ask() as any, CLIENT)).rejects.toThrow('already taken');
  });
});

describe('after booking', () => {
  const appt = (over: any = {}) => ({
    _id: new Types.ObjectId(), agentId: AGENT, clientId: CLIENT._id, clientName: 'Ana', propertyId: PROPERTY._id,
    date: new Date(Date.now() + 48 * HOUR), status: AppointmentStatus.SCHEDULED, ...over,
  });

  it('the agent confirms, and the client hears it', async () => {
    const { service, notifications } = build({ appt: appt() });
    const res: any = await service.confirm('507f1f77bcf86cd799439011', { _id: AGENT });
    expect(res.confirmedAt).toBeInstanceOf(Date);
    expect(notifications.create.mock.calls[0][0]).toEqual(expect.objectContaining({ userId: String(CLIENT._id), title: 'Your viewing is confirmed' }));
  });

  it('the client can\'t confirm or move it, and strangers can\'t touch it', async () => {
    await expect(build({ appt: appt() }).service.confirm('507f1f77bcf86cd799439011', CLIENT)).rejects.toThrow('isn’t your viewing');
    await expect(build({ appt: appt() }).service.reschedule('507f1f77bcf86cd799439011', inHours(30), CLIENT)).rejects.toThrow('isn’t your viewing');
    await expect(build({ appt: appt() }).service.cancel('507f1f77bcf86cd799439011', { _id: new Types.ObjectId() })).rejects.toThrow('isn’t your viewing');
  });

  it('the listing owner counts as the agent side too', async () => {
    const { service } = build({ appt: appt() });
    await expect(service.confirm('507f1f77bcf86cd799439011', { _id: OWNER })).resolves.toBeTruthy();
  });

  it('a client cancelling tells the agent; an agent cancelling tells the client', async () => {
    const a = build({ appt: appt() });
    const byClient: any = await a.service.cancel('507f1f77bcf86cd799439011', CLIENT, 'Found another place');
    expect(byClient).toEqual(expect.objectContaining({ status: 'cancelled', cancelledBy: 'client', cancelReason: 'Found another place' }));
    expect(a.notifications.create.mock.calls[0][0].userId).toBe(String(AGENT));

    const b = build({ appt: appt() });
    await b.service.cancel('507f1f77bcf86cd799439011', { _id: AGENT });
    expect(b.notifications.create.mock.calls[0][0].userId).toBe(String(CLIENT._id));
  });

  it('moving it records the old time and tells the client', async () => {
    const { service, appointmentModel, notifications } = build({ appt: appt() });
    await service.reschedule('507f1f77bcf86cd799439011', inHours(72), { _id: AGENT }, 'I’m away that day');
    const update = appointmentModel.findOneAndUpdate.mock.calls[0][1];
    expect(update.$set.status).toBe('rescheduled');
    expect(update.$push.rescheduleHistory.reason).toBe('I’m away that day');
    expect(notifications.create.mock.calls[0][0].title).toBe('Your viewing has a new time');
  });

  it('done or no-show only once the time has come, and closed viewings stay closed', async () => {
    await expect(build({ appt: appt() }).service.finish('507f1f77bcf86cd799439011', { _id: AGENT }, 'completed')).rejects.toThrow('hasn’t happened yet');
    const past = build({ appt: appt({ date: new Date(Date.now() - HOUR) }) });
    await expect(past.service.finish('507f1f77bcf86cd799439011', { _id: AGENT }, 'completed')).resolves.toEqual(expect.objectContaining({ status: 'completed' }));
    await expect(build({ appt: appt({ status: 'cancelled' }) }).service.confirm('507f1f77bcf86cd799439011', { _id: AGENT })).rejects.toThrow('already closed');
  });

  it('says the time in Cameroon time, in each language', () => {
    const s = build().service;
    const d = new Date('2026-11-12T13:30:00Z');
    expect(s.when(d, 'en')).toBe('Thursday 12 November at 14:30');
    expect(s.when(d, 'fr')).toBe('jeudi 12 novembre à 14:30');
  });
});


describe('reminders', () => {
  function remindersFor(queue: any[]) {
    const calls: any[] = [];
    const appointmentModel: any = {
      findOneAndUpdate: jest.fn((q: any, u: any) => {
        calls.push({ q, u });
        const next = queue.find((a) => !a.taken && (('reminderSent' in q) ? a.kind === 'day' : a.kind === 'hour'));
        if (next) next.taken = true;
        return { lean: () => ({ exec: () => Promise.resolve(next ?? null) }) };
      }),
    };
    const propertyModel: any = { findById: jest.fn(() => ({ select: () => ({ lean: () => ({ exec: () => Promise.resolve({ title: 'Villa' }) }) }) })) };
    const notifications: any = { create: jest.fn().mockResolvedValue(undefined) };
    return { service: new ViewingsService(appointmentModel, propertyModel, notifications), calls, notifications };
  }
  const item = (kind: string, over: any = {}) => ({
    kind, _id: new Types.ObjectId(), agentId: AGENT, clientId: CLIENT._id, clientName: 'Ana',
    propertyId: PROPERTY._id, date: new Date(Date.now() + (kind === 'day' ? 20 : 1) * HOUR), ...over,
  });

  it('tells both sides once, the day before and the hour before', async () => {
    const { service, notifications } = remindersFor([item('day', { confirmedAt: new Date() }), item('hour')]);
    expect(await service.sendReminders()).toBe(2);
    const sentTo = notifications.create.mock.calls.map((c: any[]) => [c[0].userId, c[0].title]);
    expect(sentTo).toEqual(expect.arrayContaining([
      [String(CLIENT._id), 'Your viewing is coming up'],
      [String(AGENT), 'Viewing coming up'],
      [String(CLIENT._id), 'Your viewing starts soon'],
      [String(AGENT), 'A viewing starts soon'],
    ]));
  });

  it('claims each reminder before sending, and only open viewings in the window', async () => {
    const { service, calls } = remindersFor([]);
    await service.sendReminders(Date.UTC(2026, 10, 10, 8));
    const day = calls.find((c) => 'reminderSent' in c.q);
    expect(day.u).toEqual({ $set: { reminderSent: true } });
    expect(day.q.status).toEqual({ $in: ['scheduled', 'rescheduled'] });
    expect(day.q.date.$gt.toISOString()).toBe('2026-11-10T11:00:00.000Z');
    expect(day.q.date.$lte.toISOString()).toBe('2026-11-11T08:00:00.000Z');
  });

  it("says when it isn't confirmed yet", async () => {
    const { service, notifications } = remindersFor([item('hour')]);
    await service.sendReminders();
    const toAgent = notifications.create.mock.calls.find((c: any[]) => c[0].userId === String(AGENT));
    expect(toAgent[0].message).toContain('haven’t confirmed');
    expect(toAgent[1].message).toContain('pas encore confirmée');
  });
});

describe('after a completed viewing', () => {
  it('invites the client to review the agent', async () => {
    const appt = { _id: new Types.ObjectId(), agentId: AGENT, clientId: CLIENT._id, clientName: 'Ana', propertyId: PROPERTY._id, date: new Date(Date.now() - HOUR), status: 'scheduled' };
    const lean = (v: any) => ({ lean: () => ({ exec: () => Promise.resolve(v) }) });
    const appointmentModel: any = { findById: jest.fn(() => lean(appt)), findOneAndUpdate: jest.fn(async () => ({ ...appt, status: 'completed' })) };
    const propertyModel: any = { findById: jest.fn(() => ({ select: () => lean({ title: 'Villa', ownerId: OWNER }) })) };
    const notifications: any = { create: jest.fn().mockResolvedValue(undefined) };
    const service = new ViewingsService(appointmentModel, propertyModel, notifications);
    await service.finish(String(appt._id), { _id: AGENT }, 'completed');
    const [dto, fr] = notifications.create.mock.calls[0];
    expect(dto).toEqual(expect.objectContaining({ userId: String(CLIENT._id), title: 'How was your visit?', link: `/review/agent/${String(AGENT)}` }));
    expect(fr.title).toContain('visite');
  });
});
