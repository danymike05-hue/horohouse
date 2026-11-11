import { UserRole } from '../users/schemas/user.schema';
import { CoHostsService } from './co-hosts.service';
import { CoHostStatus } from './schemas/co-host.schema';

const PROPERTY = '507f1f77bcf86cd799439051';
const OWNER = '507f1f77bcf86cd799439052';
const INVITEE = '507f1f77bcf86cd799439053';
const STRANGER = '507f1f77bcf86cd799439054';
const ROW = '507f1f77bcf86cd799439055';

const row = (over: any = {}) => ({
  _id: ROW, propertyId: PROPERTY, invitedBy: OWNER, userId: INVITEE, contact: 'a@b.cm',
  status: CoHostStatus.PENDING, createdAt: new Date(), ...over,
});

function build(opts: { invitee?: any; open?: number; row?: any } = {}) {
  const coHostModel: any = {
    exists: jest.fn().mockResolvedValue(null),
    create: jest.fn(async (doc: any) => ({ _id: ROW, status: CoHostStatus.PENDING, ...doc })),
    countDocuments: jest.fn().mockResolvedValue(opts.open ?? 0),
    findById: jest.fn().mockResolvedValue(opts.row ?? row()),
    findOneAndUpdate: jest.fn().mockResolvedValue(opts.row ?? row()),
    find: jest.fn(),
  };
  const property = { _id: PROPERTY, ownerId: OWNER, agentId: undefined, title: 'Villa' };
  const propertyModel: any = {
    findById: jest.fn(() => ({ select: () => Object.assign(Promise.resolve(property), { lean: () => Promise.resolve(property) }) })),
  };
  const userModel: any = {
    findOne: jest.fn(() => ({ select: () => Promise.resolve(opts.invitee === undefined ? { _id: INVITEE } : opts.invitee) })),
  };
  const notifications: any = { create: jest.fn().mockResolvedValue(undefined) };
  const service = new CoHostsService(coHostModel, propertyModel, userModel, notifications);
  return { service, coHostModel, userModel, notifications };
}

describe('CoHostsService', () => {
  describe('invite', () => {
    it('the owner invites a host account, and they are told', async () => {
      const { service, coHostModel, notifications } = build();
      await service.invite({ _id: OWNER }, PROPERTY, ' A@B.cm ');
      expect(coHostModel.create).toHaveBeenCalledWith(expect.objectContaining({ userId: INVITEE, contact: 'A@B.cm' }));
      expect(notifications.create).toHaveBeenCalledWith(expect.objectContaining({ userId: INVITEE }));
    });

    it('only looks for accounts that can use host screens', async () => {
      const { service, userModel } = build();
      await service.invite({ _id: OWNER }, PROPERTY, 'a@b.cm');
      expect(userModel.findOne).toHaveBeenCalledWith(expect.objectContaining({
        email: 'a@b.cm',
        role: { $in: [UserRole.HOST, UserRole.AGENT, UserRole.LANDLORD] },
      }));
    });

    it('finds phone numbers with or without the country code', async () => {
      const { service, userModel } = build();
      await service.invite({ _id: OWNER }, PROPERTY, '+237 6 77 00 00 00');
      const query = userModel.findOne.mock.calls[0][0];
      expect(query.phoneNumber.$in).toEqual(expect.arrayContaining(['677000000', '237677000000', '+237677000000']));
    });

    it('nobody else can invite, including a co-host', async () => {
      const { service, coHostModel } = build();
      await expect(service.invite({ _id: STRANGER }, PROPERTY, 'a@b.cm')).rejects.toThrow('Only the listing');
      expect(coHostModel.create).not.toHaveBeenCalled();
    });

    it('refuses the owner, an unknown contact, a full team and a repeat invite', async () => {
      await expect(build({ invitee: { _id: OWNER } }).service.invite({ _id: OWNER }, PROPERTY, 'a@b.cm')).rejects.toThrow('already manages');
      await expect(build({ invitee: null }).service.invite({ _id: OWNER }, PROPERTY, 'a@b.cm')).rejects.toThrow('couldn’t find');
      await expect(build({ open: 5 }).service.invite({ _id: OWNER }, PROPERTY, 'a@b.cm')).rejects.toThrow('up to 5');
      const repeat = build();
      repeat.coHostModel.create.mockRejectedValue(Object.assign(new Error('dup'), { code: 11000 }));
      await expect(repeat.service.invite({ _id: OWNER }, PROPERTY, 'a@b.cm')).rejects.toThrow('already been invited');
    });
  });

  describe('respond', () => {
    it('only the invited person, and only within a week', async () => {
      await expect(build().service.respond({ _id: STRANGER }, ROW, true)).rejects.toThrow('not for you');
      const old = build({ row: row({ createdAt: new Date(Date.now() - 8 * 86_400_000) }) });
      await expect(old.service.respond({ _id: INVITEE }, ROW, true)).rejects.toThrow('expired');
    });

    it('accepting makes them active and tells the owner', async () => {
      const { service, coHostModel, notifications } = build();
      await service.respond({ _id: INVITEE }, ROW, true);
      expect(coHostModel.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: ROW, status: CoHostStatus.PENDING },
        { $set: expect.objectContaining({ status: CoHostStatus.ACTIVE }) },
      );
      expect(notifications.create).toHaveBeenCalledWith(expect.objectContaining({ userId: OWNER }));
    });

    it('already answered is a clear error', async () => {
      const { service, coHostModel } = build();
      coHostModel.findOneAndUpdate.mockResolvedValue(null);
      await expect(service.respond({ _id: INVITEE }, ROW, true)).rejects.toThrow('already been answered');
    });
  });

  describe('remove', () => {
    it('the owner can remove, the co-host can leave, nobody else', async () => {
      const active = () => row({ status: CoHostStatus.ACTIVE });
      await expect(build({ row: active() }).service.remove({ _id: OWNER }, ROW)).resolves.toBeUndefined();
      await expect(build({ row: active() }).service.remove({ _id: INVITEE }, ROW)).resolves.toBeUndefined();
      await expect(build({ row: active() }).service.remove({ _id: STRANGER }, ROW)).rejects.toThrow('Only the listing');
    });
  });

  describe('isActive', () => {
    it('only counts accepted co-hosts, and bad ids are simply no', async () => {
      const { service, coHostModel } = build();
      await expect(service.isActive(INVITEE, PROPERTY)).resolves.toBe(false);
      expect(coHostModel.exists).toHaveBeenCalledWith(expect.objectContaining({ status: CoHostStatus.ACTIVE }));
      await expect(service.isActive('nope', PROPERTY)).resolves.toBe(false);
      await expect(service.isActive(undefined, PROPERTY)).resolves.toBe(false);
    });
  });
});
