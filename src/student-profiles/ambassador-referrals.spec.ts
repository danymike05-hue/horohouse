import { Types } from 'mongoose';
import { AmbassadorReferralsService } from './ambassador-referrals.service';

const AMB_USER = new Types.ObjectId();
const PROFILE = new Types.ObjectId();
const ANA = new Types.ObjectId();
const lean = (v: any) => ({ lean: () => ({ exec: () => Promise.resolve(v) }) });

function build(opts: { profile?: any; modified?: number; claimed?: any; ambassador?: boolean; walletFails?: boolean; reward?: string } = {}) {
  const profileModel: any = {
    findOne: jest.fn(() => ({ select: () => lean(opts.profile === undefined ? { _id: PROFILE, userId: AMB_USER } : opts.profile) })),
    findById: jest.fn(() => ({ select: () => lean({ _id: PROFILE, userId: AMB_USER, isAmbassador: opts.ambassador ?? true }) })),
  };
  const userModel: any = {
    updateOne: jest.fn().mockResolvedValue({ modifiedCount: opts.modified ?? 1 }),
    findById: jest.fn(() => ({ select: () => lean({ name: 'Paul Mbarga' }) })),
    findOneAndUpdate: jest.fn(() => ({ select: () => lean(opts.claimed === undefined ? { _id: ANA, referredByAmbassador: PROFILE, name: 'Ana B' } : opts.claimed) })),
  };
  const profiles: any = { creditAmbassadorEarning: jest.fn().mockResolvedValue(undefined) };
  const wallet: any = { creditWallet: jest.fn(() => (opts.walletFails ? Promise.reject(new Error('down')) : Promise.resolve({}))) };
  const notifications: any = { create: jest.fn().mockResolvedValue({}) };
  const config: any = { get: (k: string) => (k === 'AMBASSADOR_REWARD_XAF' ? opts.reward : undefined) };
  const service = new AmbassadorReferralsService(profileModel, userModel, profiles, wallet, notifications, config);
  return { service, userModel, profiles, wallet, notifications };
}

describe('using an ambassador code', () => {
  it('records who referred you, once', async () => {
    const { service, userModel } = build();
    expect(await service.useCode(String(ANA), ' paul-uy1 ')).toEqual({ ambassadorName: 'Paul' });
    const [filter, update] = userModel.updateOne.mock.calls[0];
    expect(filter.referredByAmbassador).toEqual({ $exists: false });
    expect(update.$set.referredByAmbassador).toBe(PROFILE);
  });

  it('refuses unknown codes, your own code, and a second code', async () => {
    await expect(build({ profile: null }).service.useCode(String(ANA), 'NOPE1')).rejects.toThrow('No campus ambassador');
    await expect(build().service.useCode(String(AMB_USER), 'PAUL1')).rejects.toThrow('your own code');
    await expect(build({ modified: 0 }).service.useCode(String(ANA), 'PAUL1')).rejects.toThrow('already used');
    await expect(build().service.useCode(String(ANA), 'x')).rejects.toThrow('valid ambassador code');
  });
});

describe('rewards when a referred tenant signs a lease', () => {
  it('pays 2,000 XAF to the ambassador\'s wallet by default, counts it, and tells them', async () => {
    const { service, wallet, profiles, notifications } = build();
    expect(await service.rewardTenants('lease1', [String(ANA)])).toBe(1);
    expect(wallet.creditWallet).toHaveBeenCalledWith(String(AMB_USER), 2000, expect.stringContaining('Ana'), `AMB-lease1-${ANA}`);
    expect(profiles.creditAmbassadorEarning).toHaveBeenCalledWith(String(PROFILE), 2000, 'student');
    expect(notifications.create.mock.calls[0][1].title).toContain('ambassadeur');
  });

  it('the amount is a server setting', async () => {
    const { service, wallet } = build({ reward: '5000' });
    await service.rewardTenants('lease1', [String(ANA)]);
    expect(wallet.creditWallet.mock.calls[0][1]).toBe(5000);
  });

  it('pays once per referred person: already rewarded or never referred means nothing', async () => {
    const { service, wallet } = build({ claimed: null });
    expect(await service.rewardTenants('lease2', [String(ANA)])).toBe(0);
    expect(wallet.creditWallet).not.toHaveBeenCalled();
  });

  it('nothing for someone who is no longer an ambassador', async () => {
    const { service, wallet } = build({ ambassador: false });
    expect(await service.rewardTenants('lease3', [String(ANA)])).toBe(0);
    expect(wallet.creditWallet).not.toHaveBeenCalled();
  });

  it('a failed payment is undone, so a later lease can pay it', async () => {
    const { service, userModel } = build({ walletFails: true });
    expect(await service.rewardTenants('lease4', [String(ANA)])).toBe(0);
    expect(userModel.updateOne).toHaveBeenCalledWith({ _id: ANA }, { $unset: { referralRewardedAt: 1 } });
  });
});
