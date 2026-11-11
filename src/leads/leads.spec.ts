import { Types } from 'mongoose';
import { LeadsService } from './leads.service';

const AGENT = { _id: new Types.ObjectId().toString(), role: 'agent' };
const ADMIN = { _id: new Types.ObjectId().toString(), role: 'admin' };
const LEAD = new Types.ObjectId().toString();

function build() {
  const exec = (v: any = null) => ({ exec: () => Promise.resolve(v) });
  const saved: any[] = [];
  const model: any = function (this: any, doc: any) { saved.push(doc); this.save = async () => doc; };
  model.find = jest.fn(() => ({ sort: () => exec([]) }));
  model.findOne = jest.fn(() => exec({ _id: LEAD }));
  model.findOneAndUpdate = jest.fn(() => exec({ _id: LEAD }));
  model.findOneAndDelete = jest.fn(() => exec({ _id: LEAD }));
  model.countDocuments = jest.fn(() => exec(0));
  return { service: new LeadsService(model), model, saved };
}
const ownerOf = (filter: any) => (filter.ownerId ? String(filter.ownerId) : undefined);

describe('leads belong to the person who created them', () => {
  it('a new lead is owned by its creator, whatever the request says', async () => {
    const { service, saved } = build();
    await service.create({ name: 'Ana', ownerId: 'someone-else' } as any, AGENT);
    expect(String(saved[0].ownerId)).toBe(AGENT._id);
  });

  it('an agent only lists their own leads', async () => {
    const { service, model } = build();
    await service.findAll(AGENT);
    expect(ownerOf(model.find.mock.calls[0][0])).toBe(AGENT._id);
  });

  it('reading, changing, noting and deleting all require ownership', async () => {
    const { service, model } = build();
    await service.findOne(LEAD, AGENT);
    await service.update(LEAD, { status: 'contacted' } as any, AGENT);
    await service.addNote(LEAD, 'Called back', AGENT);
    await service.remove(LEAD, AGENT);
    for (const fn of [model.findOne, model.findOneAndUpdate, model.findOneAndDelete]) {
      for (const call of fn.mock.calls) expect(ownerOf(call[0])).toBe(AGENT._id);
    }
  });

  it("someone else's lead is simply not found", async () => {
    const { service, model } = build();
    model.findOne.mockReturnValue({ exec: () => Promise.resolve(null) });
    await expect(service.findOne(LEAD, AGENT)).rejects.toThrow('not found');
    await expect(service.findOne('not-an-id', AGENT)).rejects.toThrow('not found');
  });

  it('stats only count their own leads', async () => {
    const { service, model } = build();
    await service.getStats(AGENT);
    for (const call of model.countDocuments.mock.calls) expect(ownerOf(call[0])).toBe(AGENT._id);
  });

  it('admins see every lead, including older ones without an owner', async () => {
    const { service, model } = build();
    await service.findAll(ADMIN);
    expect(model.find.mock.calls[0][0]).toEqual({});
  });
});
