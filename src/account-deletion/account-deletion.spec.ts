import * as bcrypt from 'bcrypt';
import { AccountDeletionService, cloudinaryId } from './account-deletion.service';

jest.mock('cloudinary', () => ({ v2: { config: jest.fn(), uploader: { destroy: jest.fn().mockResolvedValue({}) } } }));
import { v2 as cloudinary } from 'cloudinary';

const ME = '507f1f77bcf86cd799439011';

type Counts = Partial<Record<'Booking' | 'Transaction' | 'DigitalLease' | 'EssOrder' | 'Subscription', (f: any) => number>>;

function build(opts: { user?: any; counts?: Counts; wallet?: any } = {}) {
  const log: string[] = [];
  const user = opts.user ?? { _id: ME, role: 'host', email: 'awa@example.com', name: 'Awa', isActive: true };
  const userModel: any = {
    findById: jest.fn(() => ({
      select: () => ({ lean: () => ({ exec: () => Promise.resolve(user) }), exec: () => Promise.resolve(user) }),
    })),
    updateOne: jest.fn(async () => { log.push('closed'); }),
  };
  const model = (name: string) => ({
    countDocuments: jest.fn((f: any) => ({ exec: () => Promise.resolve((opts.counts as any)?.[name]?.(f) ?? 0) })),
    findOne: jest.fn(() => ({ select: () => ({ lean: () => ({ exec: () => Promise.resolve(name === 'Wallet' ? opts.wallet ?? null : null) }) }) })),
    deleteMany: jest.fn(() => ({ exec: async () => { log.push(`delete ${name}`); } })),
    updateMany: jest.fn(() => ({ exec: async () => { log.push(`update ${name}`); } })),
  });
  const names = ['Booking', 'Transaction', 'DigitalLease', 'EssOrder', 'EssShop', 'Subscription', 'Wallet', 'Notification', 'Wishlist', 'Property', 'Review', 'StudentProfile', 'User'];
  const models: any = Object.fromEntries(names.map((n) => [n, model(n)]));
  const connection: any = { models, collection: () => ({ deleteMany: jest.fn().mockResolvedValue({}) }) };
  const apple: any = { revoke: jest.fn().mockResolvedValue(true) };
  const email: any = { sendAccountDeletedEmail: jest.fn().mockResolvedValue(undefined) };
  const service = new AccountDeletionService(connection, userModel, apple, email);
  (service as any).logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
  return { service, userModel, models, apple, email, log };
}

describe('account deletion', () => {
  beforeEach(() => (cloudinary.uploader.destroy as jest.Mock).mockClear());

  it('lists everything that has to be settled first', async () => {
    const { service } = build({
      counts: { Booking: (f) => (f.guestId ? 1 : 2), Transaction: () => 1, DigitalLease: () => 1, EssOrder: () => 3 },
      wallet: { balance: 12_000, pendingBalance: 4_000 },
    });
    const { blockers } = await service.check(ME);
    expect(blockers).toEqual([
      { code: 'trips', count: 1 }, { code: 'guests', count: 2 }, { code: 'held_money', amount: 4_000 }, { code: 'balance', amount: 12_000 },
      { code: 'withdrawal', count: 1 }, { code: 'leases', count: 1 }, { code: 'orders', count: 3 },
    ]);
  });

  it('a wallet too small to withdraw does not hold the account back', async () => {
    const { service } = build({ wallet: { balance: 1_200, pendingBalance: 0 } });
    await expect(service.check(ME)).resolves.toMatchObject({ blockers: [], forfeits: 1_200 });
  });

  it('never deletes when something cannot be checked', async () => {
    const { service, models, userModel } = build();
    delete models.Booking;
    await expect(service.remove(ME, { confirm: true })).rejects.toThrow('Booking');
    expect(userModel.updateOne).not.toHaveBeenCalled();
  });

  it('asks for the password when there is one', async () => {
    const user = { _id: ME, role: 'guest', password: await bcrypt.hash('right', 4), isActive: true };
    const { service, userModel } = build({ user });
    await expect(service.remove(ME, { confirm: true })).rejects.toThrow('Incorrect password');
    await expect(service.remove(ME, { password: 'wrong' })).rejects.toThrow('Incorrect password');
    expect(userModel.updateOne).not.toHaveBeenCalled();
    await expect(service.remove(ME, { password: 'right' })).resolves.toBeDefined();
  });

  it('accounts without a password have to confirm', async () => {
    await expect(build().service.remove(ME, {})).rejects.toThrow('Confirm');
  });

  it('refuses while something is open, and for admins', async () => {
    const open = build({ counts: { Booking: (f) => (f.guestId ? 1 : 0) } });
    await expect(open.service.remove(ME, { confirm: true })).rejects.toThrow('settled first');
    expect(open.userModel.updateOne).not.toHaveBeenCalled();
    await expect(build({ user: { _id: ME, role: 'admin' } }).service.remove(ME, { confirm: true })).rejects.toThrow('settled first');
  });

  it('takes every personal detail off, closes the account before the rest, and tells Apple and the person', async () => {
    const user = {
      _id: ME, role: 'host', email: 'awa@example.com', name: 'Awa', appLanguage: 'fr', appleRefreshToken: 'tok',
      profilePicture: 'https://res.cloudinary.com/x/image/upload/v1700/profile_pictures/abc.jpg',
      identityVerification: { documentPublicId: 'horohouse/identity/doc' },
    };
    const { service, userModel, apple, email, log } = build({ user });
    await service.remove(ME, { confirm: true });

    const update = userModel.updateOne.mock.calls[0][1];
    expect(update.$set).toMatchObject({
      name: 'Deleted user', phoneNumber: `temp_deleted_${ME}`, isActive: false, sessions: [], pushTokens: [], profilePicture: null,
      hostProfile: null, studentProfile: null, paymentNumbers: [], identityVerification: { status: 'unverified' },
    });
    expect(update.$set.deletedAt).toBeInstanceOf(Date);
    for (const key of ['email', 'googleId', 'appleId', 'password', 'address']) expect(update.$unset[key]).toBe(1);
    // One key in both would make the whole update fail
    expect(Object.keys(update.$set).filter((k) => k in update.$unset)).toEqual([]);

    expect(log[0]).toBe('closed');
    expect(log).toEqual(expect.arrayContaining(['delete Notification', 'delete Wishlist', 'update Property', 'update Review']));
    expect(apple.revoke).toHaveBeenCalledWith('tok');
    expect(email.sendAccountDeletedEmail).toHaveBeenCalledWith('awa@example.com', 'Awa', 'fr');
    const gone = (cloudinary.uploader.destroy as jest.Mock).mock.calls.map((c) => c[0]);
    expect(gone).toEqual(['horohouse/identity/doc', 'profile_pictures/abc']);
  });

  it('one failing step does not stop the others', async () => {
    const { service, models, log } = build();
    models.Notification.deleteMany.mockImplementation(() => ({ exec: () => Promise.reject(new Error('down')) }));
    await service.remove(ME, { confirm: true });
    expect(log).toContain('delete Wishlist');
  });

  it('only removes photos that are ours', () => {
    expect(cloudinaryId('https://res.cloudinary.com/x/image/upload/w_200,c_fill/v12/profile_pictures/a%20b.png')).toBe('profile_pictures/a b');
    expect(cloudinaryId('https://lh3.googleusercontent.com/a/photo.jpg')).toBeNull();
    expect(cloudinaryId(null)).toBeNull();
  });
});
